import { useState } from 'react'
import { BoltIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { UrlBar } from './UrlBar'
import { ParamsTab } from './ParamsTab'
import { HeadersTab } from './HeadersTab'
import { AuthTab } from './AuthTab'
import { BodyTab } from './BodyTab'
import { executeRequest } from '../../utils/requestExecutor'
import { buildCurl } from '../../utils/curlBuilder'
import { getTopLevelFolder } from '../../utils/folders'

type Tab = 'params' | 'headers' | 'auth' | 'body'

export function RequestEditor() {
  const { requests, folders, activeRequestId, addHistory, updateRequest } = useWorkspaceStore()
  const { setSending, setCurrentExecution, setActiveFolderId } = useUIStore()
  const [activeTab, setActiveTab] = useState<Tab>('params')
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

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'params', label: 'Params', badge: request.queryParams.filter(p => p.enabled && p.key).length || undefined },
    { id: 'headers', label: 'Headers', badge: request.headers.filter(h => h.enabled && h.key).length || undefined },
    { id: 'auth', label: 'Auth', badge: request.auth.type !== 'none' ? 1 : undefined },
    { id: 'body', label: 'Body', badge: request.body.type !== 'none' ? 1 : undefined },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Request name */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-950 flex-shrink-0">
        <input
          className="input-base flex-1 text-sm font-medium py-1"
          value={request.name}
          onChange={e => updateRequest(request.id, { name: e.target.value })}
          placeholder="Request name"
        />
        <button
          className="btn-ghost text-xs"
          title="Copy as cURL"
          onClick={handleCopyCurl}
        >
          {copied ? <><CheckIcon className="w-3.5 h-3.5 inline mr-1" />Copied</> : <><ClipboardDocumentIcon className="w-3.5 h-3.5 inline mr-1" />cURL</>}
        </button>
      </div>

      {/* URL bar */}
      <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <UrlBar request={request} variables={variables} onSend={handleSend} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-950">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            onClick={() => setActiveTab(tab.id)}
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
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'params' && <ParamsTab request={request} />}
        {activeTab === 'headers' && <HeadersTab request={request} />}
        {activeTab === 'auth' && <AuthTab request={request} />}
        {activeTab === 'body' && <BodyTab request={request} />}
      </div>
    </div>
  )
}
