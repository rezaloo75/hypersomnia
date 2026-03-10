import { useRef, useState, useCallback } from 'react'
import { Sidebar } from '../Sidebar/Sidebar'
import { RequestEditor } from '../RequestEditor/RequestEditor'
import { ResponseViewer } from '../ResponseViewer/ResponseViewer'
import { AIAssistant } from '../AIAssistant/AIAssistant'
import { FolderVariablesEditor } from '../FolderEditor/FolderVariablesEditor'
import { RightNavRail } from './RightNavRail'
import { KonnectRoutePanel } from '../KonnectPanel/KonnectRoutePanel'
import { useUIStore } from '../../store/uiStore'

export function AppLayout() {
  const { sidebarWidth, setSidebarWidth, activeRightPanel, activeFolderId } = useUIStore()
  const [responseHeight, setResponseHeight] = useState(() =>
    parseInt(localStorage.getItem('hs_responseHeight') ?? '320', 10)
  )
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    parseInt(localStorage.getItem('hs_rightPanelWidth') ?? '320', 10)
  )

  const sidebarDragRef = useRef(false)
  const responseDragRef = useRef(false)
  const rightPanelDragRef = useRef(false)

  const handleSidebarMouseDown = useCallback(() => {
    sidebarDragRef.current = true
    let currentW = sidebarWidth
    const onMove = (e: MouseEvent) => {
      if (!sidebarDragRef.current) return
      currentW = Math.max(180, Math.min(500, e.clientX))
      setSidebarWidth(currentW)
    }
    const onUp = () => {
      sidebarDragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setSidebarWidth, sidebarWidth])

  const handleResponseMouseDown = useCallback((e: React.MouseEvent) => {
    responseDragRef.current = true
    const startY = e.clientY
    const startH = responseHeight
    let currentH = startH
    const onMove = (ev: MouseEvent) => {
      if (!responseDragRef.current) return
      currentH = Math.max(100, Math.min(800, startH + (startY - ev.clientY)))
      setResponseHeight(currentH)
    }
    const onUp = () => {
      responseDragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem('hs_responseHeight', String(currentH))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [responseHeight])

  const handleRightPanelMouseDown = useCallback((e: React.MouseEvent) => {
    rightPanelDragRef.current = true
    const startX = e.clientX
    const startW = rightPanelWidth
    let currentW = startW
    const onMove = (ev: MouseEvent) => {
      if (!rightPanelDragRef.current) return
      currentW = Math.max(240, Math.min(800, startW + (startX - ev.clientX)))
      setRightPanelWidth(currentW)
    }
    const onUp = () => {
      rightPanelDragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem('hs_rightPanelWidth', String(currentW))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rightPanelWidth])

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
        {/* Request editor or folder variables editor */}
        <div className="flex-1 overflow-hidden">
          {activeFolderId
            ? <FolderVariablesEditor folderId={activeFolderId} />
            : <RequestEditor />}
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

      {/* Right drawer */}
      {activeRightPanel && (
        <>
          <div className="resize-handle" onMouseDown={handleRightPanelMouseDown} />
          <div style={{ width: rightPanelWidth, flexShrink: 0 }} className="overflow-hidden">
            {activeRightPanel === 'ai' && <AIAssistant />}
            {activeRightPanel === 'kong' && <KonnectRoutePanel />}
          </div>
        </>
      )}

      {/* Right nav rail */}
      <RightNavRail />
    </div>
  )
}
