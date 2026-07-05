import { useEffect, useRef, useState, useCallback } from 'react'
import { InboxIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useUIStore } from '../../store/uiStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { StatusBadge } from './StatusBadge'
import { BodyViewer } from './BodyViewer'
import { HeadersViewer } from './HeadersViewer'
import { DebugViewer } from './DebugViewer'
import { HistoryPanel } from './HistoryPanel'
import { KongDebugViewer } from './KongDebugViewer'
import { AiMessageContent, AiMetadata, parseAiCompletion } from './AiResponseViewer'

const KONG_DEBUG_HEADER = 'x-kong-request-debug-output'
const NEON = '#6fdc0e'
const AI_PURPLE = '#a78bfa'

export function ResponseViewer() {
  const { currentExecution, activeResponseTab, setActiveResponseTab, setCurrentExecution } = useUIStore()
  const { history, requests, updateRequest } = useWorkspaceStore()
  const [historyHeight, setHistoryHeight] = useState(() =>
    parseInt(localStorage.getItem('hs_historyHeight') ?? '180', 10)
  )

  // Restore last selected history entry on mount
  useEffect(() => {
    if (currentExecution) return
    const savedId = localStorage.getItem('hs_currentExecutionId')
    if (!savedId) return
    const entry = history.find(e => e.id === savedId)
    if (entry) setCurrentExecution(entry)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const dragRef = useRef(false)

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = true
    const startY = e.clientY
    const startH = historyHeight
    let currentH = startH
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      currentH = Math.max(36, Math.min(500, startH + (ev.clientY - startY)))
      setHistoryHeight(currentH)
    }
    const onUp = () => {
      dragRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem('hs_historyHeight', String(currentH))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [historyHeight])

  const headers = currentExecution?.response.headers ?? {}
  const kongDebugHeader = headers[KONG_DEBUG_HEADER]
  const serverHeader = headers['server'] ?? ''
  const viaHeader = headers['via'] ?? ''
  const isKongServer = serverHeader.toLowerCase().startsWith('kong')
  const isKongVia = /kong\//i.test(viaHeader)
  const proxyLatency = headers['x-kong-proxy-latency'] ? Number(headers['x-kong-proxy-latency']) : undefined
  const upstreamLatency = headers['x-kong-upstream-latency'] ? Number(headers['x-kong-upstream-latency']) : undefined
  const kongRequestId = headers['x-kong-request-id']
  const showKongTab = isKongServer || isKongVia || !!kongDebugHeader || !!proxyLatency

  // AI completion detection
  const sourceRequest = currentExecution ? requests.find(r => r.id === currentExecution.requestId) : undefined
  const isAiChatMode = sourceRequest?.requestMode === 'ai-chat'
  const aiCompletion = currentExecution ? parseAiCompletion(currentExecution.response.body) : null
  const showAiTabs = isAiChatMode && !!aiCompletion

  // Tab fallback effects
  useEffect(() => {
    if (activeResponseTab === 'kong' && !showKongTab) {
      setActiveResponseTab('body')
    }
  }, [currentExecution, showKongTab, activeResponseTab, setActiveResponseTab])

  useEffect(() => {
    if (!currentExecution) return
    if (showAiTabs) {
      setActiveResponseTab('ai-message')
    } else if (activeResponseTab === 'ai-message' || activeResponseTab === 'ai-meta') {
      setActiveResponseTab('body')
    }
  // intentionally only fires when the execution changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExecution])

  if (!currentExecution) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 overflow-hidden" style={{ height: historyHeight }}>
          <HistoryPanel />
        </div>
        <div
          className="h-1 bg-gray-800 hover:bg-indigo-500 cursor-row-resize transition-colors flex-shrink-0"
          onMouseDown={handleDividerMouseDown}
        />
        <div className="flex items-center justify-center flex-1 text-gray-600">
          <div className="text-center">
            <InboxIcon className="w-10 h-10 mb-2 mx-auto text-gray-700" />
            <p className="text-xs">Send a request to see the response</p>
          </div>
        </div>
      </div>
    )
  }

  const { response, error } = currentExecution

  // Detect if Kong AI Prompt Template plugin is rejecting untemplated requests
  const isNotTemplateMode = isAiChatMode && !sourceRequest?.aiChat?.usePromptTemplate
  const bodyLower = response.body?.toLowerCase() ?? ''
  const looksLikeTemplateRejection = (
    isNotTemplateMode &&
    response.status === 400 &&
    (bodyLower.includes('template') || bodyLower.includes('untemplated'))
  )

  // Detect when template mode is active but Kong returns a body-validation error
  const isTemplateMode = isAiChatMode && !!sourceRequest?.aiChat?.usePromptTemplate
  const looksLikeTemplateMissing = (
    isTemplateMode &&
    response.status === 400 &&
    (bodyLower.includes('valid inputs') || bodyLower.includes('valid input'))
  )

  function switchToTemplateMode() {
    if (!sourceRequest) return
    updateRequest(sourceRequest.id, {
      aiChat: {
        model: sourceRequest.aiChat?.model ?? 'gpt-4o-mini',
        temperature: sourceRequest.aiChat?.temperature ?? 1,
        maxTokens: sourceRequest.aiChat?.maxTokens ?? 1024,
        messages: sourceRequest.aiChat?.messages ?? [],
        usePromptTemplate: true,
        promptTemplateName: sourceRequest.aiChat?.promptTemplateName ?? '',
        promptTemplateProperties: sourceRequest.aiChat?.promptTemplateProperties ?? [],
      },
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* History panel */}
      <div className="flex-shrink-0 overflow-hidden" style={{ height: historyHeight }}>
        <HistoryPanel />
      </div>

      {/* Draggable divider */}
      <div
        className="h-1 bg-gray-800 hover:bg-indigo-500 cursor-row-resize transition-colors flex-shrink-0"
        onMouseDown={handleDividerMouseDown}
      />

      {/* Template body validation error banner */}
      {looksLikeTemplateMissing && (
        <div className="flex items-start gap-2 px-3 py-2 flex-shrink-0 text-xs"
          style={{ background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid rgba(248,113,113,0.2)' }}>
          <DocumentTextIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
          <span style={{ color: '#fca5a5' }}>
            Kong rejected the request body. Check the <strong>Details</strong> tab to verify what was sent.
            Common causes: wrong template name, missing variable values, or the{' '}
            <span style={{ fontFamily: 'monospace' }}>ai-prompt-template</span> plugin not enabled on this specific route.
          </span>
        </div>
      )}

      {/* Prompt Template detection banner */}
      {looksLikeTemplateRejection && (
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0 text-xs"
          style={{ background: 'rgba(192,132,252,0.08)', borderBottom: '1px solid rgba(192,132,252,0.2)' }}>
          <DocumentTextIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#c084fc' }} />
          <span style={{ color: '#d8b4fe' }}>
            Kong AI Prompt Template plugin detected — untemplated requests may be blocked.
          </span>
          <button
            className="ml-auto flex-shrink-0 text-xs px-2 py-0.5 rounded font-medium"
            style={{ background: '#2d1a4a', color: '#c084fc', border: '1px solid rgba(192,132,252,0.4)' }}
            onClick={switchToTemplateMode}
          >
            Switch to Template mode
          </button>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <StatusBadge status={response.status} statusText={response.statusText} />
        {response.time > 0 && (
          <span className="text-xs text-gray-400">{response.time}ms</span>
        )}
        {response.size > 0 && (
          <span className="text-xs text-gray-400">{formatSize(response.size)}</span>
        )}
        {error && (
          <span className="text-xs text-red-400">⚠ {error}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-950">
        {/* AI tabs — shown first when present */}
        {showAiTabs && (
          <>
            <button
              className={`tab-btn ${activeResponseTab === 'ai-message' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
              onClick={() => setActiveResponseTab('ai-message')}
              style={activeResponseTab === 'ai-message'
                ? { color: AI_PURPLE, borderBottomColor: AI_PURPLE }
                : { color: AI_PURPLE, opacity: 0.7 }}
            >
              Message
            </button>
            <button
              className={`tab-btn ${activeResponseTab === 'ai-meta' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
              onClick={() => setActiveResponseTab('ai-meta')}
              style={activeResponseTab === 'ai-meta'
                ? { color: AI_PURPLE, borderBottomColor: AI_PURPLE }
                : { color: AI_PURPLE, opacity: 0.7 }}
            >
              AI Metadata
            </button>
          </>
        )}
        {(['body', 'headers', 'details'] as const).map(tab => (
          <button
            key={tab}
            className={`tab-btn capitalize ${activeResponseTab === tab ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            onClick={() => setActiveResponseTab(tab)}
          >
            {tab}
            {tab === 'headers' && response.headers && (
              <span
                className="ml-1.5 inline-flex items-center justify-center tabular-nums"
                style={{ background: '#1e2a1e', color: '#6fdc0e', fontSize: 10, fontWeight: 600, minWidth: 17, height: 17, paddingInline: 4, border: '1px solid rgba(111,220,14,0.2)', borderRadius: 3 }}
              >
                {Object.keys(response.headers).length}
              </span>
            )}
          </button>
        ))}
        {showKongTab && (
          <button
            className={`tab-btn ${activeResponseTab === 'kong' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            onClick={() => setActiveResponseTab('kong')}
            style={activeResponseTab === 'kong' ? { color: NEON, borderBottomColor: NEON } : { color: NEON, opacity: 0.6 }}
          >
            Kong
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeResponseTab === 'ai-message' && aiCompletion && <AiMessageContent completion={aiCompletion} />}
        {activeResponseTab === 'ai-meta'    && aiCompletion && <AiMetadata completion={aiCompletion} />}
        {activeResponseTab === 'body' && <BodyViewer execution={currentExecution} />}
        {activeResponseTab === 'headers' && <HeadersViewer headers={response.headers} />}
        {activeResponseTab === 'details' && <DebugViewer execution={currentExecution} />}
        {activeResponseTab === 'kong' && showKongTab && (
          <KongDebugViewer
            header={kongDebugHeader}
            server={isKongServer ? serverHeader : (isKongVia ? viaHeader : undefined)}
            proxyLatency={proxyLatency}
            upstreamLatency={upstreamLatency}
            requestId={kongRequestId}
          />
        )}
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
