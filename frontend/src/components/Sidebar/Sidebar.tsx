import { useState, useRef } from 'react'
import { PencilIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { WorkspaceTree } from './WorkspaceTree'
import { EnvironmentSelector } from '../EnvironmentPanel/EnvironmentSelector'
import type { WorkspaceExport } from '../../types'

export function Sidebar() {
  const {
    workspaces, activeWorkspaceId,
    createWorkspace, setActiveWorkspace, updateWorkspace, deleteWorkspace,
    importWorkspaceData,
  } = useWorkspaceStore()
  const { sidebarSearch, setSidebarSearch } = useUIStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showNewWs, setShowNewWs] = useState(false)
  const [newWsName, setNewWsName] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId)

  function handleCreateWorkspace() {
    if (!newWsName.trim()) return
    createWorkspace(newWsName.trim())
    setNewWsName('')
    setShowNewWs(false)
  }

  function handleExport() {
    if (!activeWs) return
    const { folders, requests, environments } = useWorkspaceStore.getState()
    const data: WorkspaceExport = {
      version: '1',
      exportedAt: new Date().toISOString(),
      workspace: activeWs,
      folders: folders.filter(f => f.workspaceId === activeWs.id),
      requests: requests.filter(r => r.workspaceId === activeWs.id),
      environments: environments.filter(e => e.workspaceId === activeWs.id),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeWs.name.replace(/\s+/g, '_')}_export.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as WorkspaceExport
        if (data.version !== '1' || !data.workspace) {
          alert('Invalid workspace export file')
          return
        }
        importWorkspaceData(data)
      } catch {
        alert('Failed to parse import file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Workspace Selector */}
      <div className="p-2 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1 mb-2">
          <select
            className="input-base flex-1 text-xs py-1"
            value={activeWorkspaceId ?? ''}
            onChange={e => setActiveWorkspace(e.target.value || null)}
          >
            {workspaces.length === 0 && <option value="">No workspaces</option>}
            {workspaces.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            className="btn-ghost text-xs px-1.5"
            title="New workspace"
            onClick={() => setShowNewWs(v => !v)}
          >+</button>
        </div>

        {showNewWs && (
          <div className="flex gap-1 mb-2">
            <input
              className="input-base flex-1 text-xs py-1"
              placeholder="Workspace name"
              value={newWsName}
              onChange={e => setNewWsName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateWorkspace(); if (e.key === 'Escape') setShowNewWs(false) }}
              autoFocus
            />
            <button className="btn-primary text-xs py-1" onClick={handleCreateWorkspace}>Create</button>
          </div>
        )}

        {activeWs && (
          <div className="flex gap-1">
            {editingId === activeWs.id ? (
              <input
                className="input-base flex-1 text-xs py-1"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { updateWorkspace(activeWs.id, { name: editName }); setEditingId(null) }
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
              />
            ) : (
              <button
                className="btn-ghost text-xs py-1 flex-1 text-left truncate"
                title="Rename workspace"
                onClick={() => { setEditingId(activeWs.id); setEditName(activeWs.name) }}
              >
                <PencilIcon className="w-3.5 h-3.5 inline mr-1" />Rename
              </button>
            )}
            <button className="btn-ghost py-1 px-1.5" title="Export workspace" onClick={handleExport}><ArrowDownTrayIcon className="w-3.5 h-3.5" /></button>
            <button className="btn-ghost py-1 px-1.5" title="Import workspace" onClick={() => importRef.current?.click()}><ArrowUpTrayIcon className="w-3.5 h-3.5" /></button>
            <button
              className="btn-ghost py-1 px-1.5 text-red-400 hover:text-red-300"
              title="Delete workspace"
              onClick={() => { if (confirm(`Delete workspace "${activeWs.name}"?`)) deleteWorkspace(activeWs.id) }}
            ><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      </div>

      {/* Environment Selector */}
      {activeWorkspaceId && (
        <div className="p-2 border-b border-gray-800 flex-shrink-0">
          <EnvironmentSelector workspaceId={activeWorkspaceId} />
        </div>
      )}

      {/* Search */}
      <div className="p-2 border-b border-gray-800 flex-shrink-0">
        <input
          className="input-base w-full text-xs py-1"
          placeholder="Search requests..."
          value={sidebarSearch}
          onChange={e => setSidebarSearch(e.target.value)}
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {activeWorkspaceId ? (
          <WorkspaceTree workspaceId={activeWorkspaceId} />
        ) : (
          <div className="p-4 text-gray-500 text-xs text-center">
            Create or select a workspace to get started
          </div>
        )}
      </div>
    </div>
  )
}
