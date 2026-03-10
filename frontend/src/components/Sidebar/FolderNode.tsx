
import { useState } from 'react'
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon, PlusIcon, FolderPlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { cpKindFromClusterType } from '../../utils/konnectApi'
import type { Folder } from '../../types'
import { RequestNode } from './RequestNode'
import kongLogo from '../../assets/kong-logo.jpeg'

interface Props {
  folder: Folder
  depth: number
  forceExpand?: boolean
}

const CP_TYPE_LABELS: Record<string, string> = {
  serverless: 'Serverless (Cloud)',
  dedicated:  'Dedicated (Cloud)',
  hybrid:     'Hybrid',
}

export function FolderNode({ folder, depth, forceExpand }: Props) {
  const { folders, requests, createRequest, createFolder, updateFolder, deleteFolder } = useWorkspaceStore()
  const { expandedFolders, toggleFolder, expandFolder, activeFolderId, setActiveFolderId } = useUIStore()
  const { sidebarSearch } = useUIStore()
  const [tooltip, setTooltip] = useState<{ top: number; left: number } | null>(null)

  const isExpanded = forceExpand || expandedFolders.has(folder.id)
  const isActive = activeFolderId === folder.id
  const childFolders = folders.filter(f => f.parentId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder)
  const childRequests = requests.filter(r => r.folderId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder)

  const searchLower = sidebarSearch.toLowerCase()
  const isSearching = searchLower.length > 0

  const visibleChildFolders = isSearching
    ? childFolders.filter(f => hasMatch(f, folders, requests, searchLower))
    : childFolders
  const visibleChildRequests = isSearching
    ? childRequests.filter(r => r.name.toLowerCase().includes(searchLower))
    : childRequests

  const hasVariables = depth === 0 && folder.variables && Object.keys(folder.variables).length > 0
  const isKonnect = depth === 0 && folder.id.startsWith('konnect-cp-')

  const cpKind = isKonnect ? cpKindFromClusterType(folder.kongCpType) : null
  const cpId = isKonnect ? folder.id.replace('konnect-cp-', '') : null
  const proxyUrl = folder.variables?.baseUrl

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    if (!isKonnect) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ top: rect.top, left: rect.right + 8 })
  }

  return (
    <div>
      {tooltip && isKonnect && (
        <div
          className="fixed z-50 rounded-lg shadow-2xl text-xs pointer-events-none"
          style={{
            top: tooltip.top,
            left: tooltip.left,
            background: '#161616',
            border: '1px solid #2a2a2a',
            minWidth: 220,
            maxWidth: 320,
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Tooltip header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#222' }}>
            <img src={kongLogo} alt="Konnect" className="w-3.5 h-3.5 rounded-sm opacity-80 flex-shrink-0" />
            <span className="text-gray-300 font-medium">Kong Konnect</span>
          </div>
          {/* Tooltip rows */}
          <div className="px-3 py-2.5 flex flex-col gap-1.5">
            <div className="flex gap-2">
              <span className="text-gray-600 w-16 flex-shrink-0">Type</span>
              <span className="text-gray-200">{CP_TYPE_LABELS[cpKind!] ?? cpKind}</span>
            </div>
            {proxyUrl ? (
              <div className="flex gap-2">
                <span className="text-gray-600 w-16 flex-shrink-0">Proxy</span>
                <span className="text-gray-200 font-mono truncate" title={proxyUrl}>{proxyUrl}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <span className="text-gray-600 w-16 flex-shrink-0">Proxy</span>
                <span className="text-gray-500 italic">not set</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-600 w-16 flex-shrink-0">CP ID</span>
              <span className="text-gray-500 font-mono truncate" title={cpId!}>{cpId}</span>
            </div>
          </div>
        </div>
      )}

      <div
        className={`relative flex items-center gap-1 px-2 py-1 hover:bg-gray-800 cursor-pointer group ${isActive ? 'bg-gray-800' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip(null)}
      >
        <button
          className="text-gray-400 hover:text-gray-200 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id) }}
        >
          {isExpanded
            ? <ChevronDownIcon className="w-3.5 h-3.5" />
            : <ChevronRightIcon className="w-3.5 h-3.5" />}
        </button>
        <button
          className="flex-shrink-0"
          style={{ color: '#6fdc0e' }}
          onClick={() => { setActiveFolderId(folder.id); expandFolder(folder.id) }}
        >
          {isExpanded
            ? <FolderOpenIcon className="w-4 h-4" />
            : <FolderIcon className="w-4 h-4" />}
        </button>
        <span
          className="flex-1 truncate text-xs text-gray-300"
          onClick={() => { setActiveFolderId(folder.id); expandFolder(folder.id) }}
        >
          {folder.name}
        </span>
        {isKonnect && (
          <img src={kongLogo} alt="Konnect" className="w-3.5 h-3.5 rounded-sm flex-shrink-0 opacity-80" />
        )}
        {hasVariables && (
          <span className="text-gray-600 text-xs font-mono flex-shrink-0 select-none" title="Has variables">{'{…}'}</span>
        )}
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-0.5 pr-1 pl-6 invisible group-hover:visible"
          style={{ background: 'linear-gradient(to right, transparent, #1f2937 40%)' }}>
          <button
            className="btn-ghost px-1 py-0"
            title="Add request"
            onClick={e => { e.stopPropagation(); const n = prompt('Request name:') ?? 'New Request'; createRequest(n.trim() || 'New Request', folder.id) }}
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn-ghost px-1 py-0"
            title="Add subfolder"
            onClick={e => { e.stopPropagation(); const n = prompt('Folder name:'); if (n?.trim()) createFolder(n.trim(), folder.id) }}
          >
            <FolderPlusIcon className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn-ghost px-1 py-0"
            title="Rename"
            onClick={e => { e.stopPropagation(); const n = prompt('New name:', folder.name); if (n?.trim()) updateFolder(folder.id, { name: n.trim() }) }}
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn-ghost px-1 py-0 text-red-400"
            title="Delete folder"
            onClick={e => { e.stopPropagation(); if (confirm(`Delete folder "${folder.name}" and all its contents?`)) deleteFolder(folder.id) }}
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div>
          {visibleChildFolders.map(f => (
            <FolderNode key={f.id} folder={f} depth={depth + 1} forceExpand={forceExpand} />
          ))}
          {visibleChildRequests.map(r => (
            <RequestNode key={r.id} request={r} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function hasMatch(folder: Folder, allFolders: Folder[], allRequests: import('../../types').Request[], q: string): boolean {
  if (folder.name.toLowerCase().includes(q)) return true
  const childFolders = allFolders.filter(f => f.parentId === folder.id)
  const childRequests = allRequests.filter(r => r.folderId === folder.id)
  return childFolders.some(f => hasMatch(f, allFolders, allRequests, q)) || childRequests.some(r => r.name.toLowerCase().includes(q))
}
