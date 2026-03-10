import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { PlusIcon, XMarkIcon, FolderOpenIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'

interface Props {
  folderId: string
}

interface Row { id: string; key: string; value: string }

const SECRET_RE = /^(token|secret|password|key|api_?key|auth)/i

export function FolderVariablesEditor({ folderId }: Props) {
  const { folders, updateFolder } = useWorkspaceStore()
  const folder = folders.find(f => f.id === folderId)

  const [rows, setRows] = useState<Row[]>(() => {
    if (!folder?.variables) return []
    return Object.entries(folder.variables).map(([key, value]) => ({ id: uuid(), key, value }))
  })

  // Re-sync rows if folderId changes
  const [lastFolderId, setLastFolderId] = useState(folderId)
  if (lastFolderId !== folderId) {
    setLastFolderId(folderId)
    const vars = folder?.variables ?? {}
    setRows(Object.entries(vars).map(([key, value]) => ({ id: uuid(), key, value })))
  }

  if (!folder) return null

  function addRow() {
    setRows(r => [...r, { id: uuid(), key: '', value: '' }])
  }

  function removeRow(id: string) {
    setRows(r => r.filter(row => row.id !== id))
    // auto-save on remove
    saveWithRows(rows.filter(row => row.id !== id))
  }

  function updateRow(id: string, field: 'key' | 'value', val: string) {
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: val } : row))
  }

  function saveWithRows(r: Row[]) {
    const variables: Record<string, string> = {}
    for (const row of r) {
      if (row.key.trim()) variables[row.key.trim()] = row.value
    }
    updateFolder(folderId, { variables })
  }

  function save() {
    saveWithRows(rows)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-950 flex-shrink-0">
        <FolderOpenIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#6fdc0e' }} />
        <span className="text-sm font-medium text-gray-200">{folder.name}</span>
        <span className="text-xs text-gray-500 ml-1">Variables</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-xs text-gray-500 mb-4">
          Variables defined here are available as <code className="font-mono text-gray-400">{'{{varName}}'}</code> in all requests inside this folder.
        </p>

        {/* Header row */}
        {rows.length > 0 && (
          <div className="flex gap-2 mb-1 px-1">
            <span className="flex-1 text-xs text-gray-600 font-medium">Variable</span>
            <span className="flex-1 text-xs text-gray-600 font-medium">Value</span>
            <span className="w-6" />
          </div>
        )}

        <div className="space-y-1.5 mb-3">
          {rows.map(row => (
            <div key={row.id} className="flex gap-2">
              <input
                className="input-base flex-1 text-xs py-1.5"
                placeholder="Variable name"
                value={row.key}
                onChange={e => updateRow(row.id, 'key', e.target.value)}
                onBlur={save}
              />
              <input
                className="input-base flex-1 text-xs py-1.5"
                placeholder="Value"
                type={SECRET_RE.test(row.key) ? 'password' : 'text'}
                value={row.value}
                onChange={e => updateRow(row.id, 'value', e.target.value)}
                onBlur={save}
              />
              <button
                className="btn-ghost text-xs px-1.5 text-red-400 flex-shrink-0"
                onClick={() => removeRow(row.id)}
                title="Remove"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-xs text-gray-600 py-2">No variables yet. Add one below.</p>
          )}
        </div>

        <button
          className="btn-ghost text-xs flex items-center gap-1"
          onClick={addRow}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add variable
        </button>
      </div>
    </div>
  )
}
