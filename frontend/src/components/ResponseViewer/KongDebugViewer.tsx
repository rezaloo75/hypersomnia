import { useMemo } from 'react'

const NEON = '#6fdc0e'
const TRACK = 'rgba(111,220,14,0.07)'
const PHASE_ORDER = ['rewrite', 'access', 'balancer', 'upstream', 'header_filter', 'body_filter', 'log']

type DebugNode = {
  total_time?: number
  child?: Record<string, DebugNode>
  [key: string]: unknown
}

type DebugOutput = {
  request_id?: string
  workspace_id?: string
  child?: Record<string, DebugNode>
  total_time_without_upstream?: number
}

interface Props {
  header: string
}

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function labelFor(name: string): string {
  if (isUUID(name)) return name.slice(0, 8) + '…'
  return name.replace(/_/g, ' ')
}

function fmtTime(ms: number): string {
  return ms >= 100 ? `${ms.toFixed(1)}ms` : `${ms.toFixed(2)}ms`
}

function sortedEntries(obj: Record<string, DebugNode>): [string, DebugNode][] {
  return Object.entries(obj).sort(([a], [b]) => {
    const ai = PHASE_ORDER.indexOf(a), bi = PHASE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export function KongDebugViewer({ header }: Props) {
  const data = useMemo<DebugOutput | null>(() => {
    try { return JSON.parse(header) as DebugOutput }
    catch { return null }
  }, [header])

  if (!data?.child) {
    return <div className="p-4 text-xs text-gray-500">Could not parse Kong debug output.</div>
  }

  const totalTime = Object.values(data.child).reduce((s, n) => s + (n.total_time ?? 0), 0)
  const phases = sortedEntries(data.child)

  return (
    <div className="h-full overflow-y-auto px-4 py-4 font-mono text-xs">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-5">
        <span className="font-bold text-sm tracking-wide" style={{ color: NEON }}>
          Kong Gateway Trace
        </span>
        {data.request_id && (
          <span className="text-gray-600">id:{data.request_id}</span>
        )}
        {data.total_time_without_upstream != null && (
          <span className="text-gray-500">
            gateway overhead:{' '}
            <span style={{ color: NEON }} className="font-semibold">
              {fmtTime(data.total_time_without_upstream)}
            </span>
          </span>
        )}
        <span className="text-gray-500">
          total incl. upstream:{' '}
          <span className="text-gray-300">{fmtTime(totalTime)}</span>
        </span>
      </div>

      {/* Column header */}
      <div className="flex items-center gap-2 mb-1 pb-1 border-b border-gray-800">
        <div className="flex-shrink-0 text-gray-600" style={{ width: 196 }}>Phase / Action</div>
        <div className="flex-1" />
        <div className="flex-shrink-0 w-16 text-right text-gray-600">Time</div>
      </div>

      {/* Waterfall rows */}
      <div>
        {phases.map(([name, node]) => (
          <Row key={name} name={name} node={node} totalTime={totalTime} depth={0} />
        ))}
      </div>
    </div>
  )
}

function Row({
  name, node, totalTime, depth,
}: {
  name: string
  node: DebugNode
  totalTime: number
  depth: number
}) {
  const time = node.total_time
  const extras = Object.entries(node).filter(([k]) => k !== 'total_time' && k !== 'child')
  const children = node.child ? sortedEntries(node.child) : null

  const isPhase = depth === 0
  const barPct = totalTime > 0 && time != null ? Math.max(0.4, (time / totalTime) * 100) : 0
  const barH = isPhase ? 18 : depth === 1 ? 12 : 8
  const barAlpha = isPhase ? 0.9 : Math.max(0.25, 0.65 - (depth - 1) * 0.15)
  const nameColor = isPhase ? NEON : depth === 1 ? '#d1d5db' : '#9ca3af'

  return (
    <>
      <div
        className="flex items-center gap-2"
        style={{ marginTop: isPhase ? 12 : 3 }}
      >
        {/* Name — fixed 196px, indented by depth */}
        <div
          className="flex-shrink-0 flex items-center gap-1.5 overflow-hidden"
          style={{ width: 196, paddingLeft: depth * 14 }}
        >
          <span
            className="truncate"
            style={{
              color: nameColor,
              fontWeight: isPhase ? 700 : 400,
              textTransform: isPhase ? 'uppercase' : 'none',
              letterSpacing: isPhase ? '0.07em' : 0,
            }}
            title={name}
          >
            {labelFor(name)}
          </span>
          {extras.map(([k, v]) => (
            <span
              key={k}
              className="flex-shrink-0 px-1 rounded text-[10px]"
              style={{
                color: v === false ? '#f87171' : v === true ? NEON : '#6b7280',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {k}:{String(v)}
            </span>
          ))}
        </div>

        {/* Bar + time */}
        <div className="flex-1 flex items-center gap-2">
          <div
            className="flex-1 rounded-sm overflow-hidden"
            style={{ height: barH, background: TRACK }}
          >
            {time != null && barPct > 0 && (
              <div
                className="h-full rounded-sm transition-all"
                style={{ width: `${barPct}%`, background: NEON, opacity: barAlpha }}
              />
            )}
          </div>
          <span
            className="flex-shrink-0 w-16 text-right tabular-nums"
            style={{ color: isPhase ? NEON : '#6b7280' }}
          >
            {time != null ? fmtTime(time) : '—'}
          </span>
        </div>
      </div>

      {children?.map(([childName, childNode]) => (
        <Row
          key={childName}
          name={childName}
          node={childNode}
          totalTime={totalTime}
          depth={depth + 1}
        />
      ))}
    </>
  )
}
