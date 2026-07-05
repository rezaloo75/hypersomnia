import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { PlusIcon, TrashIcon, DocumentTextIcon, ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { getTopLevelFolder } from '../../utils/folders'
import { listAllPlugins } from '../../utils/konnectApi'
import type { KonnectRegion } from '../../utils/konnectApi'
import { storage } from '../../db/storage'
import type { Request, AiChatMessage, AiChatConfig, AiChatTemplateProperty } from '../../types'

const COMMON_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo',
  'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229',
  'llama3', 'mistral-large-latest', 'gemini-1.5-pro',
]

const ROLE_STYLES = {
  system:    { bg: '#2d1a00', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  user:      { bg: '#001829', color: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  assistant: { bg: '#0d1a00', color: '#6fdc0e', border: 'rgba(111,220,14,0.3)' },
}

const ROLES: AiChatMessage['role'][] = ['system', 'user', 'assistant']

const PLACEHOLDER: Record<AiChatMessage['role'], string> = {
  system:    'System instructions...',
  user:      'User message...',
  assistant: 'Assistant response...',
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** Extract {{variable}} placeholder names from a template body string. */
function extractPlaceholders(body: string): string[] {
  const matches = body.matchAll(/\{\{([^}]+)\}\}/g)
  const names = new Set<string>()
  for (const m of matches) names.add(m[1].trim())
  return [...names]
}

interface FetchedTemplate { name: string; placeholders: string[] }

interface Props {
  request: Request
}

export function AiChatEditor({ request }: Props) {
  const { requests, folders, updateRequest } = useWorkspaceStore()

  // Konnect folder context
  const topFolder = getTopLevelFolder(request.id, requests, folders)
  const isKonnectFolder = (topFolder?.id.startsWith('konnect-cp-') ?? false)
  const cpId = isKonnectFolder ? topFolder!.id.replace('konnect-cp-', '') : null
  const region = (topFolder?.kongRegion ?? 'us') as KonnectRegion

  // Template fetch state
  const [fetchedTemplates, setFetchedTemplates] = useState<FetchedTemplate[]>([])
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const config: AiChatConfig = request.aiChat ?? {
    model: 'gpt-4o-mini', temperature: 1, maxTokens: 1024, messages: [],
  }

  function patch(updates: Partial<AiChatConfig>) {
    updateRequest(request.id, { aiChat: { ...config, ...updates } })
  }

  // — Message helpers —
  function addMessage() {
    const lastRole = config.messages[config.messages.length - 1]?.role
    const newRole: AiChatMessage['role'] = lastRole === 'user' ? 'assistant' : 'user'
    patch({ messages: [...config.messages, { id: uuid(), role: newRole, content: '' }] })
  }

  function updateMessage(id: string, updates: Partial<AiChatMessage>) {
    patch({ messages: config.messages.map(m => m.id === id ? { ...m, ...updates } : m) })
  }

  function deleteMessage(id: string) {
    patch({ messages: config.messages.filter(m => m.id !== id) })
  }

  function cycleRole(id: string, current: AiChatMessage['role']) {
    const next = ROLES[(ROLES.indexOf(current) + 1) % ROLES.length]
    updateMessage(id, { role: next })
  }

  // — Template helpers —
  const props = config.promptTemplateProperties ?? []

  function addProp() {
    patch({ promptTemplateProperties: [...props, { id: uuid(), key: '', value: '' }] })
  }

  function updateProp(id: string, updates: Partial<AiChatTemplateProperty>) {
    patch({ promptTemplateProperties: props.map(p => p.id === id ? { ...p, ...updates } : p) })
  }

  function deleteProp(id: string) {
    patch({ promptTemplateProperties: props.filter(p => p.id !== id) })
  }

  function togglePromptTemplate() {
    patch({
      usePromptTemplate: !config.usePromptTemplate,
      promptTemplateName: config.promptTemplateName ?? '',
      promptTemplateProperties: config.promptTemplateProperties ?? [],
    })
  }

  /** Select a template from the dropdown — also auto-populates variable keys from its placeholders. */
  function selectTemplate(name: string) {
    const tpl = fetchedTemplates.find(t => t.name === name)
    const existingKeys = new Set(props.map(p => p.key))
    const newProps = tpl
      ? tpl.placeholders
          .filter(ph => !existingKeys.has(ph))
          .map(ph => ({ id: uuid(), key: ph, value: '' }))
      : []
    patch({
      promptTemplateName: name,
      promptTemplateProperties: [...props, ...newProps],
    })
  }

  /** Fetch ai-prompt-template plugins from the Konnect CP and extract all template names. */
  async function fetchTemplates() {
    if (!cpId) return
    const pat = storage.loadKonnectPat()
    if (!pat) { setFetchError('No Konnect PAT configured — open the Konnect panel to sign in.'); return }

    setFetching(true)
    setFetchError(null)
    try {
      const plugins = await listAllPlugins(pat, region, cpId)
      const results: FetchedTemplate[] = []
      for (const plugin of plugins) {
        if (plugin.name !== 'ai-prompt-template') continue
        const templates = (plugin.config as { templates?: Array<{ name?: string; template?: string }> })?.templates ?? []
        for (const t of templates) {
          if (!t.name) continue
          const placeholders = t.template ? extractPlaceholders(t.template) : []
          if (!results.find(r => r.name === t.name)) {
            results.push({ name: t.name, placeholders })
          }
        }
      }
      setFetchedTemplates(results)
      if (results.length === 0) {
        setFetchError('No AI Prompt Template plugins found in this control plane.')
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch templates')
    } finally {
      setFetching(false)
    }
  }

  const isTemplate = config.usePromptTemplate
  const hasFetchedTemplates = fetchedTemplates.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        <button
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors flex-shrink-0"
          style={isTemplate
            ? { background: '#1a0d2e', color: '#c084fc', border: '1px solid rgba(192,132,252,0.4)' }
            : { background: 'transparent', color: '#6b7280', border: '1px solid #2a2a2a' }
          }
          onClick={togglePromptTemplate}
          title="Use Kong AI Prompt Template plugin"
        >
          <DocumentTextIcon className="w-3.5 h-3.5" />
          Prompt Template
        </button>

        {!isTemplate && (
          <>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">Model</label>
              <input
                list="hs-ai-models"
                className="input-base text-xs py-1 w-44"
                value={config.model}
                onChange={e => patch({ model: e.target.value })}
                placeholder="gpt-4o-mini"
              />
              <datalist id="hs-ai-models">
                {COMMON_MODELS.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Temp</label>
              <input type="number" className="input-base text-xs py-1 w-16"
                min={0} max={2} step={0.1} value={config.temperature}
                onChange={e => patch({ temperature: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">Max tokens</label>
              <input type="number" className="input-base text-xs py-1 w-20"
                min={1} max={128000} value={config.maxTokens}
                onChange={e => patch({ maxTokens: parseInt(e.target.value) || 1024 })} />
            </div>
          </>
        )}
      </div>

      {/* Prompt Template mode */}
      {isTemplate ? (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Info banner */}
          <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0"
            style={{ background: 'rgba(192,132,252,0.05)' }}>
            <p className="text-xs text-gray-500 leading-relaxed">
              Using Kong <span style={{ color: '#c084fc' }}>AI Prompt Template</span> plugin.
              The gateway controls model, messages, and parameters — pick a template and fill in its variables.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Template selector */}
            <div className="px-3 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-1.5">
                <label className="text-xs text-gray-500 whitespace-nowrap w-20 flex-shrink-0">Template</label>
                <div className="flex-1 flex items-center gap-2">
                  {hasFetchedTemplates ? (
                    /* Dropdown when templates have been fetched */
                    <div className="relative flex-1">
                      <select
                        className="input-base text-xs py-1.5 w-full font-mono appearance-none pr-7"
                        value={config.promptTemplateName ?? ''}
                        onChange={e => selectTemplate(e.target.value)}
                      >
                        <option value="">— select a template —</option>
                        {fetchedTemplates.map(t => (
                          <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDownIcon className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  ) : (
                    /* Text input when no templates fetched yet */
                    <input
                      className="input-base text-xs py-1.5 flex-1 font-mono"
                      placeholder="my-template-name"
                      value={config.promptTemplateName ?? ''}
                      onChange={e => patch({ promptTemplateName: e.target.value })}
                    />
                  )}

                  {/* Fetch button — only for Konnect folders */}
                  {isKonnectFolder && (
                    <button
                      className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                      style={{ background: '#111', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
                      onClick={fetchTemplates}
                      disabled={fetching}
                      title="Fetch template names from Konnect"
                    >
                      <ArrowPathIcon className={`w-3 h-3 ${fetching ? 'animate-spin' : ''}`} />
                      {fetching ? 'Fetching…' : hasFetchedTemplates ? 'Refresh' : 'Fetch'}
                    </button>
                  )}
                </div>
              </div>

              {fetchError && (
                <p className="text-xs mt-1 pl-[88px]" style={{ color: '#f87171' }}>{fetchError}</p>
              )}

              {config.promptTemplateName && (
                <p className="text-xs font-mono pl-[88px] mt-1" style={{ color: '#4b5563' }}>
                  {`{template://${config.promptTemplateName}}`}
                </p>
              )}

              {/* Request body preview */}
              {config.promptTemplateName && (() => {
                const properties = Object.fromEntries(
                  (config.promptTemplateProperties ?? [])
                    .filter(p => p.key)
                    .map(p => [p.key, p.value])
                )
                const preview = JSON.stringify({
                  messages: [{ role: 'user', content: `{template://${config.promptTemplateName}}` }],
                  properties,
                }, null, 2)
                return (
                  <details className="mt-2 pl-[88px]">
                    <summary className="text-xs cursor-pointer select-none" style={{ color: '#4b5563' }}>
                      Preview request body
                    </summary>
                    <pre className="mt-1 text-xs font-mono rounded p-2 leading-relaxed overflow-x-auto"
                      style={{ background: '#0d0d0d', color: '#6b7280', border: '1px solid #1f1f1f' }}>
                      {preview}
                    </pre>
                  </details>
                )
              })()}

              {/* Placeholder hints from selected template */}
              {hasFetchedTemplates && config.promptTemplateName && (() => {
                const tpl = fetchedTemplates.find(t => t.name === config.promptTemplateName)
                return tpl?.placeholders.length ? (
                  <p className="text-xs mt-1.5 pl-[88px]" style={{ color: '#6b7280' }}>
                    Variables:{' '}
                    {tpl.placeholders.map(ph => (
                      <span key={ph} className="font-mono" style={{ color: '#c084fc' }}>{`{{${ph}}}`} </span>
                    ))}
                  </p>
                ) : null
              })()}
            </div>

            {/* Variables */}
            <div>
              <div className="flex items-center px-3 py-2 border-b border-gray-800">
                <span className="text-xs font-medium text-gray-400">Variables</span>
              </div>

              {props.length === 0 && (
                <p className="px-3 py-6 text-xs text-gray-600 text-center">
                  No variables yet — add the template's{' '}
                  <span className="font-mono" style={{ color: '#9ca3af' }}>{'{{'}</span>
                  <span className="font-mono" style={{ color: '#c084fc' }}>variable</span>
                  <span className="font-mono" style={{ color: '#9ca3af' }}>{'}}'}</span>
                  {' '}placeholders below.
                </p>
              )}

              {props.map(prop => (
                <div key={prop.id} className="group flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
                  <input
                    className="input-base text-xs py-1 font-mono w-36 flex-shrink-0"
                    placeholder="variable"
                    value={prop.key}
                    onChange={e => updateProp(prop.id, { key: e.target.value })}
                  />
                  <span className="text-gray-700 flex-shrink-0 text-xs">=</span>
                  <input
                    className="input-base text-xs py-1 flex-1"
                    placeholder="value"
                    value={prop.value}
                    onChange={e => updateProp(prop.id, { value: e.target.value })}
                  />
                  <button
                    className="flex-shrink-0 btn-ghost px-1 py-0 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteProp(prop.id)}
                    title="Remove variable"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 px-3 py-2 border-t border-gray-800">
            <button className="btn-ghost text-xs flex items-center gap-1" onClick={addProp}>
              <PlusIcon className="w-3.5 h-3.5" />
              Add variable
            </button>
          </div>
        </div>
      ) : (
        /* Normal messages mode */
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            {config.messages.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-gray-600">
                No messages yet — add one below to start building your prompt.
              </div>
            )}
            {config.messages.map(msg => {
              const style = ROLE_STYLES[msg.role]
              return (
                <div key={msg.id} className="group border-b border-gray-800/50">
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <button
                      className="flex-shrink-0 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded transition-opacity hover:opacity-75"
                      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}`, minWidth: 68 }}
                      title="Click to cycle role"
                      onClick={() => cycleRole(msg.id, msg.role)}
                    >
                      {msg.role}
                    </button>
                    <textarea
                      className="flex-1 text-xs text-gray-200 bg-transparent border-none outline-none resize-none font-mono leading-relaxed pt-0.5"
                      style={{ minHeight: 36 }}
                      placeholder={PLACEHOLDER[msg.role]}
                      value={msg.content}
                      rows={1}
                      onChange={e => {
                        autoResize(e.target)
                        updateMessage(msg.id, { content: e.target.value })
                      }}
                      onFocus={e => autoResize(e.target)}
                    />
                    <button
                      className="flex-shrink-0 mt-0.5 btn-ghost px-1 py-0 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove message"
                      onClick={() => deleteMessage(msg.id)}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex-shrink-0 px-3 py-2 border-t border-gray-800">
            <button className="btn-ghost text-xs flex items-center gap-1" onClick={addMessage}>
              <PlusIcon className="w-3.5 h-3.5" />
              Add message
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
