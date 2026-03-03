import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useWorkspaceStore } from '../../store/workspaceStore'

interface Props {
  environmentId: string
  onClose: () => void
}

interface Row { id: string; key: string; value: string }

export function EnvironmentEditor({ environmentId, onClose }: Props) {
  const { environments, updateEnvironment } = useWorkspaceStore()
  const env = environments.find(e => e.id === environmentId)

  const [rows, setRows] = useState<Row[]>(() => {
    if (!env) return []
    return Object.entries(env.variables).map(([key, value]) => ({ id: uuid(), key, value }))
  })

  if (!env) return null

  function addRow() {
    setRows(r => [...r, { id: uuid(), key: '', value: '' }])
  }

  function removeRow(id: string) {
    setRows(r => r.filter(row => row.id !== id))
  }

  function updateRow(id: string, field: 'key' | 'value', val: string) {
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: val } : row))
  }

  function save() {
    const variables: Record<string, string> = {}
    for (const row of rows) {
      if (row.key.trim()) variables[row.key.trim()] = row.value
    }
    updateEnvironment(environmentId, { variables })
    onClose()
  }

  const SECRET_RE = /^(token|secret|password|key|api_?key|auth)/i

  return (
    <div className="bg-gray-800 border border-gray-700 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-200">{env.name}</span>
        <button className="btn-ghost text-xs" onClick={onClose}>✕</button>
      </div>

      <div className="space-y-1 mb-2 max-h-56 overflow-y-auto">
        {rows.map(row => (
          <div key={row.id} className="flex gap-1">
            <input
              className="input-base flex-1 text-xs py-1"
              placeholder="Variable"
              value={row.key}
              onChange={e => updateRow(row.id, 'key', e.target.value)}
            />
            <input
              className="input-base flex-1 text-xs py-1"
              placeholder="Value"
              type={SECRET_RE.test(row.key) ? 'password' : 'text'}
              value={row.value}
              onChange={e => updateRow(row.id, 'value', e.target.value)}
            />
            <button
              className="btn-ghost text-xs px-1.5 text-red-400"
              onClick={() => removeRow(row.id)}
            >✕</button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-gray-500">No variables yet</p>
        )}
      </div>

      <div className="flex gap-1">
        <button className="btn-ghost text-xs" onClick={addRow}>+ Add</button>
        <div className="flex-1" />
        <button className="btn-primary text-xs" onClick={save}>Save</button>
      </div>
    </div>
  )
}
