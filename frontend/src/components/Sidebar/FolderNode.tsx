import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import type { Folder } from '../../types'
import { RequestNode } from './RequestNode'

interface Props {
  folder: Folder
  depth: number
  forceExpand?: boolean
}

export function FolderNode({ folder, depth, forceExpand }: Props) {
  const { folders, requests, createRequest, createFolder, updateFolder, deleteFolder } = useWorkspaceStore()
  const { expandedFolders, toggleFolder } = useUIStore()
  const { sidebarSearch } = useUIStore()

  const isExpanded = forceExpand || expandedFolders.has(folder.id)
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

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button
          className="text-gray-400 hover:text-gray-200 w-4 text-center flex-shrink-0"
          onClick={() => toggleFolder(folder.id)}
        >
          {isExpanded ? '▾' : '▸'}
        </button>
        <span className="text-yellow-400 flex-shrink-0">📁</span>
        <span
          className="flex-1 truncate text-xs text-gray-300"
          onClick={() => toggleFolder(folder.id)}
        >
          {folder.name}
        </span>
        <div className="hidden group-hover:flex gap-0.5">
          <button
            className="btn-ghost text-xs px-1 py-0"
            title="Add request"
            onClick={e => { e.stopPropagation(); const n = prompt('Request name:') ?? 'New Request'; createRequest(folder.workspaceId, n.trim() || 'New Request', folder.id) }}
          >+</button>
          <button
            className="btn-ghost text-xs px-1 py-0"
            title="Add subfolder"
            onClick={e => { e.stopPropagation(); const n = prompt('Folder name:'); if (n?.trim()) createFolder(folder.workspaceId, n.trim(), folder.id) }}
          >📁</button>
          <button
            className="btn-ghost text-xs px-1 py-0"
            title="Rename"
            onClick={e => { e.stopPropagation(); const n = prompt('New name:', folder.name); if (n?.trim()) updateFolder(folder.id, { name: n.trim() }) }}
          >✏️</button>
          <button
            className="btn-ghost text-xs px-1 py-0 text-red-400"
            title="Delete folder"
            onClick={e => { e.stopPropagation(); if (confirm(`Delete folder "${folder.name}" and all its contents?`)) deleteFolder(folder.id) }}
          >🗑</button>
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
