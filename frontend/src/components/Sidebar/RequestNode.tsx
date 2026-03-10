import { useState } from 'react'
import { PencilIcon, DocumentDuplicateIcon, TrashIcon, BugAntIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { getTopLevelFolder } from '../../utils/folders'
import { cpKindFromClusterType } from '../../utils/konnectApi'
import { KonnectDebugModal } from '../Konnect/KonnectDebugModal'
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
  const { requests, folders, activeRequestId, setActiveRequest, deleteRequest, duplicateRequest, updateRequest } = useWorkspaceStore()
  const { setActiveFolderId } = useUIStore()
  const [debugModalOpen, setDebugModalOpen] = useState(false)

  const isActive = activeRequestId === request.id
  const topLevelFolder = getTopLevelFolder(request.id, requests, folders)
  const isKonnectRequest = topLevelFolder?.id.startsWith('konnect-cp-') ?? false
  const isServerless = cpKindFromClusterType(topLevelFolder?.kongCpType) === 'serverless'
  const showDebugOption = isKonnectRequest && !isServerless
  const isDebugEnabled = showDebugOption && request.headers.some(h => h.enabled && h.key === 'X-Kong-Request-Debug')

  return (
    <div
      className={`relative flex items-center gap-1.5 px-2 py-1 cursor-pointer group transition-colors border-l-2 ${isActive ? '' : 'border-transparent hover:bg-gray-800'}`}
      style={isActive
        ? { backgroundColor: 'rgba(111,220,14,0.08)', borderLeftColor: '#6fdc0e', paddingLeft: `${8 + depth * 14}px` }
        : { paddingLeft: `${8 + depth * 14}px` }
      }
      onClick={() => { setActiveRequest(request.id); setActiveFolderId(null) }}
    >
      {debugModalOpen && (
        <KonnectDebugModal requestId={request.id} onClose={() => setDebugModalOpen(false)} />
      )}
      <span className={`text-xs font-bold flex-shrink-0 w-12 text-center ${METHOD_COLORS[request.method] ?? 'text-gray-400'}`}>
        {request.method.slice(0, 3)}
      </span>
      <span className={`flex-1 truncate text-xs ${isActive ? 'text-white' : 'text-gray-300'}`}>
        {request.name}
      </span>
      {isDebugEnabled && (
        <span className="flex-shrink-0 flex items-center rounded px-0.5" style={{ background: '#0d1a00' }}>
          <BugAntIcon className="w-3 h-3" style={{ color: '#6fdc0e' }} title="Debugging active" />
        </span>
      )}
      <div className="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 pr-1 pl-6 invisible group-hover:visible"
        style={{ background: 'linear-gradient(to right, transparent, #1f2937 40%)' }}>
        {showDebugOption && (
          <button
            className="btn-ghost px-1 py-0"
            title={isDebugEnabled ? 'Debugging enabled — click to manage' : 'Enable request debugging'}
            style={isDebugEnabled ? { color: '#6fdc0e' } : undefined}
            onClick={e => { e.stopPropagation(); setDebugModalOpen(true) }}
          >
            <BugAntIcon className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          className="btn-ghost px-1 py-0"
          title="Rename"
          onClick={e => {
            e.stopPropagation()
            const n = prompt('New name:', request.name)
            if (n?.trim()) updateRequest(request.id, { name: n.trim() })
          }}
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <button
          className="btn-ghost px-1 py-0"
          title="Duplicate"
          onClick={e => { e.stopPropagation(); duplicateRequest(request.id) }}
        >
          <DocumentDuplicateIcon className="w-3.5 h-3.5" />
        </button>
        <button
          className="btn-ghost px-1 py-0 text-red-400"
          title="Delete"
          onClick={e => {
            e.stopPropagation()
            if (confirm(`Delete "${request.name}"?`)) deleteRequest(request.id)
          }}
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
