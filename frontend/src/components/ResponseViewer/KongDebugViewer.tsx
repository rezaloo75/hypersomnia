import { useMemo } from 'react'

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

type RowData = {
  name: string
  node: DebugNode
  depth: number
  startMs: number
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

function buildRows(entries: [string, DebugNode][], offset: number, depth: number): RowData[] {
  const rows: RowData[] = []
  let cursor = offset
  for (const [name, node] of entries) {
    rows.push({ name, node, depth, startMs: cursor })
    if (node.child) {
      rows.push(...buildRows(sortedEntries(node.child), cursor, depth + 1))
    }
    cursor += node.total_time ?? 0
  }
  return rows
}

/** Pick 4–5 nice round tick values spanning 0..totalMs */
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

  // Exclude upstream from the chart — it overwhelms gateway phases
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
            upstream:{' '}
            <span className="text-gray-300">{fmtTime(upstreamTime)}</span>
          </span>
        )}
        <span className="text-gray-500">
          gateway overhead:{' '}
          <span style={{ color: NEON }} className="font-semibold">{fmtTime(gatewayTime)}</span>
        </span>
        <span className="text-gray-500">
          total:{' '}
          <span className="text-gray-300">{fmtTime(totalTime)}</span>
        </span>
      </div>

      {/* Header row: name col + time ruler + time label col */}
      <div className="flex items-end gap-2 mb-1 pb-1 border-b border-gray-800">
        <div className="flex-shrink-0 text-gray-600" style={{ width: 196 }}>Phase / Action</div>
        {/* Ruler */}
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
          {/* tick lines */}
          {ticks.map(t => (
            <span
              key={`line-${t}`}
              className="absolute bottom-0"
              style={{
                left: `${pct(t)}%`,
                width: 1,
                height: 5,
                background: 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>
        <div className="flex-shrink-0 w-16 text-right text-gray-600">Time</div>
      </div>

      {/* Pathway rows */}
      <div>
        {rows.map((row, i) => {
          const duration = row.node.total_time
          const isPhase = row.depth === 0
          const barH = isPhase ? 16 : row.depth === 1 ? 11 : 8
          const barAlpha = isPhase ? 1 : Math.max(0.3, 0.7 - (row.depth - 1) * 0.15)
          const nameColor = isPhase ? NEON : row.depth === 1 ? '#d1d5db' : '#9ca3af'
          const extras = Object.entries(row.node).filter(([k]) => k !== 'total_time' && k !== 'child')
          const leftPct = pct(row.startMs)
          const widthPct = duration != null && totalTime > 0 ? pct(duration) : 0

          return (
            <div
              key={i}
              className="flex items-center gap-2"
              style={{ marginTop: isPhase ? 10 : 2 }}
            >
              {/* Name */}
              <div
                className="flex-shrink-0 flex items-center gap-1.5 overflow-hidden"
                style={{ width: 196, paddingLeft: row.depth * 14 }}
              >
                <span
                  className="truncate"
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

              {/* Pathway bar — absolutely positioned on shared timeline */}
              <div className="flex-1 relative" style={{ height: barH }}>
                {/* faint track for phase rows */}
                {isPhase && (
                  <div
                    className="absolute inset-0 rounded-sm"
                    style={{ background: 'rgba(111,220,14,0.05)' }}
                  />
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
                    title={duration != null ? fmtTime(duration) : undefined}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
