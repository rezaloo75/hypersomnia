import { useState } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import type { RequestExecution } from '../../types'

interface Props {
  execution: RequestExecution
}

type Format = 'pretty' | 'raw'

function tryFormatJson(body: string): { formatted: string; isJson: boolean } {
  try {
    return { formatted: JSON.stringify(JSON.parse(body), null, 2), isJson: true }
  } catch {
    return { formatted: body, isJson: false }
  }
}

function detectHtml(body: string, contentType: string): boolean {
  if (/text\/html/i.test(contentType)) return true
  const t = body.trimStart()
  return /^<!doctype\s+html/i.test(t) || /^<html[\s>]/i.test(t)
}

export function BodyViewer({ execution }: Props) {
  const [format, setFormat] = useState<Format>('pretty')
  const [copied, setCopied] = useState(false)

  const { body } = execution.response
  const contentType = (execution.response.headers?.['content-type'] ?? '')
  const { formatted, isJson } = tryFormatJson(body)
  const isHtml = !isJson && detectHtml(body, contentType)

  const displayBody = format === 'pretty' && isJson ? formatted : body

  async function copyBody() {
    await navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!body) {
    return <div className="p-4 text-xs text-gray-500">Empty response body</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 flex-shrink-0">
        <div className="flex gap-1">
          {(['pretty', 'raw'] as Format[]).map(f => (
            <button
              key={f}
              className={`tab-btn capitalize ${format === f ? 'tab-btn-active' : 'tab-btn-inactive'}`}
              onClick={() => setFormat(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {!isJson && !isHtml && format === 'pretty' && (
          <span className="text-xs text-gray-500">(not JSON)</span>
        )}
        <div className="flex-1" />
        <button className="btn-ghost text-xs" onClick={copyBody}>
          {copied ? <CheckIcon className="w-4 h-4" /> : <><ClipboardDocumentIcon className="w-3.5 h-3.5 inline mr-1" />Copy</>}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {format === 'pretty' && isJson ? (
          <CodeMirror
            value={displayBody}
            height="100%"
            theme={oneDark}
            extensions={[json()]}
            editable={false}
          />
        ) : format === 'pretty' && isHtml ? (
          <iframe
            srcDoc={body}
            sandbox="allow-same-origin allow-popups"
            title="HTML Preview"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
          />
        ) : (
          <div className="overflow-auto h-full">
            <pre className="p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
              {displayBody}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
