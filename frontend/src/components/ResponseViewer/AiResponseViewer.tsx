interface OpenAiChoice {
  index: number
  message: { role: string; content: string | null; refusal?: string | null }
  finish_reason: string | null
}

interface OpenAiUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number; audio_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number; accepted_prediction_tokens?: number; rejected_prediction_tokens?: number }
}

export interface OpenAiCompletion {
  id?: string
  object?: string
  created?: number
  model?: string
  system_fingerprint?: string
  service_tier?: string
  choices?: OpenAiChoice[]
  usage?: OpenAiUsage
}

export function parseAiCompletion(body: string): OpenAiCompletion | null {
  try {
    const parsed = JSON.parse(body)
    if (parsed && Array.isArray(parsed.choices)) return parsed as OpenAiCompletion
    return null
  } catch {
    return null
  }
}

const NEON = '#6fdc0e'
const AI_PURPLE = '#a78bfa'

function MetaRow({ label, value, mono = false, accent }: {
  label: string
  value: React.ReactNode
  mono?: boolean
  accent?: string
}) {
  return (
    <tr className="border-b border-gray-800/60">
      <td className="py-2 pr-6 text-xs text-gray-500 whitespace-nowrap align-top w-44">{label}</td>
      <td className={`py-2 text-xs align-top ${mono ? 'font-mono' : ''}`} style={accent ? { color: accent } : { color: '#e5e7eb' }}>
        {value}
      </td>
    </tr>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-5 pb-1">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: NEON, letterSpacing: '0.1em' }}>
          {label}
        </span>
      </td>
    </tr>
  )
}

function formatCreated(ts: number): string {
  try {
    return new Date(ts * 1000).toLocaleString()
  } catch {
    return String(ts)
  }
}

function FinishBadge({ reason }: { reason: string | null }) {
  if (!reason) return <span className="text-gray-500">—</span>
  const color = reason === 'stop' ? NEON : reason === 'length' ? '#f59e0b' : reason === 'content_filter' ? '#f87171' : '#9ca3af'
  return (
    <span className="px-1.5 py-0.5 rounded font-mono text-xs"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {reason}
    </span>
  )
}

// ── Message Content tab ────────────────────────────────────────────────────

interface MessageContentProps { completion: OpenAiCompletion }

export function AiMessageContent({ completion }: MessageContentProps) {
  const choices = completion.choices ?? []

  if (choices.length === 0) {
    return <div className="p-4 text-xs text-gray-500">No choices in response.</div>
  }

  return (
    <div className="h-full overflow-y-auto">
      {choices.map((choice, i) => {
        const content = choice.message.content ?? choice.message.refusal ?? ''
        return (
          <div key={i} className={choices.length > 1 ? 'border-b border-gray-800' : ''}>
            {choices.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800" style={{ background: '#0d1a00' }}>
                <span className="text-xs font-semibold" style={{ color: NEON }}>Choice {i}</span>
                <FinishBadge reason={choice.finish_reason} />
              </div>
            )}
            <div className="px-5 py-4">
              {/* Role label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{ background: '#0d1a00', color: NEON, border: '1px solid rgba(111,220,14,0.3)' }}>
                  {choice.message.role}
                </span>
                {choices.length === 1 && choice.finish_reason && (
                  <FinishBadge reason={choice.finish_reason} />
                )}
              </div>
              {/* Content */}
              {content ? (
                <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {content}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic">Empty content</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── AI Metadata tab ────────────────────────────────────────────────────────

interface MetadataProps { completion: OpenAiCompletion }

export function AiMetadata({ completion }: MetadataProps) {
  const { id, object, created, model, system_fingerprint, service_tier, choices = [], usage } = completion

  const hasUsageDetails =
    usage?.prompt_tokens_details?.cached_tokens != null ||
    usage?.prompt_tokens_details?.audio_tokens != null ||
    usage?.completion_tokens_details?.reasoning_tokens != null

  return (
    <div className="h-full overflow-y-auto px-5 py-4 font-mono text-xs">
      <table className="w-full border-collapse">
        <tbody>
          {/* Response */}
          <SectionHeader label="Response" />
          {id         && <MetaRow label="ID"                 value={id}               mono />}
          {object     && <MetaRow label="Object"             value={object}           mono />}
          {created    && <MetaRow label="Created"            value={<>{formatCreated(created)} <span className="text-gray-600">({created})</span></>} />}
          {model      && <MetaRow label="Model"              value={model}            mono accent={AI_PURPLE} />}
          {service_tier        && <MetaRow label="Service Tier"      value={service_tier}     mono />}
          {system_fingerprint  && <MetaRow label="System Fingerprint" value={system_fingerprint} mono />}

          {/* Choices */}
          {choices.map((choice, i) => (
            <>
              <SectionHeader key={`sh-${i}`} label={choices.length > 1 ? `Choice ${i}` : 'Choice'} />
              <MetaRow key={`role-${i}`}   label="Role"          value={choice.message.role}  mono />
              <MetaRow key={`fr-${i}`}     label="Finish Reason" value={<FinishBadge reason={choice.finish_reason} />} />
            </>
          ))}

          {/* Usage */}
          {usage && (
            <>
              <SectionHeader label="Usage" />
              {usage.prompt_tokens     != null && <MetaRow label="Prompt Tokens"     value={usage.prompt_tokens.toLocaleString()}     mono />}
              {usage.completion_tokens != null && <MetaRow label="Completion Tokens" value={usage.completion_tokens.toLocaleString()} mono />}
              {usage.total_tokens      != null && <MetaRow label="Total Tokens"      value={<span style={{ color: NEON }}>{usage.total_tokens.toLocaleString()}</span>} mono />}

              {hasUsageDetails && (
                <>
                  <SectionHeader label="Token Details" />
                  {usage.prompt_tokens_details?.cached_tokens      != null && <MetaRow label="Cached Tokens"     value={usage.prompt_tokens_details.cached_tokens.toLocaleString()} mono />}
                  {usage.prompt_tokens_details?.audio_tokens       != null && <MetaRow label="Audio Tokens (in)" value={usage.prompt_tokens_details.audio_tokens.toLocaleString()} mono />}
                  {usage.completion_tokens_details?.reasoning_tokens != null && <MetaRow label="Reasoning Tokens" value={usage.completion_tokens_details.reasoning_tokens.toLocaleString()} mono />}
                </>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
