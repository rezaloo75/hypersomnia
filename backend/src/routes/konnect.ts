import { Router, type Request, type Response } from 'express'

export const konnectRouter = Router()

const REGION_BASES: Record<string, string> = {
  global: 'https://global.api.konghq.com',
  us: 'https://us.api.konghq.com',
  eu: 'https://eu.api.konghq.com',
  au: 'https://au.api.konghq.com',
}

// POST /api/konnect
// Body: { pat: string, region: string, path: string, method?: string, params?: Record<string, string>, body?: unknown }
// Proxies a request to the Konnect API and returns the parsed JSON response.
konnectRouter.post('/', async (req: Request, res: Response) => {
  const { pat, region, path, method, params, body: reqBody } = req.body as {
    pat: string
    region: string
    path: string
    method?: string
    params?: Record<string, string>
    body?: unknown
  }

  if (!pat || !path) {
    res.status(400).json({ error: 'pat and path are required' })
    return
  }

  const httpMethod = (method ?? 'GET').toUpperCase()

  const base = REGION_BASES[region] ?? REGION_BASES.global
  const url = new URL(`${base}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${pat}` }
    const fetchOpts: RequestInit = { method: httpMethod, headers }

    if (reqBody !== undefined && httpMethod !== 'GET') {
      headers['Content-Type'] = 'application/json'
      fetchOpts.body = JSON.stringify(reqBody)
    }

    const response = await fetch(url.toString(), fetchOpts)

    const text = await response.text()
    let responseBody: unknown
    try {
      responseBody = JSON.parse(text)
    } catch {
      responseBody = text
    }

    res.status(response.status).json(responseBody)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(502).json({ error: msg })
  }
})
