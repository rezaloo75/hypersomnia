import type { RequestExecution } from '../../types'

interface Props {
  execution: RequestExecution
}

export function DebugViewer({ execution }: Props) {
  const { request, response, timestamp } = execution
  const headers = Object.entries(request.headers)

  return (
    <div className="overflow-y-auto h-full p-3 space-y-4 text-xs">
      <section>
        <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Request</h3>
        <div className="bg-gray-900 rounded p-3 space-y-1">
          <div className="flex gap-2">
            <span className="text-gray-500 w-20">Method</span>
            <span className="text-yellow-400 font-bold">{request.method}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20">URL</span>
            <span className="text-blue-300 break-all">{request.url}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20">Timestamp</span>
            <span className="text-gray-300">{new Date(timestamp).toLocaleString()}</span>
          </div>
        </div>
      </section>

      {headers.length > 0 && (
        <section>
          <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Request Headers Sent</h3>
          <div className="bg-gray-900 rounded p-3 space-y-1">
            {headers.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-indigo-300 w-40 flex-shrink-0">{k}</span>
                <span className="text-gray-300 break-all">{
                  k.toLowerCase() === 'authorization' ? maskSecret(v) : v
                }</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {request.body && (
        <section>
          <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Request Body</h3>
          <pre className="bg-gray-900 rounded p-3 text-gray-300 whitespace-pre-wrap break-all">
            {request.body}
          </pre>
        </section>
      )}

      <section>
        <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Response</h3>
        <div className="bg-gray-900 rounded p-3 space-y-1">
          <div className="flex gap-2">
            <span className="text-gray-500 w-20">Status</span>
            <span className={response.status < 400 ? 'text-green-400' : 'text-red-400'}>
              {response.status} {response.statusText}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20">Time</span>
            <span className="text-gray-300">{response.time}ms</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20">Size</span>
            <span className="text-gray-300">{response.size} bytes</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••'
  return value.slice(0, 6) + '••••••' + value.slice(-4)
}
