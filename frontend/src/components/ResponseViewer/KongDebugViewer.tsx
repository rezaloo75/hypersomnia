import { useMemo, useState } from 'react'

const NEON = '#6fdc0e'
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

type UUIDInstance = { id: string; time: number }
type Extra = { key: string; value: unknown }

type RowData = {
  name: string
  node: DebugNode
  depth: number
  startMs: number
  extras: Extra[]
  uuidInstances: UUIDInstance[]
}

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function labelFor(name: string): string {
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

function buildRows(entries: [string, DebugNode][], offset: number, depth: number): RowData[] {
  const rows: RowData[] = []
  let cursor = offset
  for (const [name, node] of entries) {
    const uuidInstances: UUIDInstance[] = []
    const namedChildren: [string, DebugNode][] = []

    if (node.child) {
      for (const [k, v] of sortedEntries(node.child)) {
        if (isUUID(k)) uuidInstances.push({ id: k, time: v.total_time ?? 0 })
        else namedChildren.push([k, v])
      }
    }

    const extras: Extra[] = Object.entries(node)
      .filter(([k]) => k !== 'total_time' && k !== 'child')
      .map(([key, value]) => ({ key, value }))

    rows.push({ name, node, depth, startMs: cursor, extras, uuidInstances })
    if (namedChildren.length) {
      rows.push(...buildRows(namedChildren, cursor, depth + 1))
    }
    cursor += node.total_time ?? 0
  }
  return rows
}

function niceTicks(totalMs: number): number[] {
  const target = 4
  const raw = totalMs / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map(f => f * mag).find(f => f >= raw) ?? raw
  const ticks: number[] = []
  for (let t = 0; t <= totalMs + step * 0.01; t += step) ticks.push(parseFloat(t.toFixed(6)))
  return ticks
}

export function KongDebugViewer({ header }: Props) {
  const data = useMemo<DebugOutput | null>(() => {
    try { return JSON.parse(header) as DebugOutput }
    catch { return null }
  }, [header])

  if (!data?.child) {
    return <div className="p-4 text-xs text-gray-500">Could not parse Kong debug output.</div>
  }

  const allPhases = sortedEntries(data.child)
  const upstreamTime = data.child['upstream']?.total_time ?? null
  const totalTime = allPhases.reduce((s, [, n]) => s + (n.total_time ?? 0), 0)

  const gatewayPhases = allPhases.filter(([name]) => name !== 'upstream')
  const gatewayTime = data.total_time_without_upstream
    ?? gatewayPhases.reduce((s, [, n]) => s + (n.total_time ?? 0), 0)
  const rows = buildRows(gatewayPhases, 0, 0)
  const ticks = niceTicks(gatewayTime)

  const pct = (ms: number) => gatewayTime > 0 ? (ms / gatewayTime) * 100 : 0

  return (
    <div className="h-full overflow-y-auto px-4 py-4 font-mono text-xs">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-5">
        <span className="font-bold text-sm tracking-wide" style={{ color: NEON }}>
          Kong Gateway Trace
        </span>
        {data.request_id && (
          <span className="text-gray-600">id:{data.request_id}</span>
        )}
        {upstreamTime != null && (
          <span className="text-gray-500">
            upstream: <span className="text-gray-300">{fmtTime(upstreamTime)}</span>
          </span>
        )}
        <span className="text-gray-500">
          gateway overhead:{' '}
          <span style={{ color: NEON }} className="font-semibold">{fmtTime(gatewayTime)}</span>
        </span>
        <span className="text-gray-500">
          total: <span className="text-gray-300">{fmtTime(totalTime)}</span>
        </span>
      </div>

      {/* Header row */}
      <div className="flex items-end gap-2 mb-1 pb-1 border-b border-gray-800">
        <div className="flex-shrink-0 text-gray-600" style={{ width: 196 }}>Phase / Action</div>
        <div className="flex-1 relative" style={{ height: 20 }}>
          {ticks.map(t => (
            <span
              key={t}
              className="absolute bottom-0 text-gray-600 select-none"
              style={{ left: `${pct(t)}%`, transform: 'translateX(-50%)', fontSize: 10 }}
            >
              {t === 0 ? '0' : fmtTime(t)}
            </span>
          ))}
          {ticks.map(t => (
            <span
              key={`line-${t}`}
              className="absolute bottom-0"
              style={{ left: `${pct(t)}%`, width: 1, height: 5, background: 'rgba(255,255,255,0.12)' }}
            />
          ))}
        </div>
        <div className="flex-shrink-0 w-16 text-right text-gray-600">Time</div>
      </div>

      {/* Rows */}
      <div>
        {rows.map((row, i) => (
          <TraceRow key={i} row={row} pct={pct} gatewayTime={gatewayTime} />
        ))}
      </div>
    </div>
  )
}

function TraceRow({ row, pct, gatewayTime }: {
  row: RowData
  pct: (ms: number) => number
  gatewayTime: number
}) {
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const duration = row.node.total_time
  const isPhase = row.depth === 0
  const barH = isPhase ? 16 : row.depth === 1 ? 11 : 8
  const barAlpha = isPhase ? 1 : Math.max(0.3, 0.7 - (row.depth - 1) * 0.15)
  const nameColor = isPhase ? NEON : row.depth === 1 ? '#d1d5db' : '#9ca3af'
  const leftPct = pct(row.startMs)
  const widthPct = duration != null && gatewayTime > 0 ? pct(duration) : 0

  const hasTooltip = duration != null || row.extras.length > 0 || row.uuidInstances.length > 0

  return (
    <div
      className="flex items-center gap-2"
      style={{ marginTop: isPhase ? 10 : 2 }}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setCursor(null)}
    >
      {/* Name */}
      <div
        className="flex-shrink-0 flex items-center gap-1.5"
        style={{ width: 196, paddingLeft: row.depth * 14 }}
      >
        <span
          className="truncate min-w-0 flex-1"
          style={{
            color: nameColor,
            fontWeight: isPhase ? 700 : 400,
            textTransform: isPhase ? 'uppercase' : 'none',
            letterSpacing: isPhase ? '0.07em' : 0,
          }}
          title={row.name}
        >
          {labelFor(row.name)}
        </span>
      </div>

      {/* Pathway bar */}
      <div className="flex-1 relative" style={{ height: barH }}>
        {isPhase && (
          <div className="absolute inset-0 rounded-sm" style={{ background: 'rgba(111,220,14,0.05)' }} />
        )}
        {duration != null && (
          <div
            className="absolute h-full rounded-sm"
            style={{
              left: `${leftPct}%`,
              width: widthPct > 0 ? `${widthPct}%` : undefined,
              minWidth: 2,
              background: NEON,
              opacity: barAlpha,
            }}
          />
        )}
      </div>

      {/* Duration */}
      <span
        className="flex-shrink-0 w-16 text-right tabular-nums"
        style={{ color: isPhase ? NEON : '#6b7280' }}
      >
        {duration != null ? fmtTime(duration) : '—'}
      </span>

      {/* Cursor-tracked tooltip */}
      {cursor && hasTooltip && (
        <div
          className="fixed z-50 rounded border border-gray-700 bg-gray-900 px-2.5 py-2 shadow-xl pointer-events-none"
          style={{ left: cursor.x + 14, top: cursor.y + 14, fontSize: 11, minWidth: 160 }}
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-gray-300 font-semibold">{labelFor(row.name)}</span>
            {duration != null && (
              <span style={{ color: NEON }} className="tabular-nums">{fmtTime(duration)}</span>
            )}
          </div>
          {row.extras.map(({ key, value }) => (
            <div key={key} className="flex items-center gap-2 leading-5">
              <span className="text-gray-500">{key}</span>
              <span style={{ color: value === false ? '#f87171' : value === true ? NEON : '#9ca3af' }}>
                {String(value)}
              </span>
            </div>
          ))}
          {row.uuidInstances.map(({ id, time }) => (
            <div key={id} className="flex items-center gap-2 leading-5 mt-0.5">
              <span className="text-gray-600 font-mono" style={{ fontSize: 10 }}>{id}</span>
              <span style={{ color: NEON }} className="tabular-nums">{fmtTime(time)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
