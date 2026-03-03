import { useWorkspaceStore } from '../../store/workspaceStore'
import type { Request } from '../../types'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-pink-400',
}

interface Props {
  request: Request
  depth: number
}

export function RequestNode({ request, depth }: Props) {
  const { activeRequestId, setActiveRequest, deleteRequest, duplicateRequest, updateRequest } = useWorkspaceStore()
  const isActive = activeRequestId === request.id

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer group transition-colors border-l-2 ${isActive ? '' : 'border-transparent hover:bg-gray-800'}`}
      style={isActive
        ? { backgroundColor: 'rgba(111,220,14,0.08)', borderLeftColor: '#6fdc0e', paddingLeft: `${8 + depth * 14}px` }
        : { paddingLeft: `${8 + depth * 14}px` }
      }
      onClick={() => setActiveRequest(request.id)}
    >
      <span className={`text-xs font-bold flex-shrink-0 w-12 text-center ${METHOD_COLORS[request.method] ?? 'text-gray-400'}`}>
        {request.method.slice(0, 3)}
      </span>
      <span className={`flex-1 truncate text-xs ${isActive ? 'text-white' : 'text-gray-300'}`}>
        {request.name}
      </span>
      <div className="hidden group-hover:flex gap-0.5">
        <button
          className="btn-ghost text-xs px-1 py-0"
          title="Rename"
          onClick={e => {
            e.stopPropagation()
            const n = prompt('New name:', request.name)
            if (n?.trim()) updateRequest(request.id, { name: n.trim() })
          }}
        >✏️</button>
        <button
          className="btn-ghost text-xs px-1 py-0"
          title="Duplicate"
          onClick={e => { e.stopPropagation(); duplicateRequest(request.id) }}
        >⧉</button>
        <button
          className="btn-ghost text-xs px-1 py-0 text-red-400"
          title="Delete"
          onClick={e => {
            e.stopPropagation()
            if (confirm(`Delete "${request.name}"?`)) deleteRequest(request.id)
          }}
        >🗑</button>
      </div>
    </div>
  )
}
