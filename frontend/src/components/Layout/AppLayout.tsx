import { useRef, useState, useCallback } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { Sidebar } from '../Sidebar/Sidebar'
import { RequestEditor } from '../RequestEditor/RequestEditor'
import { ResponseViewer } from '../ResponseViewer/ResponseViewer'
import { AIAssistant } from '../AIAssistant/AIAssistant'
import { useUIStore } from '../../store/uiStore'

export function AppLayout() {
  const { sidebarWidth, setSidebarWidth, aiPanelOpen, toggleAiPanel } = useUIStore()
  const [responseHeight, setResponseHeight] = useState(320)

  const sidebarDragRef = useRef(false)
  const responseDragRef = useRef(false)

  const handleSidebarMouseDown = useCallback(() => {
    sidebarDragRef.current = true
    const onMove = (e: MouseEvent) => {
      if (!sidebarDragRef.current) return
      setSidebarWidth(Math.max(180, Math.min(500, e.clientX)))
    }
    const onUp = () => {
      sidebarDragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setSidebarWidth])

  const handleResponseMouseDown = useCallback((e: React.MouseEvent) => {
    responseDragRef.current = true
    const startY = e.clientY
    const startH = responseHeight
    const onMove = (ev: MouseEvent) => {
      if (!responseDragRef.current) return
      const delta = startY - ev.clientY
      setResponseHeight(Math.max(100, Math.min(800, startH + delta)))
    }
    const onUp = () => {
      responseDragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [responseHeight])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div style={{ width: sidebarWidth, flexShrink: 0 }} className="overflow-hidden">
        <Sidebar />
      </div>

      {/* Sidebar resize handle */}
      <div className="resize-handle" onMouseDown={handleSidebarMouseDown} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Request editor */}
        <div className="flex-1 overflow-hidden">
          <RequestEditor />
        </div>

        {/* Response divider */}
        <div
          className="h-1 bg-gray-800 hover:bg-indigo-500 cursor-row-resize transition-colors flex-shrink-0"
          onMouseDown={handleResponseMouseDown}
        />

        {/* Response viewer */}
        <div style={{ height: responseHeight, flexShrink: 0 }} className="overflow-hidden border-t border-gray-800">
          <ResponseViewer />
        </div>
      </div>

      {/* AI panel resize handle */}
      {aiPanelOpen && <div className="resize-handle" />}

      {/* AI panel */}
      {aiPanelOpen && (
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <AIAssistant />
        </div>
      )}

      {/* AI toggle button (when closed) */}
      {!aiPanelOpen && (
        <button
          className="fixed bottom-4 right-4 rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors z-50 font-bold"
          style={{ background: '#3d9108', color: '#f0fde4' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#52b80a')}
          onMouseLeave={e => (e.currentTarget.style.background = '#3d9108')}
          onClick={toggleAiPanel}
          title="Open AI Assistant"
        >
          <SparklesIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
