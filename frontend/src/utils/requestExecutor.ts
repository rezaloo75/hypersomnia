import { v4 as uuid } from 'uuid'
import type { Folder, Request, RequestExecution, ResponseData } from '../types'
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

/** Returns true for localhost / 127.0.0.1 / ::1 targets. */
function isLocalUrl(url: string): boolean {
  const normalized = /^https?:\/\//i.test(url) ? url : `http://${url}`
  try {
    const { hostname } = new URL(normalized)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

/** Send directly from the browser — used for local URLs that the relay can't reach. */
async function executeDirectly(
  request: Request,
  url: string,
  headers: Record<string, string>,
  body: string | undefined,
  startTime: number,
): Promise<RequestExecution> {
  const fullUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`

  try {
    const res = await fetch(fullUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : body,
    })

    const responseBody = await res.text()
    const responseHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => { responseHeaders[key] = value })

    const time = Date.now() - startTime
    const size = new TextEncoder().encode(responseBody).length

    const response: ResponseData = {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: responseBody,
      time,
      size,
    }

    return {
      id: uuid(),
      requestId: request.id,
      requestName: request.name,
      timestamp: new Date().toISOString(),
      request: { method: request.method, url: fullUrl, headers, body },
      response,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    // "Failed to fetch" is the browser's generic CORS / connection-refused error
    const hint = msg.toLowerCase().includes('failed to fetch')
      ? `${msg}\n\nCould not reach ${fullUrl}. Make sure:\n1. Your local server is running\n2. It allows CORS from this origin:\n   Access-Control-Allow-Origin: *`
      : msg

    return {
      id: uuid(),
      requestId: request.id,
      requestName: request.name,
      timestamp: new Date().toISOString(),
      request: { method: request.method, url: fullUrl, headers },
      response: { status: 0, statusText: 'Network Error', headers: {}, body: hint, time: Date.now() - startTime, size: 0 },
      error: msg,
    }
  }
}

export async function executeRequest(
  request: Request,
  variables: Record<string, string>,
  topLevelFolder?: Folder,
): Promise<RequestExecution> {
  const { url, headers, body } = resolveAll(request, variables)

  const startTime = Date.now()

  // Local URLs can't go through the Railway relay — send directly from the browser
  if (isLocalUrl(url)) {
    return executeDirectly(request, url, headers, body, startTime)
  }

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
