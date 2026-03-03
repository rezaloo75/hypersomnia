import type React from 'react'
import { PlusCircleIcon, PencilSquareIcon, FolderPlusIcon, KeyIcon, TrashIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import type { AIResponse, AIOperation } from '../../types'

interface Props {
  response: AIResponse
  onApply: () => void
  onDismiss: () => void
}

export function DiffPreview({ response, onApply, onDismiss }: Props) {
  const { activeWorkspaceId, createRequest, updateRequest, createFolder, updateEnvironment, environments, activeEnvironmentId } = useWorkspaceStore()

  function applyOperation(op: AIOperation) {
    if (!activeWorkspaceId) return

    switch (op.op) {
      case 'create_request':
        if (op.data) {
          createRequest(activeWorkspaceId, op.data.name ?? 'New Request', op.data.folderId)
          const { requests } = useWorkspaceStore.getState()
          const newReq = requests[requests.length - 1]
          if (newReq && op.data) {
            updateRequest(newReq.id, op.data)
          }
        }
        break

      case 'update_request':
        if (op.id && op.data) {
          updateRequest(op.id, op.data)
        }
        break

      case 'create_folder':
        if (op.data?.name) {
          createFolder(activeWorkspaceId, op.data.name, op.data.folderId)
        }
        break

      case 'set_env_vars':
        if (op.vars) {
          const envId = op.environmentId ?? activeEnvironmentId
          if (envId) {
            const env = environments.find(e => e.id === envId)
            if (env) {
              updateEnvironment(envId, {
                variables: { ...env.variables, ...op.vars }
              })
            }
          }
        }
        break
    }
  }

  function applyAll() {
    response.operations.forEach(applyOperation)
    onApply()
  }

  function applyOne(op: AIOperation, index: number) {
    applyOperation(op)
    // If all ops applied individually, dismiss
    if (response.operations.length === 1) onApply()
  }

  return (
    <div className="rounded-lg p-3 space-y-3" style={{ background: '#111', border: '1px solid #3d9108' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: '#6fdc0e' }}>Proposed Changes</span>
        <button className="btn-ghost text-xs" onClick={onDismiss}>Dismiss</button>
      </div>

      <div className="space-y-2">
        {response.operations.map((op, i) => (
          <OperationCard key={i} op={op} onApply={() => applyOne(op, i)} />
        ))}
      </div>

      {response.operations.length > 1 && (
        <button className="btn-primary text-xs w-full" onClick={applyAll}>
          Apply All ({response.operations.length} changes)
        </button>
      )}
    </div>
  )
}

function OperationCard({ op, onApply }: { op: AIOperation; onApply: () => void }) {
  const label = getOperationLabel(op)
  const icon = getOperationIcon(op)

  return (
    <div className="bg-gray-900 rounded p-2 flex items-start justify-between gap-2">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <span className="flex-shrink-0 mt-0.5">{icon}</span>
        <div className="text-xs min-w-0">
          <div className="text-gray-200 font-medium">{label}</div>
          {op.data?.method && op.data?.url && (
            <div className="text-gray-400 truncate">{op.data.method} {op.data.url}</div>
          )}
          {op.vars && (
            <div className="text-gray-400">
              {Object.entries(op.vars).map(([k, v]) => (
                <span key={k} className="mr-2">{k} = <span className="text-green-400">{v}</span></span>
              ))}
            </div>
          )}
        </div>
      </div>
      <button className="btn-primary text-xs flex-shrink-0 py-1" onClick={onApply}>Apply</button>
    </div>
  )
}

function getOperationLabel(op: AIOperation): string {
  switch (op.op) {
    case 'create_request': return `Create request: ${op.data?.name ?? 'New Request'}`
    case 'update_request': return `Update request`
    case 'create_folder': return `Create folder: ${op.data?.name ?? 'New Folder'}`
    case 'set_env_vars': return `Set environment variables`
    case 'delete_request': return `Delete request`
    default: return op.op
  }
}

function getOperationIcon(op: AIOperation): React.ReactNode {
  switch (op.op) {
    case 'create_request': return <PlusCircleIcon className="w-4 h-4 text-green-400" />
    case 'update_request': return <PencilSquareIcon className="w-4 h-4 text-blue-400" />
    case 'create_folder':  return <FolderPlusIcon className="w-4 h-4 text-yellow-400" />
    case 'set_env_vars':   return <KeyIcon className="w-4 h-4 text-purple-400" />
    case 'delete_request': return <TrashIcon className="w-4 h-4 text-red-400" />
    default:               return <Cog6ToothIcon className="w-4 h-4 text-gray-400" />
  }
}
