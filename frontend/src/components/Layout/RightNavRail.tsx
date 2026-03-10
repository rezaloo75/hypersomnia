import { SparklesIcon } from '@heroicons/react/24/outline'
import { useUIStore } from '../../store/uiStore'

const NEON = '#6fdc0e'

function KonnectIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  // Two connected bold "N" letters with "/" diagonal (the Konnect logo mark)
  // Each N: left bar | "/" diagonal | right bar
  // N1 occupies x=0–12, N2 x=10–22 (sharing the middle bar region)
  return (
    <svg viewBox="0 0 22 16" fill="currentColor" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      {/* N1: left-bar(0-3) + diagonal(3,16→9,0) + right-bar(9-12) */}
      <polygon points="0,16 0,0 3,0 3,10 9,0 12,0 12,16 9,16 9,6 3,16" />
      {/* N2: left-bar(10-13) + diagonal(13,16→19,0) + right-bar(19-22) */}
      <polygon points="10,16 10,0 13,0 13,10 19,0 22,0 22,16 19,16 19,6 13,16" />
    </svg>
  )
}

interface NavItem {
  id: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  color: string
}

const ITEMS: NavItem[] = [
  { id: 'ai', icon: SparklesIcon, label: 'AI Assistant', color: '#a78bfa' },
  { id: 'kong', icon: KonnectIcon, label: 'Kong Konnect', color: '#6fdc0e' },
]

export function RightNavRail() {
  const { activeRightPanel, toggleRightPanel } = useUIStore()

  return (
    <div
      className="flex flex-col items-center py-2 flex-shrink-0"
      style={{ width: 44, background: '#111111', borderLeft: '1px solid #1a1a1a' }}
    >
      {ITEMS.map(({ id, icon: Icon, label, color }) => {
        const isActive = activeRightPanel === id
        return (
          <button
            key={id}
            title={label}
            onClick={() => toggleRightPanel(id)}
            className="relative flex items-center justify-center rounded-lg transition-colors"
            style={{
              width: 32,
              height: 32,
              marginTop: 4,
              background: isActive ? `${color}22` : 'transparent',
              color: isActive ? color : '#6b7280',
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isActive ? `${color}22` : 'transparent'
            }}
          >
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                style={{ width: 3, height: 20, background: color }}
              />
            )}
            <Icon className="w-4 h-4" />
          </button>
        )
      })}
    </div>
  )
}
