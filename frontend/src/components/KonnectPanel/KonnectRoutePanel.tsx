import { useEffect, useState } from 'react'
import { ArrowPathIcon, XMarkIcon, ChevronRightIcon, ClipboardDocumentIcon, CommandLineIcon, CheckIcon } from '@heroicons/react/24/outline'
import CodeMirror from '@uiw/react-codemirror'
import { yaml } from '@codemirror/lang-yaml'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { getTopLevelFolder } from '../../utils/folders'
import { storage } from '../../db/storage'
import {
  listRoutes,
  getRouteDetail,
  getServiceDetail,
  getCpDetail,
  listAllPlugins,
  listApis,
  listApiImplementations,
  listApiPublications,
  listPortals,
  cpKindFromClusterType,
  type KonnectRegion,
  type KonnectRoute,
  type KonnectPortalApi,
} from '../../utils/konnectApi'

const CP_TYPE_LABELS: Record<string, string> = {
  hybrid:     'Hybrid',
  serverless: 'Serverless (Cloud)',
  dedicated:  'Dedicated (Cloud)',
}

const NEON = '#6fdc0e'

// ── Route matching ─────────────────────────────────────────────────────────────

function resolveVariables(url: string, variables: Record<string, string>): string {
  return url.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `{{${k}}}`)
}
function extractPath(url: string): string {
  try { return new URL(url).pathname } catch { return url.startsWith('/') ? url : `/${url}` }
}
function cleanPath(p: string): string {
  let s = p.startsWith('~') ? p.slice(1) : p
  s = s.replace(/^\^/, '').replace(/\$$/, '')
  return s || '/'
}
function matchRoute(requestPath: string, requestMethod: string, routes: KonnectRoute[]): { route: KonnectRoute; exact: boolean } | null {
  const rp = requestPath.split('?')[0].replace(/\/$/, '') || '/'
  const check = (r: KonnectRoute, ignoreMethod: boolean) => {
    if (!ignoreMethod && r.methods && !r.methods.includes(requestMethod.toUpperCase())) return false
    for (const p of r.paths ?? []) {
      const cp = cleanPath(p).replace(/\/$/, '') || '/'
      if (rp === cp) return 'exact'
      if (rp.startsWith(cp + '/') || rp.startsWith(cp + '?')) return 'prefix'
    }
    return false
  }
  for (const r of routes) { const m = check(r, false); if (m) return { route: r, exact: m === 'exact' } }
  for (const r of routes) { const m = check(r, true);  if (m) return { route: r, exact: m === 'exact' } }
  return null
}

// ── decK YAML serializer ───────────────────────────────────────────────────────

function qStr(s: string): string {
  if (s === '') return "''"
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(s) ||
      /^[\-?:,[\]{}#&*!|>'"%@`~]/.test(s) ||
      s.includes(': ') || s.includes('\n') ||
      /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
    return `'${s.replace(/'/g, "''")}'`
  }
  return s
}

function yVal(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return qStr(v)
  if (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object')) {
    return v.length === 0 ? '[]' : `[${v.map(yVal).join(', ')}]`
  }
  return ''
}

function isEmptyVal(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) return true
  return false
}

function appendKV(lines: string[], k: string, v: unknown, prefix: string, childDepth: number): void {
  if (isEmptyVal(v)) return
  if (typeof v !== 'object') { lines.push(`${prefix}${k}: ${yVal(v)}`); return }
  if (Array.isArray(v)) {
    const filtered = v.filter(x => !isEmptyVal(x))
    if (filtered.length === 0) return
    if (filtered.every(x => x === null || typeof x !== 'object')) {
      lines.push(`${prefix}${k}: [${filtered.map(yVal).join(', ')}]`); return
    }
    lines.push(`${prefix}${k}:`)
    yLines(filtered, childDepth, lines); return
  }
  // Nested object: only emit key if it has non-empty children
  const snapshot: string[] = []
  yLines(v, childDepth, snapshot)
  if (snapshot.length > 0) { lines.push(`${prefix}${k}:`); lines.push(...snapshot) }
}

