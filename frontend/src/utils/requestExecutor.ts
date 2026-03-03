import { v4 as uuid } from 'uuid'
import type { Request, RequestExecution, ResponseData } from '../types'
import { interpolate } from './interpolate'
import { API_BASE } from './api'

function resolveAll(request: Request, variables: Record<string, string>): {
  url: string
  headers: Record<string, string>
  body: string | undefined
} {
  const resolve = (s: string) => interpolate(s, variables).resolved

  const url = (() => {
    let base = resolve(request.url)
    const params = request.queryParams.filter(p => p.enabled && p.key)
    if (params.length > 0) {
      const qs = params.map(p => `${encodeURIComponent(resolve(p.key))}=${encodeURIComponent(resolve(p.value))}`).join('&')
      base += (base.includes('?') ? '&' : '?') + qs
    }
    return base
  })()

  const headers: Record<string, string> = {}

  // Auth headers
  if (request.auth.type === 'bearer' && request.auth.token) {
    headers['Authorization'] = `Bearer ${resolve(request.auth.token)}`
  } else if (request.auth.type === 'basic' && request.auth.username) {
    const creds = btoa(`${resolve(request.auth.username)}:${resolve(request.auth.password ?? '')}`)
    headers['Authorization'] = `Basic ${creds}`
  } else if (request.auth.type === 'apikey' && request.auth.apiKey) {
    const name = request.auth.apiKeyName ?? 'X-API-Key'
    if (!request.auth.apiKeyIn || request.auth.apiKeyIn === 'header') {
      headers[name] = resolve(request.auth.apiKey)
    }
  }

  // Custom headers
  for (const h of request.headers) {
    if (h.enabled && h.key) {
      headers[resolve(h.key)] = resolve(h.value)
    }
  }

  // Body
  let body: string | undefined
  if (request.body.type === 'json' && request.body.content) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
    body = resolve(request.body.content)
  } else if (request.body.type === 'form-urlencoded' && request.body.content) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/x-www-form-urlencoded'
    body = resolve(request.body.content)
  } else if (request.body.type === 'raw' && request.body.content) {
    body = resolve(request.body.content)
  }

  return { url, headers, body }
}

export async function executeRequest(
  request: Request,
  variables: Record<string, string>
): Promise<RequestExecution> {
  const { url, headers, body } = resolveAll(request, variables)

  const startTime = Date.now()

  try {
    const res = await fetch(`${API_BASE}/api/relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: request.method,
        url,
        headers,
        body,
        timeout: request.settings.timeout ?? 30000,
      }),
    })

    const data = await res.json() as {
      status?: number
      statusText?: string
      headers?: Record<string, string>
      body?: string
      time?: number
      size?: number
      error?: string
    }

    if (data.error) {
      const execution: RequestExecution = {
        id: uuid(),
        requestId: request.id,
        requestName: request.name,
        timestamp: new Date().toISOString(),
        request: { method: request.method, url, headers },
        response: { status: 0, statusText: 'Error', headers: {}, body: data.error, time: Date.now() - startTime, size: 0 },
        error: data.error,
      }
      return execution
    }

    const response: ResponseData = {
      status: data.status ?? 0,
      statusText: data.statusText ?? '',
      headers: data.headers ?? {},
      body: data.body ?? '',
      time: data.time ?? (Date.now() - startTime),
      size: data.size ?? 0,
    }

    return {
      id: uuid(),
      requestId: request.id,
      requestName: request.name,
      timestamp: new Date().toISOString(),
      request: { method: request.method, url, headers, body },
      response,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return {
      id: uuid(),
      requestId: request.id,
      requestName: request.name,
      timestamp: new Date().toISOString(),
      request: { method: request.method, url, headers },
      response: { status: 0, statusText: 'Network Error', headers: {}, body: msg, time: Date.now() - startTime, size: 0 },
      error: msg,
    }
  }
}
