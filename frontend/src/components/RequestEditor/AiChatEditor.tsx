import { v4 as uuid } from 'uuid'
import { PlusIcon, TrashIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useWorkspaceStore } from '../../store/workspaceStore'
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

interface Props {
  request: Request
}

export function AiChatEditor({ request }: Props) {
  const { updateRequest } = useWorkspaceStore()

  const config: AiChatConfig = request.aiChat ?? {
    model: 'gpt-4o-mini',
    temperature: 1,
    maxTokens: 1024,
    messages: [],
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
    const next = !config.usePromptTemplate
    patch({
      usePromptTemplate: next,
      promptTemplateName: config.promptTemplateName ?? '',
      promptTemplateProperties: config.promptTemplateProperties ?? [],
    })
  }

  const isTemplate = config.usePromptTemplate

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: mode toggle + (when not template) model params */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 border-b border-gray-800 flex-shrink-0">
        {/* Prompt Template toggle */}
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

        {/* Model params — hidden in template mode */}
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
              <input
                type="number"
                className="input-base text-xs py-1 w-16"
                min={0} max={2} step={0.1}
                value={config.temperature}
                onChange={e => patch({ temperature: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 whitespace-nowrap">Max tokens</label>
              <input
                type="number"
                className="input-base text-xs py-1 w-20"
                min={1} max={128000}
                value={config.maxTokens}
                onChange={e => patch({ maxTokens: parseInt(e.target.value) || 1024 })}
              />
            </div>
          </>
        )}
      </div>

      {/* Prompt Template mode */}
      {isTemplate ? (
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Template info banner */}
          <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0"
            style={{ background: 'rgba(192,132,252,0.05)' }}>
            <p className="text-xs text-gray-500 leading-relaxed">
              Using Kong <span style={{ color: '#c084fc' }}>AI Prompt Template</span> plugin.
              The gateway controls model, messages, and parameters — specify the template name
              and fill in its variables below.
            </p>
          </div>

          {/* Template name */}
          <div className="px-3 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap w-20 flex-shrink-0">Template</label>
              <input
                className="input-base text-xs py-1.5 flex-1 font-mono"
                placeholder="my-template-name"
                value={config.promptTemplateName ?? ''}
                onChange={e => patch({ promptTemplateName: e.target.value })}
              />
            </div>
            {config.promptTemplateName && (
              <p className="mt-1.5 text-xs font-mono pl-[88px]" style={{ color: '#6b7280' }}>
                {`{template://${config.promptTemplateName}}`}
              </p>
            )}
          </div>

          {/* Variables */}
          <div className="flex-1">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
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
