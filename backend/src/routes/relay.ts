import { Router, type Request, type Response } from 'express'
import { checkSsrf } from '../middleware/ssrf.js'

export const relayRouter = Router()

relayRouter.post('/', async (req: Request, res: Response) => {
  const { method, url, headers = {}, body, timeout = 30000 } = req.body as {
    method: string
    url: string
    headers?: Record<string, string>
    body?: string
    timeout?: number
  }

  if (!method || !url) {
    res.status(400).json({ error: 'method and url are required' })
    return
  }

  // SSRF protection
  try {
    await checkSsrf(url)
  } catch (err) {
    res.status(400).json({ error: `SSRF protection: ${err instanceof Error ? err.message : 'blocked'}` })
    return
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), Math.min(timeout, 60000))

  const startTime = Date.now()

  try {
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: sanitizeHeaders(headers),
      signal: controller.signal,
      redirect: 'follow',
    }

    if (body && !['GET', 'HEAD', 'DELETE'].includes(method.toUpperCase())) {
      fetchOptions.body = body
    }

    const response = await fetch(url, fetchOptions)
    const elapsed = Date.now() - startTime

    // Read body as text (handle binary with base64 if needed)
    const contentType = response.headers.get('content-type') ?? ''
    let responseBody: string

    if (contentType.includes('application/') && !contentType.includes('json') && !contentType.includes('xml') && !contentType.includes('text')) {
      const buffer = await response.arrayBuffer()
      responseBody = `[Binary content: ${buffer.byteLength} bytes]`
    } else {
      responseBody = await response.text()
    }

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      time: elapsed,
      size: Buffer.byteLength(responseBody, 'utf8'),
    })
  } catch (err) {
    const elapsed = Date.now() - startTime
    if (err instanceof Error && err.name === 'AbortError') {
      res.json({ error: `Request timed out after ${timeout}ms`, status: 0, statusText: 'Timeout', headers: {}, body: '', time: elapsed, size: 0 })
      return
    }
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.json({ error: msg, status: 0, statusText: 'Error', headers: {}, body: '', time: elapsed, size: 0 })
  } finally {
    clearTimeout(timeoutId)
  }
})

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const blocked = new Set(['host', 'connection', 'transfer-encoding'])
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (!blocked.has(k.toLowerCase())) {
      result[k] = v
    }
  }
  return result
}
