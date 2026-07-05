import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { BoltIcon, ClipboardDocumentIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { UrlBar } from './UrlBar'
import { ParamsTab } from './ParamsTab'
import { HeadersTab } from './HeadersTab'
import { AuthTab } from './AuthTab'
import { BodyTab } from './BodyTab'
import { AiChatEditor } from './AiChatEditor'
import { executeRequest } from '../../utils/requestExecutor'
import { buildCurl } from '../../utils/curlBuilder'
import { getTopLevelFolder } from '../../utils/folders'
import type { RequestMode } from '../../types'

type HttpTab = 'params' | 'headers' | 'auth' | 'body'
type AiTab = 'chat' | 'headers' | 'auth'

export function RequestEditor() {
  const { requests, folders, activeRequestId, addHistory, updateRequest } = useWorkspaceStore()
  const { setSending, setCurrentExecution, setActiveFolderId } = useUIStore()
  const [activeHttpTab, setActiveHttpTab] = useState<HttpTab>('params')
  const [activeAiTab, setActiveAiTab] = useState<AiTab>('chat')
  const [copied, setCopied] = useState(false)

  const request = requests.find(r => r.id === activeRequestId)
  const topLevelFolder = getTopLevelFolder(activeRequestId, requests, folders)
  const variables = topLevelFolder?.variables ?? {}

  async function handleSend() {
    if (!request) return
    setSending(true)
    try {
      const execution = await executeRequest(request, variables, topLevelFolder)
      addHistory(execution)
      setCurrentExecution(execution)
    } finally {
      setSending(false)
    }
  }

  async function handleCopyCurl() {
    if (!request) return
    const curl = buildCurl(request, variables)
    await navigator.clipboard.writeText(curl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleModeToggle(mode: RequestMode) {
    if (!request) return
    if (mode === request.requestMode || (!request.requestMode && mode === 'http')) return
    const patch: Parameters<typeof updateRequest>[1] = { requestMode: mode }
    if (mode === 'ai-chat' && !request.aiChat) {
      patch.aiChat = {
        model: 'gpt-4o-mini',
        temperature: 1,
        maxTokens: 1024,
        messages: [
          { id: uuid(), role: 'system', content: 'You are a helpful assistant.' },
          { id: uuid(), role: 'user', content: '' },
        ],
      }
    }
    updateRequest(request.id, patch)
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <BoltIcon className="w-10 h-10 mb-3 mx-auto text-gray-700" />
          <p className="text-sm">Select or create a request to get started</p>
        </div>
      </div>
    )
  }

  const isAiMode = request.requestMode === 'ai-chat'

  const httpTabs: { id: HttpTab; label: string; badge?: number }[] = [
    { id: 'params', label: 'Params', badge: request.queryParams.filter(p => p.enabled && p.key).length || undefined },
    { id: 'headers', label: 'Headers', badge: request.headers.filter(h => h.enabled && h.key).length || undefined },
    { id: 'auth', label: 'Auth', badge: request.auth.type !== 'none' ? 1 : undefined },
    { id: 'body', label: 'Body', badge: request.body.type !== 'none' ? 1 : undefined },
  ]

  const aiTabs: { id: AiTab; label: string; badge?: number }[] = [
    { id: 'chat', label: 'Messages', badge: request.aiChat?.messages.length || undefined },
    { id: 'headers', label: 'Headers', badge: request.headers.filter(h => h.enabled && h.key).length || undefined },
    { id: 'auth', label: 'Auth', badge: request.auth.type !== 'none' ? 1 : undefined },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Request name + mode toggle */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-950 flex-shrink-0">
        <input
          className="input-base flex-1 text-sm font-medium py-1"
          value={request.name}
          onChange={e => updateRequest(request.id, { name: e.target.value })}
          placeholder="Request name"
        />
        {/* Mode toggle */}
        <div className="flex items-center flex-shrink-0 rounded overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
          <button
            className="text-xs px-2 py-1 transition-colors"
            style={!isAiMode ? { background: '#1a1a1a', color: '#e5e7eb' } : { background: 'transparent', color: '#6b7280' }}
            onClick={() => handleModeToggle('http')}
            title="HTTP request mode"
          >
            HTTP
          </button>
          <button
            className="text-xs px-2 py-1 flex items-center gap-1 transition-colors"
            style={isAiMode ? { background: '#1e1033', color: '#a78bfa' } : { background: 'transparent', color: '#6b7280' }}
            onClick={() => handleModeToggle('ai-chat')}
            title="AI Chat mode"
          >
            <SparklesIcon className="w-3 h-3" />
            AI Chat
          </button>
        </div>
        {!isAiMode && (
          <button className="btn-ghost text-xs flex-shrink-0" title="Copy as cURL" onClick={handleCopyCurl}>
            {copied ? <><CheckIcon className="w-3.5 h-3.5 inline mr-1" />Copied</> : <><ClipboardDocumentIcon className="w-3.5 h-3.5 inline mr-1" />cURL</>}
          </button>
        )}
      </div>

      {/* URL bar */}
      <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <UrlBar request={request} variables={variables} onSend={handleSend} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-950">
        {isAiMode
          ? aiTabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeAiTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                onClick={() => setActiveAiTab(tab.id)}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center tabular-nums"
                    style={{ background: '#1e2a1e', color: '#6fdc0e', fontSize: 10, fontWeight: 600, minWidth: 17, height: 17, paddingInline: 4, border: '1px solid rgba(111,220,14,0.2)', borderRadius: 3 }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))
          : httpTabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeHttpTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                onClick={() => setActiveHttpTab(tab.id)}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center tabular-nums"
                    style={{ background: '#1e2a1e', color: '#6fdc0e', fontSize: 10, fontWeight: 600, minWidth: 17, height: 17, paddingInline: 4, border: '1px solid rgba(111,220,14,0.2)', borderRadius: 3 }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))
        }
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isAiMode ? (
          <>
            {activeAiTab === 'chat' && <AiChatEditor request={request} />}
            {activeAiTab === 'headers' && <div className="overflow-y-auto h-full"><HeadersTab request={request} /></div>}
            {activeAiTab === 'auth' && <div className="overflow-y-auto h-full"><AuthTab request={request} /></div>}
          </>
        ) : (
          <>
            {activeHttpTab === 'params' && <div className="overflow-y-auto h-full"><ParamsTab request={request} /></div>}
            {activeHttpTab === 'headers' && <div className="overflow-y-auto h-full"><HeadersTab request={request} /></div>}
            {activeHttpTab === 'auth' && <div className="overflow-y-auto h-full"><AuthTab request={request} /></div>}
            {activeHttpTab === 'body' && <div className="overflow-y-auto h-full"><BodyTab request={request} /></div>}
          </>
        )}
      </div>
    </div>
  )
}
