import type { AIMessage as AIMessageType } from '../../types'

interface Props {
  message: AIMessageType
}

export function AIMessage({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[85%] rounded-lg px-3 py-2 text-xs"
        style={isUser
          ? { background: '#2f6f07', color: '#f0fde4' }
          : { background: '#1a1a1a', color: '#e5e7eb' }
        }
      >
        {!isUser && (
          <div className="font-semibold text-xs mb-1" style={{ color: '#6fdc0e' }}>✦ AI</div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  )
}
