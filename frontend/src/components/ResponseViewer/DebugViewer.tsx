import { useState, useCallback } from 'react'
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'
import type { RequestExecution } from '../../types'

interface Props {
  execution: RequestExecution
}

export function DebugViewer({ execution }: Props) {
  const { request, response, timestamp } = execution
  const headers = Object.entries(request.headers)
  const [curlCopied, setCurlCopied] = useState(false)
  const [bodyCopied, setBodyCopied] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const curlCommand = buildCurl(request)

  const copyCurl = useCallback(() => {
    navigator.clipboard.writeText(curlCommand).then(() => {
      setCurlCopied(true)
      setTimeout(() => setCurlCopied(false), 2000)
    })
  }, [curlCommand])

  const copyBody = useCallback(() => {
    if (!request.body) return
    const pretty = tryPretty(request.body)
    navigator.clipboard.writeText(pretty).then(() => {
      setBodyCopied(true)
      setTimeout(() => setBodyCopied(false), 2000)
    })
  }, [request.body])

  return (
    <div className="overflow-y-auto h-full p-3 space-y-4 text-xs">

      {/* cURL command */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-400 font-semibold uppercase tracking-wide">cURL Command</h3>
          <button
            onClick={copyCurl}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
            style={{ background: curlCopied ? '#0d1a00' : '#1a1a1a', color: curlCopied ? '#6fdc0e' : '#9ca3af', border: `1px solid ${curlCopied ? 'rgba(111,220,14,0.3)' : '#2a2a2a'}` }}
          >
            {curlCopied
              ? <><ClipboardDocumentCheckIcon className="w-3.5 h-3.5" /> Copied!</>
              : <><ClipboardDocumentIcon className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>
        <pre className="bg-gray-900 rounded p-3 text-gray-300 whitespace-pre-wrap break-all font-mono leading-relaxed">
          {buildCurlDisplay(request, showAuth)}
        </pre>
        {hasAuthHeader(request.headers) && (
          <button
            className="mt-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            onClick={() => setShowAuth(v => !v)}
          >
            {showAuth ? 'Hide auth value' : 'Show auth value in display'}
          </button>
        )}
      </section>

      {/* Request summary */}
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
          <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Request Headers</h3>
          <div className="bg-gray-900 rounded p-3 space-y-1">
            {headers.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-indigo-300 w-40 flex-shrink-0">{k}</span>
                <span className="text-gray-300 break-all font-mono">
                  {k.toLowerCase() === 'authorization' && !showAuth ? maskSecret(v) : v}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {request.body && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 font-semibold uppercase tracking-wide">Request Body</h3>
            <button
              onClick={copyBody}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
              style={{ background: bodyCopied ? '#0d1a00' : '#1a1a1a', color: bodyCopied ? '#6fdc0e' : '#9ca3af', border: `1px solid ${bodyCopied ? 'rgba(111,220,14,0.3)' : '#2a2a2a'}` }}
            >
              {bodyCopied
                ? <><ClipboardDocumentCheckIcon className="w-3.5 h-3.5" /> Copied!</>
                : <><ClipboardDocumentIcon className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
          <pre className="bg-gray-900 rounded p-3 text-gray-300 whitespace-pre-wrap break-all font-mono">
            {tryPretty(request.body)}
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasAuthHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some(k => k.toLowerCase() === 'authorization')
}

function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••'
  return value.slice(0, 6) + '••••••' + value.slice(-4)
}

function tryPretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function buildCurl(request: RequestExecution['request']): string {
  const parts = [`curl -i -X ${request.method} "${request.url}"`]
  for (const [k, v] of Object.entries(request.headers)) {
    parts.push(`  -H "${k}: ${v}"`)
  }
  if (request.body) {
    const escaped = request.body.replace(/\\/g, '\\\\').replace(/'/g, "'\\''")
    parts.push(`  -d '${escaped}'`)
  }
  return parts.join(' \\\n')
}

function buildCurlDisplay(request: RequestExecution['request'], showAuth: boolean): string {
  const parts = [`curl -i -X ${request.method} "${request.url}"`]
  for (const [k, v] of Object.entries(request.headers)) {
    const isAuth = k.toLowerCase() === 'authorization'
    const displayVal = isAuth && !showAuth ? maskSecret(v) : v
    parts.push(`  -H "${k}: ${displayVal}"`)
  }
  if (request.body) {
    const pretty = tryPretty(request.body)
    parts.push(`  -d '${pretty.replace(/'/g, "'\\''")}'`)
  }
  return parts.join(' \\\n')
}
