import { useRef } from 'react'
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { WorkspaceTree } from './WorkspaceTree'
import { EnvironmentSelector } from '../EnvironmentPanel/EnvironmentSelector'
import type { DataExport } from '../../types'

export function Sidebar() {
  const { importWorkspaceData } = useWorkspaceStore()
  const { sidebarSearch, setSidebarSearch } = useUIStore()
  const importRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const { folders, requests, environments } = useWorkspaceStore.getState()
    const data: DataExport = {
      version: '1',
      exportedAt: new Date().toISOString(),
      folders,
      requests,
      environments,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hypersomnia_export.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as DataExport
        if (data.version !== '1') {
          alert('Invalid export file')
          return
        }
        importWorkspaceData({
          folders: data.folders ?? [],
          requests: data.requests ?? [],
          environments: data.environments ?? [],
        })
      } catch {
        alert('Failed to parse import file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Environment Selector */}
      <div className="p-2 border-b border-gray-800 flex-shrink-0">
        <EnvironmentSelector />
      </div>

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
        <WorkspaceTree />
      </div>

      {/* Footer: export/import */}
      <div className="flex gap-1 px-2 py-1.5 border-t border-gray-800 flex-shrink-0">
        <button className="btn-ghost py-1 px-1.5 text-xs flex items-center gap-1 text-gray-500" title="Export data" onClick={handleExport}>
          <ArrowDownTrayIcon className="w-3.5 h-3.5" />Export
        </button>
        <button className="btn-ghost py-1 px-1.5 text-xs flex items-center gap-1 text-gray-500" title="Import data" onClick={() => importRef.current?.click()}>
          <ArrowUpTrayIcon className="w-3.5 h-3.5" />Import
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      </div>
    </div>
  )
}
