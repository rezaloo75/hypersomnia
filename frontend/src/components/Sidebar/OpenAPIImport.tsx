import { useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { API_BASE } from '../../utils/api'

interface Props {
  workspaceId: string
  onClose: () => void
}

export function OpenAPIImport({ workspaceId, onClose }: Props) {
  const { importRequests } = useWorkspaceStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const text = await file.text()
      const res = await fetch(`${API_BASE}/api/import/openapi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: text, filename: file.name }),
      })
      const data = await res.json() as { folders?: unknown[]; requests?: unknown[]; error?: string }
      if (data.error) throw new Error(data.error)
      importRequests(workspaceId, (data.folders ?? []) as Parameters<typeof importRequests>[1], (data.requests ?? []) as Parameters<typeof importRequests>[2])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-gray-800 rounded p-3 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">Import OpenAPI 3.x</span>
        <button className="btn-ghost p-0.5" onClick={onClose}><XMarkIcon className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-gray-400 mb-2">Upload a JSON or YAML OpenAPI spec file</p>
      <button
        className="btn-secondary text-xs w-full"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
      >
        {loading ? 'Importing…' : 'Choose File'}
      </button>
      <input ref={fileRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleFile} />
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