function yLines(val: unknown, depth: number, out: string[]): void {
  const pad = '  '.repeat(depth)
  if (Array.isArray(val)) {
    for (const item of val) {
      if (item === null || typeof item !== 'object') { out.push(`${pad}- ${yVal(item)}`); continue }
      const entries = Object.entries(item as Record<string, unknown>).filter(([, v]) => !isEmptyVal(v))
      entries.forEach(([k, v], i) => {
        // depth+2: list item keys are visually at depth+1, so their children need depth+2
        appendKV(out, k, v, i === 0 ? `${pad}- ` : `${pad}  `, depth + 2)
      })
    }
    return
  }
  if (typeof val === 'object' && val !== null) {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (!isEmptyVal(v)) appendKV(out, k, v, pad, depth + 1)
    }
  }
}

function toYaml(obj: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (!isEmptyVal(v)) appendKV(lines, k, v, '', 1)
  }
  return lines.join('\n')
}

// ── decK object builder ────────────────────────────────────────────────────────

type PluginScope = 'global' | 'route' | 'service'

const PLUGIN_FIELDS = ['name', 'instance_name', 'enabled', 'config', 'tags'] as const
const ROUTE_FIELDS  = ['name', 'methods', 'paths', 'protocols', 'strip_path', 'preserve_host', 'regex_priority', 'snis', 'hosts', 'headers', 'tags'] as const
const SVC_FIELDS    = ['name', 'host', 'port', 'path', 'protocol', 'connect_timeout', 'read_timeout', 'write_timeout', 'retries', 'tags'] as const

function pickFields(obj: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of fields) {
    const v = obj[k]
    if (!isEmptyVal(v)) out[k] = v
  }
  return out
}

function buildDeck(
  route: Record<string, unknown> | null,
  service: Record<string, unknown> | null,
  plugins: Array<{ plugin: Record<string, unknown>; scope: PluginScope }>,
): Record<string, unknown> {
  const manageable = plugins.filter(p => {
    const tags = p.plugin.tags as string[] | undefined
    return !tags?.includes('konnect-managed-plugin')
  })
  const byScope = (s: PluginScope) => manageable.filter(p => p.scope === s).map(p => pickFields(p.plugin, PLUGIN_FIELDS))

  const routeObj = route ? {
    ...pickFields(route, ROUTE_FIELDS),
    ...(byScope('route').length ? { plugins: byScope('route') } : {}),
  } : null

  const deck: Record<string, unknown> = {}

  if (service) {
    const svcObj: Record<string, unknown> = {
      ...pickFields(service, SVC_FIELDS),
      ...(byScope('service').length ? { plugins: byScope('service') } : {}),
      ...(routeObj ? { routes: [routeObj] } : {}),
    }
    deck.services = [svcObj]
  } else if (routeObj) {
    deck.routes = [routeObj]
  }

  if (byScope('global').length) deck.plugins = byScope('global')
  return deck
}

// ── YAML syntax highlight ──────────────────────────────────────────────────────

