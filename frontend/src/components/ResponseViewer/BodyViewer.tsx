import { useState } from 'react'
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

export function BodyViewer({ execution }: Props) {
  const [format, setFormat] = useState<Format>('pretty')
  const [copied, setCopied] = useState(false)

  const { body } = execution.response
  const { formatted, isJson } = tryFormatJson(body)

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
        {!isJson && format === 'pretty' && (
          <span className="text-xs text-gray-500">(not JSON)</span>
        )}
        <div className="flex-1" />
        <button className="btn-ghost text-xs" onClick={copyBody}>
          {copied ? '✓' : '⧉ Copy'}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {format === 'pretty' && isJson ? (
          <CodeMirror
            value={displayBody}
            height="100%"
            theme={oneDark}
            extensions={[json()]}
            editable={false}
          />
        ) : (
          <pre className="p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
            {displayBody}
          </pre>
        )}
      </div>
    </div>
  )
}
