import { useState } from 'react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import type { Folder, Request } from '../../types'
import { FolderNode } from './FolderNode'
import { RequestNode } from './RequestNode'
import { OpenAPIImport } from './OpenAPIImport'

interface Props {
  workspaceId: string
}

export function WorkspaceTree({ workspaceId }: Props) {
  const { folders, requests, createFolder, createRequest } = useWorkspaceStore()
  const { sidebarSearch } = useUIStore()
  const [showImport, setShowImport] = useState(false)

  const wsFolder = folders.filter(f => f.workspaceId === workspaceId && !f.parentId)
  const wsRequests = requests.filter(r => r.workspaceId === workspaceId && !r.folderId)

  const searchLower = sidebarSearch.toLowerCase()
  const isSearching = searchLower.length > 0

  function matchesSearch(item: Folder | Request): boolean {
    return item.name.toLowerCase().includes(searchLower)
  }

  function folderHasMatch(folder: Folder): boolean {
    if (matchesSearch(folder)) return true
    const childFolders = folders.filter(f => f.parentId === folder.id)
    const childRequests = requests.filter(r => r.folderId === folder.id)
    return childFolders.some(folderHasMatch) || childRequests.some(matchesSearch)
  }

  const visibleRootFolders = isSearching ? wsFolder.filter(folderHasMatch) : wsFolder
  const visibleRootRequests = isSearching ? wsRequests.filter(matchesSearch) : wsRequests

  return (
    <div className="py-1">
      {/* Actions */}
      <div className="flex gap-1 px-2 mb-2">
        <button
          className="btn-ghost text-xs flex-1"
          onClick={() => {
            const name = prompt('Folder name:')
            if (name?.trim()) createFolder(workspaceId, name.trim())
          }}
        >
          + Folder
        </button>
        <button
          className="btn-ghost text-xs flex-1"
          onClick={() => {
            const name = prompt('Request name:') ?? 'New Request'
            createRequest(workspaceId, name.trim() || 'New Request')
          }}
        >
          + Request
        </button>
        <button
          className="btn-ghost text-xs"
          title="Import OpenAPI"
          onClick={() => setShowImport(v => !v)}
        >
          ⬆ API
        </button>
      </div>

      {showImport && (
        <div className="px-2 mb-2">
          <OpenAPIImport workspaceId={workspaceId} onClose={() => setShowImport(false)} />
        </div>
      )}

      {/* Root folders */}
      {visibleRootFolders
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(folder => (
          <FolderNode key={folder.id} folder={folder} depth={0} forceExpand={isSearching} />
        ))}

      {/* Root requests */}
      {visibleRootRequests
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(request => (
          <RequestNode key={request.id} request={request} depth={0} />
        ))}

      {visibleRootFolders.length === 0 && visibleRootRequests.length === 0 && (
        <div className="text-xs text-gray-500 px-4 py-2">
          {isSearching ? 'No results' : 'No requests yet'}
        </div>
      )}
    </div>
  )
}