function CopyBtn({ title, onClick, icon: Icon }: { title: string; onClick: () => void; icon: React.ComponentType<{ className?: string }> }) {
  const [done, setDone] = useState(false)
  function handle() {
    onClick()
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <button
      title={title}
      onClick={handle}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 4,
        background: done ? 'rgba(111,220,14,0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${done ? 'rgba(111,220,14,0.3)' : '#2a2a2a'}`,
        color: done ? NEON : '#6b7280',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!done) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#d1d5db' } }}
      onMouseLeave={e => { if (!done) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#6b7280' } }}
    >
      {done ? <CheckIcon className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
    </button>
  )
}

// ── CodeMirror theme matching YamlLine colors ─────────────────────────────────

const yamlHighlight = HighlightStyle.define([
  { tag: t.propertyName,           color: '#7dd3fc' },   // keys
  { tag: [t.string, t.special(t.string)], color: '#a3e635' }, // strings
  { tag: t.number,                 color: '#c4b5fd' },   // numbers
  { tag: t.bool,                   color: '#6fdc0e' },   // true/false (overridden below per value via CSS)
  { tag: t.null,                   color: '#6b7280' },   // null
  { tag: t.keyword,                color: '#6b7280' },   // anchors/aliases
  { tag: [t.punctuation, t.separator], color: '#374151' }, // : and -
  { tag: t.comment,                color: '#4b5563', fontStyle: 'italic' },
])

const yamlEditorTheme = EditorView.theme({
  '&': { background: '#0a0a0a !important', height: '100%' },
  '.cm-scroller': { fontFamily: 'ui-monospace,SFMono-Regular,monospace', fontSize: '11px', lineHeight: '18px' },
  '.cm-content': { padding: '12px 4px', color: '#d1d5db' },
  '.cm-line': { paddingLeft: '10px' },
  '.cm-cursor': { borderLeftColor: '#6fdc0e' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(111,220,14,0.15) !important' },
  '.cm-gutters': { background: '#0a0a0a', borderRight: '1px solid #1a1a1a', color: '#374151' },
  '.cm-activeLine': { background: 'rgba(255,255,255,0.03)' },
  '.cm-activeLineGutter': { background: 'rgba(255,255,255,0.03)' },
})

const yamlExtensions = [yaml(), syntaxHighlighting(yamlHighlight), yamlEditorTheme]

// ── Edit & Copy modal ─────────────────────────────────────────────────────────

function EditCommandModal({ command, onClose }: { command: string; onClose: () => void }) {
  const [value, setValue] = useState(command)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="flex flex-col"
        style={{ width: '80vw', height: '78vh', background: '#111111', border: '1px solid #2a2a2a', borderRadius: 8, boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0" style={{ borderColor: '#1e1e1e' }}>
          <CommandLineIcon className="w-4 h-4 flex-shrink-0" style={{ color: NEON }} />
          <span className="text-sm font-semibold text-gray-200">Edit decK Command</span>
          <span className="text-xs text-gray-600 ml-1">Edit the command below, then copy and run in your terminal. Changes are not saved.</span>
          <div className="flex-1" />
          <button className="btn-ghost p-1" onClick={onClose}><XMarkIcon className="w-4 h-4" /></button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden" style={{ background: '#0a0a0a' }}>
          <CodeMirror
            value={value}
            height="100%"
            extensions={yamlExtensions}
            onChange={setValue}
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t flex-shrink-0" style={{ borderColor: '#1e1e1e' }}>
          <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
          <button className="btn-primary text-xs flex items-center gap-1.5" onClick={handleCopy}>
            {copied
              ? <><CheckIcon className="w-3.5 h-3.5" />Copied!</>
              : <><ClipboardDocumentIcon className="w-3.5 h-3.5" />Copy Command</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── YAML display ──────────────────────────────────────────────────────────────

function YamlContent({ text, onCopyYaml, onOpenDeckModal }: {
  text: string
  onCopyYaml?: () => void
  onOpenDeckModal?: () => void
}) {
  return (
    <div style={{ position: 'relative', background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 4, overflow: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, float: 'right', display: 'flex', gap: 4, padding: '5px 5px 0 0', zIndex: 1 }}>
        {onOpenDeckModal && <CopyBtn title="Edit & copy as decK command" onClick={onOpenDeckModal} icon={CommandLineIcon} />}
        {onCopyYaml && <CopyBtn title="Copy YAML" onClick={onCopyYaml} icon={ClipboardDocumentIcon} />}
      </div>
      <pre style={{ margin: 0, padding: '8px 10px', fontFamily: 'ui-monospace,SFMono-Regular,monospace', fontSize: 10, lineHeight: '15px', whiteSpace: 'pre' }}>
        {text.split('\n').map((line, i) => <YamlLine key={i} line={line} />)}
      </pre>
    </div>
  )
}

function YamlLine({ line }: { line: string }) {
  if (!line.trim()) return <>{'\n'}</>
  const m = line.match(/^(\s*)(- )?([^:]+?)(\s*:)(\s*)(.*)$/)
  if (!m) return <><span style={{ color: '#9ca3af' }}>{line}</span>{'\n'}</>
  const [, indent, dash, key, colon, space, rawVal] = m
  const val = rawVal.trim()
  let valColor = '#d1d5db'
  if (!val) { /* section key, no color */ }
  else if (val === 'true') valColor = NEON
  else if (val === 'false') valColor = '#f87171'
  else if (val === 'null' || val === '~') valColor = '#6b7280'
  else if (/^-?\d+(\.\d+)?$/.test(val)) valColor = '#c4b5fd'
  else if (val.startsWith("'") || val.startsWith('"')) valColor = '#a3e635'
  else if (val.startsWith('[')) valColor = '#e5e7eb'
  return (
    <>
      <span>{indent}</span>
      {dash && <span style={{ color: '#6b7280' }}>{dash}</span>}
      <span style={{ color: '#7dd3fc' }}>{key}</span>
      <span style={{ color: '#374151' }}>{colon}</span>
      <span>{space}</span>
      <span style={{ color: valColor }}>{rawVal}</span>
      {'\n'}
    </>
  )
}

// ── Accordion ──────────────────────────────────────────────────────────────────

function Accordion({ label, sub, count, defaultOpen = false, children }: {
  label: string; sub?: string; count?: number; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b" style={{ borderColor: '#1a1a1a' }}>
      <button
        className="w-full flex items-center gap-1 text-left transition-colors"
        style={{ padding: '5px 10px', background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => setOpen(o => !o)}
      >
        <ChevronRightIcon className="flex-shrink-0 transition-transform duration-150"
          style={{ width: 10, height: 10, color: '#4b5563', transform: open ? 'rotate(90deg)' : 'rotate(0)' }} />
        <span className="font-semibold uppercase tracking-wide" style={{ fontSize: 10, color: '#d1d5db', letterSpacing: '0.06em' }}>
          {label}
        </span>
        {sub && <span className="text-gray-600 truncate ml-1" style={{ fontSize: 10 }}>{sub}</span>}
        {count !== undefined && count > 0 && (
          <span className="ml-auto inline-flex items-center justify-center"
            style={{ background: '#1e2a1e', color: NEON, fontSize: 9, fontWeight: 600, minWidth: 15, height: 15, paddingInline: 3, border: '1px solid rgba(111,220,14,0.2)', borderRadius: 3 }}>
            {count}
          </span>
        )}
      </button>
      {open && <div style={{ padding: '0 10px 8px 20px' }}>{children}</div>}
    </div>
  )
}

// ── KV table (for CP info) ────────────────────────────────────────────────────

function ValueCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-600 italic">null</span>
  if (typeof value === 'boolean') return <span style={{ color: value ? NEON : '#f87171' }}>{String(value)}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-600 italic">[]</span>
    return (
      <span className="flex flex-wrap gap-0.5">
        {value.map((v, i) => (
          <span key={i} style={{ background: '#1a2a1a', color: NEON, border: '1px solid rgba(111,220,14,0.2)', borderRadius: 3, fontSize: 10, padding: '0 4px' }}>
            {String(v)}
          </span>
        ))}
      </span>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-gray-600 italic">{'{ }'}</span>
    return (
      <span className="flex flex-wrap gap-1">
        {entries.map(([k, v]) => (
          <span key={k} className="inline-flex items-center" style={{ background: '#0f1a0f', border: '1px solid rgba(111,220,14,0.18)', borderRadius: 4, overflow: 'hidden' }}>
            <span style={{ padding: '1px 5px', fontSize: 9, color: '#6b9e6b', borderRight: '1px solid rgba(111,220,14,0.15)', background: '#0a120a' }}>{k}</span>
            <span style={{ padding: '1px 5px', fontSize: 9, color: '#d1d5db' }}>{String(v)}</span>
          </span>
        ))}
      </span>
    )
  }
  return <span className="text-gray-300">{String(value)}</span>
}

const CP_ORDER = ['name', 'id', 'cluster_type', 'description', 'labels']
const CP_SKIP  = new Set(['created_at', 'updated_at', 'config', 'auth_type', 'service', 'consumer', 'route'])

function CpTable({ obj, extraRows }: { obj: Record<string, unknown>; extraRows?: Array<[string, React.ReactNode]> }) {
  const ordered = CP_ORDER.filter(k => k in obj)
  const rest = Object.keys(obj).filter(k => !CP_ORDER.includes(k) && !CP_SKIP.has(k))
  const keys = [...ordered, ...rest].filter(k => !isEmptyVal(obj[k]))
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 4, padding: '6px 8px' }}>
      {extraRows?.map(([k, v]) => (
        <div key={k} className="flex gap-2 border-b" style={{ borderColor: '#1a1a1a', padding: '2px 0' }}>
          <span className="text-gray-600 flex-shrink-0 font-mono" style={{ minWidth: 110, fontSize: 10 }}>{k}</span>
          <span className="font-mono min-w-0 break-all" style={{ fontSize: 10 }}>{v}</span>
        </div>
      ))}
      {keys.map(k => (
        <div key={k} className="flex gap-2 border-b" style={{ borderColor: '#1a1a1a', padding: '2px 0' }}>
          <span className="text-gray-600 flex-shrink-0 font-mono" style={{ minWidth: 110, fontSize: 10 }}>{k}</span>
          <span className="font-mono min-w-0 break-all" style={{ fontSize: 10 }}><ValueCell value={obj[k]} /></span>
        </div>
      ))}
    </div>
  )
}

// ── Panel data ─────────────────────────────────────────────────────────────────

interface PortalApiEntry {
  api: KonnectPortalApi
  portals: Array<{ name: string; url: string }>
}

interface PanelData {
  cp: Record<string, unknown> | null
  route: Record<string, unknown> | null
  service: Record<string, unknown> | null
  plugins: Array<{ plugin: Record<string, unknown>; scope: PluginScope }>
  matchedPath: string
  matchExact: boolean
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export function KonnectRoutePanel() {
  const { activeRequestId, requests, folders } = useWorkspaceStore()
  const { setActiveRightPanel, currentExecution } = useUIStore()

  const request = requests.find(r => r.id === activeRequestId)
  const topFolder = getTopLevelFolder(activeRequestId ?? '', requests, folders)
  const isKonnect = topFolder?.id.startsWith('konnect-cp-') ?? false

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PanelData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [showDeckModal, setShowDeckModal] = useState(false)

  const [portalApis, setPortalApis] = useState<PortalApiEntry[] | null>(null)
  const [loadingPortalApis, setLoadingPortalApis] = useState(false)

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', close) }
  }, [ctxMenu])

  const respHeaders = currentExecution?.response.headers ?? {}
  const viaHeader = respHeaders['via'] ?? ''
  const serverHeader = respHeaders['server'] ?? ''
  const kongVersionRaw = serverHeader.toLowerCase().startsWith('kong')
    ? serverHeader.slice(serverHeader.toLowerCase().indexOf('kong/') + 5)
    : /kong\//i.test(viaHeader)
      ? viaHeader.slice(viaHeader.toLowerCase().indexOf('kong/') + 5)
      : null

  useEffect(() => {
    if (isKonnect && request && topFolder) load()
    else { setData(null); setNotFound(false); setError(null); setPortalApis(null) }
  }, [activeRequestId])

  // When we have a service ID, separately look up matching Portal APIs.
  // Uses two parallel calls: list all implementations + list all APIs,
  // then cross-references by api_id for the ones matching this service.
  useEffect(() => {
    const serviceId = data?.service?.id as string | undefined
    if (!serviceId || !topFolder) { setPortalApis(null); return }
    const pat = storage.loadKonnectPat()
    if (!pat) return
    const cpId = topFolder.id.replace('konnect-cp-', '')
    const region = (topFolder.kongRegion ?? 'us') as KonnectRegion
    setLoadingPortalApis(true)
    setPortalApis(null)
    Promise.all([
      listApiImplementations(pat, region),
      listApis(pat, region),
      listApiPublications(pat, region),
      listPortals(pat, region),
    ]).then(([impls, apis, publications, portals]) => {
      const apiMap = new Map(apis.map(a => [a.id, a]))
      const portalMap = new Map(portals.map(p => [p.id, p]))

      // Build api_id → portal entries from publications
      const apiPortals = new Map<string, Array<{ name: string; url: string }>>()
      for (const pub of publications) {
        if (!pub.api_id || !pub.portal_id) continue
        const portal = portalMap.get(pub.portal_id)
        if (!portal) continue
        const domain = portal.custom_domain || portal.default_domain
        if (!domain) continue
        const url = domain.startsWith('http') ? domain : `https://${domain}`
        const list = apiPortals.get(pub.api_id) ?? []
        list.push({ name: portal.name, url })
        apiPortals.set(pub.api_id, list)
      }

      const matchedApiIds = new Set(
        impls
          .filter(impl => impl.service?.id === serviceId && impl.service?.control_plane_id === cpId)
          .map(impl => impl.api_id)
          .filter(Boolean) as string[]
      )

      const entries = [...matchedApiIds]
        .map(id => {
          const api = apiMap.get(id)
          return api ? { api, portals: apiPortals.get(id) ?? [] } : null
        })
        .filter(Boolean) as PortalApiEntry[]

      setPortalApis(entries)
    }).catch(() => setPortalApis([])).finally(() => setLoadingPortalApis(false))
  }, [data?.service?.id])

  async function load() {
    if (!request || !topFolder) return
    setLoading(true); setData(null); setNotFound(false); setError(null)
    try {
      const pat = storage.loadKonnectPat()
      if (!pat) { setError('No Konnect PAT found. Open the Konnect sync modal to authenticate.'); return }
      const cpId = topFolder.id.replace('konnect-cp-', '')
      const region = (topFolder.kongRegion ?? 'us') as KonnectRegion
      const variables = topFolder.variables ?? {}
      const path = extractPath(resolveVariables(request.url, variables))

      const [cpDetail, routes] = await Promise.all([getCpDetail(pat, region, cpId), listRoutes(pat, region, cpId)])
      const match = matchRoute(path, request.method, routes)
      if (!match) {
        setData({ cp: cpDetail, route: null, service: null, plugins: [], matchedPath: path, matchExact: false })
        setNotFound(true); return
      }

      const serviceId = match.route.service?.id as string | undefined
      const [fullRoute, fullService, allPlugins] = await Promise.all([
        getRouteDetail(pat, region, cpId, match.route.id),
        serviceId ? getServiceDetail(pat, region, cpId, serviceId) : Promise.resolve(null),
        listAllPlugins(pat, region, cpId),
      ])

      const plugins: PanelData['plugins'] = []
      for (const p of allPlugins) {
        const pr = p.route as { id: string } | null | undefined
        const ps = p.service as { id: string } | null | undefined
        if (pr?.id === match.route.id) plugins.push({ plugin: p, scope: 'route' })
        else if (serviceId && ps?.id === serviceId) plugins.push({ plugin: p, scope: 'service' })
        else if (!pr && !ps && !(p.consumer as unknown)) plugins.push({ plugin: p, scope: 'global' })
      }

      setData({ cp: cpDetail, route: fullRoute, service: fullService, plugins, matchedPath: path, matchExact: match.exact })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally { setLoading(false) }
  }

  const yamlText = data?.route
    ? `_format_version: "3.0"\n\n${toYaml(buildDeck(data.route, data.service, data.plugins))}`
    : null

  const KONNECT_ADDR: Record<string, string> = {
    us: 'https://us.api.konghq.com',
    eu: 'https://eu.api.konghq.com',
    au: 'https://au.api.konghq.com',
    global: 'https://global.api.konghq.com',
  }

  function buildDeckCommand(): string {
    const pat = storage.loadKonnectPat() ?? 'YOUR_PAT'
    const cpName = topFolder?.name ?? 'your-control-plane'
    const addr = KONNECT_ADDR[topFolder?.kongRegion ?? 'us'] ?? 'https://us.api.konghq.com'

    // Scope the sync to only the objects shown using their tags.
    // deck sync --select-tag uses AND logic: only entities carrying ALL listed
    // tags are managed; everything else is left untouched.
    const routeTags = (data?.route?.tags as string[] | undefined) ?? []
    const svcTags   = (data?.service?.tags as string[] | undefined) ?? []
    const selectTags = routeTags.length > 0 ? routeTags : svcTags
    const tagFlags = selectTags.map(tag => `  --select-tag ${tag}`).join(' \\\n')

    const flags = [
      `  --konnect-token ${pat}`,
      `  --konnect-control-plane-name "${cpName}"`,
      `  --konnect-addr ${addr}`,
      ...(tagFlags ? [tagFlags] : []),
      `  -`,
    ].join(' \\\n')

    return `deck gateway sync \\\n${flags} <<'EOF'\n${yamlText}\nEOF`
  }

  return (
    <div className="flex flex-col h-full border-l" style={{ background: '#111111', borderColor: '#1a1a1a' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: '#1a1a1a' }}>
        <span className="text-xs font-semibold flex-1" style={{ color: NEON }}>Kong Konnect</span>
        {topFolder && <span className="text-xs text-gray-600 truncate max-w-[120px]">{topFolder.name}</span>}
        {isKonnect && (
          <button className="btn-ghost p-1" onClick={load} title="Refresh" disabled={loading}>
            <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button className="btn-ghost p-1" onClick={() => setActiveRightPanel(null)}>
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto text-xs">

        {!request && <p className="text-gray-600 text-center mt-8 px-4">No request selected.</p>}
        {request && !isKonnect && <p className="text-gray-600 text-center mt-8 px-4">This request is not under a Konnect control plane.</p>}

        {loading && (
          <div className="flex items-center justify-center gap-2 text-gray-500 mt-8">
            <ArrowPathIcon className="w-4 h-4 animate-spin" /><span>Loading…</span>
          </div>
        )}

        {error && !loading && (
          <div className="m-3 p-2 rounded" style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', color: '#f87171' }}>{error}</div>
        )}

        {!loading && request && isKonnect && (
          <div>

            {/* ── Control Plane ── */}
            <Accordion label="Control Plane" defaultOpen>
              {data?.cp ? (
                <CpTable
                  obj={data.cp}
                  extraRows={[
                    ['type', <span className="text-gray-300">{CP_TYPE_LABELS[cpKindFromClusterType(topFolder?.kongCpType)] ?? '—'}</span>],
                    ...(kongVersionRaw ? [['gateway_version', <span className="text-gray-300">{kongVersionRaw}</span>] as [string, React.ReactNode]] : []),
                  ]}
                />
              ) : (
                <p className="text-gray-600 py-1">No control plane data.</p>
              )}
            </Accordion>

            {/* ── Gateway Configuration ── */}
            <Accordion
              label="Gateway Configuration"
              defaultOpen
            >
              {notFound && (
                <div className="mb-2 p-2 rounded" style={{ background: '#1a1200', border: '1px solid #3a2a00', color: '#f59e0b' }}>
                  <p className="font-semibold">No matching route found</p>
                  <p className="text-gray-600 mt-px">Path: <span className="font-mono text-gray-400">{data?.matchedPath}</span></p>
                </div>
              )}

              {yamlText && (
                <div>
                  {/* match badge */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-gray-600">matched</span>
                    <span className="font-mono text-gray-400">{data?.matchedPath}</span>
                    <span className="px-1 py-px" style={{
                      background: data?.matchExact ? 'rgba(111,220,14,0.1)' : 'rgba(245,158,11,0.1)',
                      color: data?.matchExact ? NEON : '#f59e0b',
                      border: `1px solid ${data?.matchExact ? 'rgba(111,220,14,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      borderRadius: 3, fontSize: 9,
                    }}>
                      {data?.matchExact ? 'exact' : 'prefix'}
                    </span>
                  </div>
                  <div onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}>
                    <YamlContent
                      text={yamlText}
                      onCopyYaml={() => navigator.clipboard.writeText(yamlText)}
                      onOpenDeckModal={() => setShowDeckModal(true)}
                    />
                  </div>
                </div>
              )}

              {!notFound && !yamlText && data !== null && (
                <p className="text-gray-600 py-1">No gateway configuration data.</p>
              )}
            </Accordion>

            {/* ── Portal APIs ── */}
            {data?.service && (
              <Accordion label="Portal APIs" count={portalApis?.length}>
                {loadingPortalApis && (
                  <div className="flex items-center gap-1.5 text-gray-600 py-1">
                    <ArrowPathIcon className="w-3 h-3 animate-spin" /><span>Looking up portal APIs…</span>
                  </div>
                )}
                {!loadingPortalApis && portalApis !== null && portalApis.length === 0 && (
                  <p className="text-gray-600 py-1">No portal APIs linked to this service.</p>
                )}
                {!loadingPortalApis && portalApis?.map(entry => (
                  <div key={entry.api.id} style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 4, padding: '6px 8px', marginBottom: 6 }}>
                    <div className="font-semibold text-gray-200 truncate" style={{ fontSize: 11 }}>{entry.api.name}</div>
                    {entry.api.description && (
                      <div className="text-gray-500 mt-1" style={{ fontSize: 10, lineHeight: '14px' }}>{entry.api.description}</div>
                    )}
                    {entry.portals.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div className="text-gray-600 uppercase tracking-wide" style={{ fontSize: 9, marginBottom: 3 }}>Published on</div>
                        {entry.portals.map(p => (
                          <a
                            key={p.url}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 px-2 py-1 rounded transition-colors"
                            style={{ fontSize: 10, color: NEON, background: 'rgba(111,220,14,0.05)', border: '1px solid rgba(111,220,14,0.12)', marginBottom: 3, textDecoration: 'none' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(111,220,14,0.1)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(111,220,14,0.05)')}
                          >
                            <span className="truncate">{p.name}</span>
                            <svg viewBox="0 0 12 12" fill="none" style={{ width: 10, height: 10, flexShrink: 0 }}><path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Accordion>
            )}

          </div>
        )}

      </div>

      {/* Edit & Copy modal */}
      {showDeckModal && yamlText && (
        <EditCommandModal command={buildDeckCommand()} onClose={() => setShowDeckModal(false)} />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 6,
            boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
            zIndex: 9999,
            minWidth: 210,
            overflow: 'hidden',
          }}
        >
          <button
            className="w-full text-left transition-colors"
            style={{ padding: '7px 12px', fontSize: 11, color: '#e5e7eb', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(111,220,14,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              setCtxMenu(null)
              setShowDeckModal(true)
            }}
          >
            <span style={{ color: NEON, marginRight: 8 }}>$</span>Copy as decK command
          </button>
          <button
            className="w-full text-left transition-colors"
            style={{ padding: '7px 12px', fontSize: 11, color: '#e5e7eb', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              navigator.clipboard.writeText(yamlText ?? '')
              setCtxMenu(null)
            }}
          >
            <span style={{ color: '#6b7280', marginRight: 8 }}>⎘</span>Copy YAML
          </button>
        </div>
      )}
    </div>
  )
}
