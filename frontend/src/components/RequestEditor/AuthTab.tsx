import { useWorkspaceStore } from '../../store/workspaceStore'
import type { Request, AuthType } from '../../types'

export function AuthTab({ request }: { request: Request }) {
  const { updateRequest } = useWorkspaceStore()
  const { auth } = request

  function update(patch: Partial<typeof auth>) {
    updateRequest(request.id, { auth: { ...auth, ...patch } })
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400 w-20">Type</label>
        <select
          className="input-base text-xs py-1"
          value={auth.type}
          onChange={e => update({ type: e.target.value as AuthType })}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </div>

      {auth.type === 'bearer' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 w-20">Token</label>
          <input
            className="input-base flex-1 text-xs py-1"
            placeholder="Bearer token or {{token}}"
            value={auth.token ?? ''}
            onChange={e => update({ token: e.target.value })}
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20">Username</label>
            <input
              className="input-base flex-1 text-xs py-1"
              placeholder="Username or {{username}}"
              value={auth.username ?? ''}
              onChange={e => update({ username: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20">Password</label>
            <input
              className="input-base flex-1 text-xs py-1"
              type="password"
              placeholder="Password or {{password}}"
              value={auth.password ?? ''}
              onChange={e => update({ password: e.target.value })}
            />
          </div>
        </>
      )}

      {auth.type === 'apikey' && (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20">Key Name</label>
            <input
              className="input-base flex-1 text-xs py-1"
              placeholder="X-API-Key"
              value={auth.apiKeyName ?? ''}
              onChange={e => update({ apiKeyName: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20">Key Value</label>
            <input
              className="input-base flex-1 text-xs py-1"
              placeholder="API key value or {{apiKey}}"
              value={auth.apiKey ?? ''}
              onChange={e => update({ apiKey: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20">Add to</label>
            <select
              className="input-base text-xs py-1"
              value={auth.apiKeyIn ?? 'header'}
              onChange={e => update({ apiKeyIn: e.target.value as 'header' | 'query' })}
            >
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
        </>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-gray-500">{'No authentication configured. Use {{variables}} in headers for tokens.'}</p>
      )}
    </div>
  )
}
