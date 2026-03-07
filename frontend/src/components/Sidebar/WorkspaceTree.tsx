import { useState } from 'react'
import { FolderPlusIcon, PlusIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import type { Folder, Request } from '../../types'
import { FolderNode } from './FolderNode'
import { RequestNode } from './RequestNode'
import { OpenAPIImport } from './OpenAPIImport'

export function WorkspaceTree() {
  const { folders, requests, createFolder, createRequest } = useWorkspaceStore()
  const { sidebarSearch } = useUIStore()
  const [showImport, setShowImport] = useState(false)

  const rootFolders = folders.filter(f => !f.parentId)
  const rootRequests = requests.filter(r => !r.folderId)

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

  const visibleRootFolders = isSearching ? rootFolders.filter(folderHasMatch) : rootFolders
  const visibleRootRequests = isSearching ? rootRequests.filter(matchesSearch) : rootRequests

  const isEmpty = !isSearching && folders.length === 0 && requests.length === 0

  return (
    <div className="py-1">
      {/* Actions */}
      <div className="flex flex-col gap-1.5 px-2 mb-2">
        <button
          className="btn-secondary flex items-center justify-center gap-1.5 py-1.5 text-xs w-full"
          title="New Request"
          onClick={() => {
            const name = prompt('Request name:') ?? 'New Request'
            createRequest(name.trim() || 'New Request')
          }}
        >
          <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>New Request</span>
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="flex items-center justify-center gap-1 py-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            style={{ border: '1px solid #2a2a2a' }}
            title="New Folder"
            onClick={() => {
              const name = prompt('Folder name:')
              if (name?.trim()) createFolder(name.trim())
            }}
          >
            <FolderPlusIcon className="w-3 h-3 flex-shrink-0" />
            <span>Folder</span>
          </button>
          <button
            className="flex items-center justify-center gap-1 py-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            style={{ border: '1px solid #2a2a2a' }}
            title="Import OpenAPI"
            onClick={() => setShowImport(v => !v)}
          >
            <ArrowUpTrayIcon className="w-3 h-3 flex-shrink-0" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {showImport && (
        <div className="px-2 mb-2">
          <OpenAPIImport onClose={() => setShowImport(false)} />
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

      {isSearching && visibleRootFolders.length === 0 && visibleRootRequests.length === 0 && (
        <div className="text-xs text-gray-500 px-4 py-2">No results</div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center px-4 py-8 gap-4">
          <p className="text-xs text-gray-500 text-center">No requests yet. Create your first request to get started.</p>
          <button
            className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
            onClick={() => {
              const name = prompt('Request name:') ?? 'New Request'
              createRequest(name.trim() || 'New Request')
            }}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Request
          </button>
        </div>
      )}
    </div>
  )
}
