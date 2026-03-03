import { InboxIcon } from '@heroicons/react/24/outline'
import { useUIStore } from '../../store/uiStore'
import { StatusBadge } from './StatusBadge'
import { BodyViewer } from './BodyViewer'
import { HeadersViewer } from './HeadersViewer'
import { DebugViewer } from './DebugViewer'
import { HistoryPanel } from './HistoryPanel'

type Tab = 'body' | 'headers' | 'debug'

export function ResponseViewer() {
  const { currentExecution, activeResponseTab, setActiveResponseTab } = useUIStore()

  if (!currentExecution) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-800 flex-shrink-0">
          <HistoryPanel />
        </div>
        <div className="flex items-center justify-center flex-1 text-gray-600">
          <div className="text-center">
            <InboxIcon className="w-10 h-10 mb-2 mx-auto text-gray-700" />
            <p className="text-xs">Send a request to see the response</p>
          </div>
        </div>
      </div>
    )
  }

  const { response, error } = currentExecution
  const tabs: Tab[] = ['body', 'headers', 'debug']

  return (
    <div className="flex flex-col h-full">
      {/* History always visible */}
      <div className="border-b border-gray-800 flex-shrink-0">
        <HistoryPanel />
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <StatusBadge status={response.status} statusText={response.statusText} />
        {response.time > 0 && (
          <span className="text-xs text-gray-400">{response.time}ms</span>
        )}
        {response.size > 0 && (
          <span className="text-xs text-gray-400">{formatSize(response.size)}</span>
        )}
        {error && (
          <span className="text-xs text-red-400">⚠ {error}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-950">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`tab-btn capitalize ${activeResponseTab === tab ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            onClick={() => setActiveResponseTab(tab)}
          >
            {tab}
            {tab === 'headers' && response.headers && (
              <span className="ml-1 text-xs text-gray-500">({Object.keys(response.headers).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeResponseTab === 'body' && <BodyViewer execution={currentExecution} />}
        {activeResponseTab === 'headers' && <HeadersViewer headers={response.headers} />}
        {activeResponseTab === 'debug' && <DebugViewer execution={currentExecution} />}
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
