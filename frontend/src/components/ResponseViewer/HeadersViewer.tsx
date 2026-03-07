import { useRef, useState, useCallback } from 'react'

interface Props {
  headers: Record<string, string>
}

export function HeadersViewer({ headers }: Props) {
  const entries = Object.entries(headers)
  const [headerColPct, setHeaderColPct] = useState(40)
  const tableRef = useRef<HTMLTableElement>(null)
  const dragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !tableRef.current) return
      const rect = tableRef.current.getBoundingClientRect()
      const pct = Math.min(80, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100))
      setHeaderColPct(pct)
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  if (entries.length === 0) {
    return <div className="p-4 text-xs text-gray-500">No response headers</div>
  }

  return (
    <div className="overflow-y-auto h-full">
      <table ref={tableRef} className="w-full text-xs table-fixed">
        <colgroup>
          <col style={{ width: `${headerColPct}%` }} />
          <col style={{ width: `${100 - headerColPct}%` }} />
        </colgroup>
        <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
          <tr>
            <th className="text-left px-3 py-2 text-gray-400 font-medium relative">
              Header
              {/* resize handle */}
              <span
                className="absolute right-0 top-0 h-full w-3 flex items-center justify-center cursor-col-resize select-none group"
                onMouseDown={handleMouseDown}
              >
                <span className="w-px h-4 bg-gray-700 group-hover:bg-gray-500 transition-colors" />
              </span>
            </th>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="px-3 py-1.5 text-indigo-300 font-medium truncate">{key}</td>
              <td className="px-3 py-1.5 text-gray-300 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
