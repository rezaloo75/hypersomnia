import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
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
  const { currentExecution, setCurrentExecution } = useUIStore()
  const [collapsed, setCollapsed] = useState(false)

  function select(entry: RequestExecution) {
    setCurrentExecution(entry)
  }

  return (
    <div className="bg-gray-950 h-full flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-gray-800 cursor-pointer select-none hover:bg-gray-900 transition-colors flex-shrink-0"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
          {collapsed
            ? <ChevronRightIcon className="w-3.5 h-3.5" />
            : <ChevronDownIcon className="w-3.5 h-3.5" />
          }
          History {history.length > 0 && <span className="text-gray-600">({history.length})</span>}
        </div>
        {!collapsed && (
          <button
            className="btn-ghost text-xs"
            onClick={(e) => { e.stopPropagation(); clearHistory() }}
          >
            Clear
          </button>
        )}
      </div>
      {!collapsed && <div className="flex-1 overflow-y-auto">
        {history.map(entry => (
        <div
          key={entry.id}
          className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 text-xs ${currentExecution?.id === entry.id ? 'bg-gray-800' : ''}`}
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
      </div>}
    </div>
  )
}
