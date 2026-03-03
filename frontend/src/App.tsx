import { useEffect } from 'react'
import { AppLayout } from './components/Layout/AppLayout'
import { useWorkspaceStore } from './store/workspaceStore'

function App() {
  const { workspaces, createWorkspace, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore()

  // Create a default workspace on first load
  useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace('My Workspace')
    } else if (!activeWorkspaceId && workspaces.length > 0) {
      setActiveWorkspace(workspaces[0].id)
    }
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-950">
      {/* Top bar */}
      <header className="h-10 flex items-center px-4 gap-3 flex-shrink-0 border-b" style={{ background: '#0d0d0d', borderColor: '#1a1a1a' }}>
        <div className="flex items-center gap-2">
          {/* Kong-style logo mark */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 2L3 7v6l7 5 7-5V7L10 2z" fill="#6fdc0e" fillOpacity="0.9"/>
            <path d="M10 5l-4.5 3.2v3.6L10 15l4.5-3.2V8.2L10 5z" fill="#0a0a0a"/>
          </svg>
          <span className="font-bold text-sm tracking-wide" style={{ color: '#6fdc0e' }}>Hypersomnia</span>
          <span className="text-xs px-1.5 py-0.5 rounded text-gray-400" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>v0.1</span>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 overflow-hidden">
        <AppLayout />
      </div>
    </div>
  )
}

export default App
