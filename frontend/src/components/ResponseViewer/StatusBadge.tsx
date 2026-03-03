interface Props {
  status: number
  statusText: string
}

export function StatusBadge({ status, statusText }: Props) {
  if (status === 0) {
    return <span className="text-xs font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded">Error</span>
  }

  const colorClass = status < 300
    ? 'text-green-400 bg-green-900/30'
    : status < 400
    ? 'text-yellow-400 bg-yellow-900/30'
    : status < 500
    ? 'text-orange-400 bg-orange-900/30'
    : 'text-red-400 bg-red-900/30'

  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${colorClass}`}>
      {status} {statusText}
    </span>
  )
}
