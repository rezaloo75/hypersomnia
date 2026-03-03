interface Props {
  headers: Record<string, string>
}

export function HeadersViewer({ headers }: Props) {
  const entries = Object.entries(headers)

  if (entries.length === 0) {
    return <div className="p-4 text-xs text-gray-500">No response headers</div>
  }

  return (
    <div className="overflow-y-auto h-full">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
          <tr>
            <th className="text-left px-3 py-2 text-gray-400 font-medium w-1/2">Header</th>
            <th className="text-left px-3 py-2 text-gray-400 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="px-3 py-1.5 text-indigo-300 font-medium">{key}</td>
              <td className="px-3 py-1.5 text-gray-300 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
