import { v4 as uuid } from 'uuid'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { KeyValueTable } from './KeyValueTable'
import type { Request } from '../../types'

const QUICK_HEADERS = [
  { key: 'Accept', value: 'application/json' },
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer ' },
  { key: 'X-Request-ID', value: '{{requestId}}' },
]

export function HeadersTab({ request }: { request: Request }) {
  const { updateRequest } = useWorkspaceStore()

  function addQuick(key: string, value: string) {
    if (request.headers.some(h => h.key === key)) return
    updateRequest(request.id, {
      headers: [...request.headers, { id: uuid(), key, value, enabled: true }],
    })
  }

  return (
    <div>
      <div className="flex gap-1 flex-wrap px-3 pt-3 pb-1">
        {QUICK_HEADERS.map(h => (
          <button
            key={h.key}
            className="btn-ghost text-xs py-0.5"
            onClick={() => addQuick(h.key, h.value)}
          >
            + {h.key}
          </button>
        ))}
      </div>
      <KeyValueTable
        pairs={request.headers}
        onChange={headers => updateRequest(request.id, { headers })}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
      />
    </div>
  )
}
