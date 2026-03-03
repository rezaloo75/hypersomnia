import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import type { RequestExecution } from '../../types'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
}

export function HistoryPanel() {
  const { history, clearHistory } = useWorkspaceStore()
  const { setCurrentExecution } = useUIStore()

  function select(entry: RequestExecution) {
    setCurrentExecution(entry)
  }

  return (
    <div className="max-h-64 overflow-y-auto bg-gray-950">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400">History</span>
        <button className="btn-ghost text-xs" onClick={clearHistory}>Clear</button>
      </div>
      {history.map(entry => (
        <div
          key={entry.id}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 text-xs"
          onClick={() => select(entry)}
        >
          <span className={`font-bold w-14 flex-shrink-0 ${METHOD_COLORS[entry.request.method] ?? 'text-gray-400'}`}>
            {entry.request.method}
          </span>
          <span className={`w-10 flex-shrink-0 font-semibold ${entry.response.status < 400 ? 'text-green-400' : 'text-red-400'}`}>
            {entry.response.status || 'ERR'}
          </span>
          <span className="flex-1 truncate text-gray-300">{entry.requestName}</span>
          <span className="text-gray-500 flex-shrink-0">{entry.response.time}ms</span>
          <span className="text-gray-600 flex-shrink-0 w-24 text-right">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
      {history.length === 0 && (
        <div className="p-4 text-xs text-gray-500 text-center">No history yet</div>
      )}
    </div>
  )
}
