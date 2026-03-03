import { AppLayout } from './components/Layout/AppLayout'

function App() {

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-950">
      {/* Top bar */}
      <header className="h-10 flex items-center px-4 gap-3 flex-shrink-0 border-b" style={{ background: '#0d0d0d', borderColor: '#1a1a1a' }}>
        <div className="flex items-center gap-2">
          {/* Insomnia-style icon in Kong green */}
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15.5" fill="#0a0a0a"/>
            <path d="M16 0C7.163 0 0 7.163 0 16C0 24.837 7.163 32 16 32C24.837 32 32 24.837 32 16C32 7.163 24.837 0 16 0ZM16 1.627C23.938 1.627 30.373 8.062 30.373 16C30.373 23.938 23.938 30.373 16 30.373C8.062 30.373 1.627 23.938 1.627 16C1.627 8.062 8.062 1.627 16 1.627Z" fill="#6fdc0e"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M16.181 4.61C22.471 4.61 27.571 9.71 27.571 16C27.571 22.29 22.471 27.39 16.181 27.39C9.89 27.39 4.791 22.29 4.791 16C4.791 14.463 5.096 12.997 5.648 11.659C6.454 12.756 7.754 13.469 9.22 13.469C11.667 13.469 13.65 11.486 13.65 9.04C13.65 7.573 12.937 6.273 11.839 5.467C13.177 4.915 14.644 4.61 16.181 4.61Z" fill="#6fdc0e"/>
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
