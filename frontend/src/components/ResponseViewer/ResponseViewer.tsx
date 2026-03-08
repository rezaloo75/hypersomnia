import { useEffect, useRef, useState, useCallback } from 'react'
import { InboxIcon } from '@heroicons/react/24/outline'
import { useUIStore } from '../../store/uiStore'
import { StatusBadge } from './StatusBadge'
import { BodyViewer } from './BodyViewer'
import { HeadersViewer } from './HeadersViewer'
import { DebugViewer } from './DebugViewer'
import { HistoryPanel } from './HistoryPanel'
import { KongDebugViewer } from './KongDebugViewer'

const KONG_DEBUG_HEADER = 'x-kong-request-debug-output'
const NEON = '#6fdc0e'

export function ResponseViewer() {
  const { currentExecution, activeResponseTab, setActiveResponseTab } = useUIStore()
  const [historyHeight, setHistoryHeight] = useState(180)
  const dragRef = useRef(false)

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = true
    const startY = e.clientY
    const startH = historyHeight
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setHistoryHeight(Math.max(36, Math.min(500, startH + (ev.clientY - startY))))
    }
    const onUp = () => {
      dragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [historyHeight])

  const kongDebugHeader = currentExecution?.response.headers?.[KONG_DEBUG_HEADER]

  // If on kong tab but new response has no debug header, fall back to body
  useEffect(() => {
    if (activeResponseTab === 'kong' && !kongDebugHeader) {
      setActiveResponseTab('body')
    }
  }, [currentExecution, kongDebugHeader, activeResponseTab, setActiveResponseTab])

  if (!currentExecution) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 overflow-hidden" style={{ height: historyHeight }}>
          <HistoryPanel />
        </div>
        <div
          className="h-1 bg-gray-800 hover:bg-indigo-500 cursor-row-resize transition-colors flex-shrink-0"
          onMouseDown={handleDividerMouseDown}
        />
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

  return (
    <div className="flex flex-col h-full">
      {/* History panel */}
      <div className="flex-shrink-0 overflow-hidden" style={{ height: historyHeight }}>
        <HistoryPanel />
      </div>

      {/* Draggable divider */}
      <div
        className="h-1 bg-gray-800 hover:bg-indigo-500 cursor-row-resize transition-colors flex-shrink-0"
        onMouseDown={handleDividerMouseDown}
      />

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
        {(['body', 'headers', 'debug'] as const).map(tab => (
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
        {kongDebugHeader && (
          <button
            className={`tab-btn ${activeResponseTab === 'kong' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            onClick={() => setActiveResponseTab('kong')}
            style={activeResponseTab === 'kong' ? { color: NEON, borderBottomColor: NEON } : { color: NEON, opacity: 0.6 }}
          >
            Kong
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeResponseTab === 'body' && <BodyViewer execution={currentExecution} />}
        {activeResponseTab === 'headers' && <HeadersViewer headers={response.headers} />}
        {activeResponseTab === 'debug' && <DebugViewer execution={currentExecution} />}
        {activeResponseTab === 'kong' && kongDebugHeader && <KongDebugViewer header={kongDebugHeader} />}
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
