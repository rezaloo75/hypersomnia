import { useWorkspaceStore } from '../../store/workspaceStore'
import { KeyValueTable } from './KeyValueTable'
import type { Request } from '../../types'

export function ParamsTab({ request }: { request: Request }) {
  const { updateRequest } = useWorkspaceStore()
  return (
    <KeyValueTable
      pairs={request.queryParams}
      onChange={queryParams => updateRequest(request.id, { queryParams })}
      keyPlaceholder="Parameter"
      valuePlaceholder="Value"
    />
  )
}
