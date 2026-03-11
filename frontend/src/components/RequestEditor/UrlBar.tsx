import { useState } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { segmentize } from '../../utils/interpolate'
import type { Request, HttpMethod } from '../../types'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-pink-400',
}

interface Props {
  request: Request
  variables: Record<string, string>
  onSend: () => void
}

export function UrlBar({ request, variables, onSend }: Props) {
  const { updateRequest } = useWorkspaceStore()
  const { isSending } = useUIStore()
  const [focused, setFocused] = useState(false)
  const [copied, setCopied] = useState(false)

  const segments = segmentize(request.url, variables)
  const hasUnresolved = segments.some(s => s.isVar && s.unresolved)
  const hasVars = segments.some(s => s.isVar)

  const resolvedUrl = segments.map(s => s.isVar && !s.unresolved ? s.resolved : s.text).join('')

  function copyUrl() {
    navigator.clipboard.writeText(resolvedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex gap-2">
      <select
        className={`input-base font-bold text-xs py-1 px-2 w-24 flex-shrink-0 ${METHOD_COLORS[request.method] ?? 'text-gray-400'}`}
        value={request.method}
        onChange={e => updateRequest(request.id, { method: e.target.value as HttpMethod })}
      >
        {METHODS.map(m => (
          <option key={m} value={m} className="text-gray-100 bg-gray-900">{m}</option>
        ))}
      </select>

      <div className="flex-1 relative">
        <input
          className={`input-base w-full py-1 pr-7 ${hasUnresolved ? 'border-red-500/60' : ''}`}
          placeholder="https://api.example.com/endpoint"
          value={request.url}
          onChange={e => updateRequest(request.id, { url: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') onSend() }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {request.url && (
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
            onClick={copyUrl}
            title="Copy resolved URL"
            tabIndex={-1}
          >
            {copied
              ? <CheckIcon className="w-3.5 h-3.5 text-green-400" />
              : <ClipboardDocumentIcon className="w-3.5 h-3.5" />
            }
          </button>
        )}
        {/* Variable preview — only shown while input is focused */}
        {focused && hasVars && (
          <div className="absolute top-full left-0 right-0 z-10 mt-0.5 rounded px-2 py-1 text-xs truncate"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            {segments.map((seg, i) =>
              seg.isVar ? (
                <span key={i} className={`font-semibold ${seg.unresolved ? 'text-red-400' : 'text-green-400'}`}>
                  {seg.unresolved ? seg.text : seg.resolved}
                </span>
              ) : (
                <span key={i} className="text-gray-400">{seg.text}</span>
              )
            )}
          </div>
        )}
      </div>

      <button
        className="btn-primary px-4 flex-shrink-0"
        onClick={onSend}
        disabled={isSending || !request.url}
      >
        {isSending ? (
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Sending
          </span>
        ) : 'Send'}
      </button>
    </div>
  )
}
