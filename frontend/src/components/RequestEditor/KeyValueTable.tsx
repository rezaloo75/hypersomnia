import { v4 as uuid } from 'uuid'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { KeyValuePair } from '../../types'

interface Props {
  pairs: KeyValuePair[]
  onChange: (pairs: KeyValuePair[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}

export function KeyValueTable({ pairs, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }: Props) {
  function add() {
    onChange([...pairs, { id: uuid(), key: '', value: '', enabled: true }])
  }

  function remove(id: string) {
    onChange(pairs.filter(p => p.id !== id))
  }

  function update(id: string, field: keyof KeyValuePair, value: string | boolean) {
    onChange(pairs.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  return (
    <div className="p-3">
      <div className="space-y-1">
        {pairs.map(pair => (
          <div key={pair.id} className="flex items-center gap-1">
            <input
              type="checkbox"
              className="flex-shrink-0 accent-indigo-500"
              checked={pair.enabled}
              onChange={e => update(pair.id, 'enabled', e.target.checked)}
            />
            <input
              className={`input-base flex-1 text-xs py-1 ${!pair.enabled ? 'opacity-50' : ''}`}
              placeholder={keyPlaceholder}
              value={pair.key}
              onChange={e => update(pair.id, 'key', e.target.value)}
            />
            <input
              className={`input-base flex-1 text-xs py-1 ${!pair.enabled ? 'opacity-50' : ''}`}
              placeholder={valuePlaceholder}
              value={pair.value}
              onChange={e => update(pair.id, 'value', e.target.value)}
            />
            <button
              className="btn-ghost text-xs px-1.5 text-red-400 flex-shrink-0"
              onClick={() => remove(pair.id)}
            ><XMarkIcon className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
      <button className="btn-ghost text-xs mt-2" onClick={add}>+ Add</button>
    </div>
  )
}
