import { useState, useRef, useEffect } from 'react'
import { TrashIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useUIStore } from '../../store/uiStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { AIMessage } from './AIMessage'
import { DiffPreview } from './DiffPreview'
import type { AIResponse } from '../../types'
import { API_BASE } from '../../utils/api'

const MAX_CONTEXT_BODY = 4000

function buildContext(store: ReturnType<typeof useWorkspaceStore.getState>, currentExecution: ReturnType<typeof useUIStore.getState>['currentExecution']) {
  const { activeRequestId, activeWorkspaceId, activeEnvironmentId, requests, folders, environments } = store

  const activeRequest = requests.find(r => r.id === activeRequestId)
  const activeEnv = environments.find(e => e.id === activeEnvironmentId)
  const wsRequests = requests.filter(r => r.workspaceId === activeWorkspaceId).map(r => ({ id: r.id, name: r.name, method: r.method, url: r.url, folderId: r.folderId }))
  const wsFolders = folders.filter(f => f.workspaceId === activeWorkspaceId).map(f => ({ id: f.id, name: f.name, parentId: f.parentId }))

  // Redact secrets from environment
  const safeVars: Record<string, string> = {}
  if (activeEnv) {
    for (const [k, v] of Object.entries(activeEnv.variables)) {
      const isSecret = /token|secret|password|key|auth/i.test(k)
      safeVars[k] = isSecret ? '••••••' : v
    }
  }

  const lastResponse = currentExecution ? {
    status: currentExecution.response.status,
    statusText: currentExecution.response.statusText,
    headers: currentExecution.response.headers,
    body: currentExecution.response.body.slice(0, MAX_CONTEXT_BODY),
    truncated: currentExecution.response.body.length > MAX_CONTEXT_BODY,
  } : null

  return {
    activeRequest,
    environment: activeEnv ? { name: activeEnv.name, variables: safeVars } : null,
    workspaceTree: { folders: wsFolders, requests: wsRequests },
    lastResponse,
  }
}

export function AIAssistant() {
  const { aiMessages, aiLoading, addAiMessage, setAiLoading, clearAiMessages, setAiPanelOpen } = useUIStore()
  const { currentExecution } = useUIStore()
  const { activeWorkspaceId } = useWorkspaceStore()

  const [input, setInput] = useState('')
  const [pendingResponse, setPendingResponse] = useState<AIResponse | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  async function sendMessage() {
    if (!input.trim() || aiLoading) return

    const userMsg = { role: 'user' as const, content: input.trim() }
    addAiMessage(userMsg)
    setInput('')
    setAiLoading(true)
    setPendingResponse(null)

    const context = buildContext(useWorkspaceStore.getState(), currentExecution)
    const messages = [...aiMessages, userMsg]

    try {
      const res = await fetch(`${API_BASE}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context }),
      })
      const data = await res.json() as { response?: AIResponse; error?: string; message?: string }

      if (data.error) {
        addAiMessage({ role: 'assistant', content: `Error: ${data.error}` })
        return
      }

      if (data.response && data.response.operations?.length > 0) {
        addAiMessage({ role: 'assistant', content: data.response.explanation })
        setPendingResponse(data.response)
      } else if (data.message) {
        addAiMessage({ role: 'assistant', content: data.message })
      } else {
        addAiMessage({ role: 'assistant', content: 'No response received' })
      }
    } catch (err) {
      addAiMessage({ role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Network error'}` })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4" style={{ color: '#6fdc0e' }} />
          <span className="text-xs font-semibold" style={{ color: '#6fdc0e' }}>AI Assistant</span>
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost p-1" onClick={clearAiMessages} title="Clear conversation"><TrashIcon className="w-4 h-4" /></button>
          <button className="btn-ghost p-1" onClick={() => setAiPanelOpen(false)}><XMarkIcon className="w-4 h-4" /></button>
        </div>
      </div>

      {!activeWorkspaceId && (
        <div className="p-3 text-xs text-gray-500 text-center">Open a workspace to use AI assistant</div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {aiMessages.length === 0 && (
          <div className="text-xs text-gray-500 text-center mt-4">
            <p className="mb-2">Ask me to:</p>
            <div className="space-y-1 text-left mx-4">
              <p className="bg-gray-800 rounded px-2 py-1 cursor-pointer hover:bg-gray-700" onClick={() => setInput('Create a GET request to fetch users from jsonplaceholder.typicode.com')}>
                Create a request from description
              </p>
              <p className="bg-gray-800 rounded px-2 py-1 cursor-pointer hover:bg-gray-700" onClick={() => setInput('Add auth headers to the current request')}>
                Modify the current request
              </p>
              <p className="bg-gray-800 rounded px-2 py-1 cursor-pointer hover:bg-gray-700" onClick={() => setInput('Why did I get a 401 error?')}>
                Troubleshoot a response error
              </p>
              <p className="bg-gray-800 rounded px-2 py-1 cursor-pointer hover:bg-gray-700" onClick={() => setInput('Suggest environment variables for this workspace')}>
                Suggest environment variables
              </p>
            </div>
          </div>
        )}

        {aiMessages.map((msg, i) => (
          <AIMessage key={i} message={msg} />
        ))}

        {aiLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
            </div>
            Thinking...
          </div>
        )}

        {pendingResponse && (
          <DiffPreview
            response={pendingResponse}
            onApply={() => setPendingResponse(null)}
            onDismiss={() => setPendingResponse(null)}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            className="input-base flex-1 text-xs py-2 resize-none"
            rows={3}
            placeholder="Ask the AI to create requests, troubleshoot responses..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            disabled={aiLoading}
          />
          <button
            className="btn-primary text-xs self-end px-3 py-2"
            onClick={sendMessage}
            disabled={aiLoading || !input.trim()}
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1">Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  )
}
