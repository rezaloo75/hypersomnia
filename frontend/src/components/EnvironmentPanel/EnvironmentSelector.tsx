import { useState } from 'react'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { EnvironmentEditor } from './EnvironmentEditor'

interface Props {
  workspaceId: string
}

export function EnvironmentSelector({ workspaceId }: Props) {
  const { environments, activeEnvironmentId, createEnvironment, setActiveEnvironment, deleteEnvironment } = useWorkspaceStore()
  const [editingId, setEditingId] = useState<string | null>(null)

  const wsEnvs = environments.filter(e => e.workspaceId === workspaceId)
  const activeEnv = wsEnvs.find(e => e.id === activeEnvironmentId)

  return (
    <div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 flex-shrink-0">Env:</span>
        <select
          className="input-base flex-1 text-xs py-1"
          value={activeEnvironmentId ?? ''}
          onChange={e => setActiveEnvironment(e.target.value || null)}
        >
          <option value="">No environment</option>
          {wsEnvs.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <button
          className="btn-ghost text-xs px-1.5"
          title="New environment"
          onClick={() => {
            const name = prompt('Environment name:')
            if (name?.trim()) {
              const env = createEnvironment(workspaceId, name.trim())
              setActiveEnvironment(env.id)
              setEditingId(env.id)
            }
          }}
        >+</button>
        {activeEnv && (
          <>
            <button
              className="btn-ghost text-xs px-1.5"
              title="Edit environment variables"
              onClick={() => setEditingId(editingId === activeEnv.id ? null : activeEnv.id)}
            >✏️</button>
            <button
              className="btn-ghost text-xs px-1.5 text-red-400"
              title="Delete environment"
              onClick={() => { if (confirm(`Delete environment "${activeEnv.name}"?`)) deleteEnvironment(activeEnv.id) }}
            >🗑</button>
          </>
        )}
      </div>

      {editingId && wsEnvs.find(e => e.id === editingId) && (
        <div className="mt-2">
          <EnvironmentEditor
            environmentId={editingId}
            onClose={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  )
}
