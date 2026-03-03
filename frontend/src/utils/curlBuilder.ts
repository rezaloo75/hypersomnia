import type { Request } from '../types'
import { interpolate } from './interpolate'

export function buildCurl(request: Request, variables: Record<string, string> = {}): string {
  const resolve = (s: string) => interpolate(s, variables).resolved

  const parts: string[] = ['curl']

  // Method
  if (request.method !== 'GET') {
    parts.push(`-X ${request.method}`)
  }

  // Auth
  if (request.auth.type === 'bearer' && request.auth.token) {
    parts.push(`-H "Authorization: Bearer ${resolve(request.auth.token)}"`)
  } else if (request.auth.type === 'basic' && request.auth.username) {
    const u = resolve(request.auth.username)
    const p = resolve(request.auth.password ?? '')
    parts.push(`-u "${u}:${p}"`)
  } else if (request.auth.type === 'apikey' && request.auth.apiKey) {
    const name = request.auth.apiKeyName ?? 'X-API-Key'
    if (!request.auth.apiKeyIn || request.auth.apiKeyIn === 'header') {
      parts.push(`-H "${name}: ${resolve(request.auth.apiKey)}"`)
    }
  }

  // Headers
  for (const h of request.headers) {
    if (h.enabled && h.key) {
      parts.push(`-H "${resolve(h.key)}: ${resolve(h.value)}"`)
    }
  }

  // Body
  if (request.body.type === 'json' && request.body.content) {
    parts.push(`-H "Content-Type: application/json"`)
    const escaped = resolve(request.body.content).replace(/'/g, "'\\''")
    parts.push(`-d '${escaped}'`)
  } else if (request.body.type === 'form-urlencoded' && request.body.content) {
    parts.push(`--data-urlencode '${resolve(request.body.content)}'`)
  } else if (request.body.type === 'raw' && request.body.content) {
    const escaped = resolve(request.body.content).replace(/'/g, "'\\''")
    parts.push(`-d '${escaped}'`)
  }

  // URL with query params
  let url = resolve(request.url)
  const params = request.queryParams.filter(p => p.enabled && p.key)
  if (params.length > 0) {
    const qs = params.map(p => `${encodeURIComponent(resolve(p.key))}=${encodeURIComponent(resolve(p.value))}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  parts.push(`"${url}"`)

  return parts.join(' \\\n  ')
}
