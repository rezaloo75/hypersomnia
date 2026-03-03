import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { useWorkspaceStore } from '../../store/workspaceStore'
import type { Request, BodyType } from '../../types'

export function BodyTab({ request }: { request: Request }) {
  const { updateRequest } = useWorkspaceStore()
  const { body } = request

  function formatJson() {
    try {
      const parsed = JSON.parse(body.content)
      updateRequest(request.id, { body: { ...body, content: JSON.stringify(parsed, null, 2) } })
    } catch {
      alert('Invalid JSON')
    }
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-400">Body Type</label>
        <select
          className="input-base text-xs py-1"
          value={body.type}
          onChange={e => updateRequest(request.id, { body: { ...body, type: e.target.value as BodyType } })}
        >
          <option value="none">None</option>
          <option value="json">JSON</option>
          <option value="form-urlencoded">Form URL Encoded</option>
          <option value="raw">Raw</option>
        </select>
        {body.type === 'json' && (
          <button className="btn-ghost text-xs py-0.5" onClick={formatJson}>Format JSON</button>
        )}
      </div>

      {body.type !== 'none' && (
        body.type === 'json' ? (
          <div className="rounded overflow-hidden border border-gray-700">
            <CodeMirror
              value={body.content}
              height="300px"
              theme={oneDark}
              extensions={[json()]}
              onChange={val => updateRequest(request.id, { body: { ...body, content: val } })}
            />
          </div>
        ) : (
          <textarea
            className="input-base w-full text-xs py-2 font-mono resize-none"
            rows={12}
            placeholder={body.type === 'form-urlencoded' ? 'key1=value1&key2=value2' : 'Request body...'}
            value={body.content}
            onChange={e => updateRequest(request.id, { body: { ...body, content: e.target.value } })}
          />
        )
      )}

      {body.type === 'none' && (
        <p className="text-xs text-gray-500">No body. Select a body type to add request body.</p>
      )}
    </div>
  )
}
