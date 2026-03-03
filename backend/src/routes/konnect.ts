import { Router, type Request, type Response } from 'express'

export const konnectRouter = Router()

const REGION_BASES: Record<string, string> = {
  global: 'https://global.api.konghq.com',
  us: 'https://us.api.konghq.com',
  eu: 'https://eu.api.konghq.com',
  au: 'https://au.api.konghq.com',
}

// POST /api/konnect
// Body: { pat: string, region: string, path: string, params?: Record<string, string> }
// Proxies a GET request to the Konnect API and returns the parsed JSON response.
konnectRouter.post('/', async (req: Request, res: Response) => {
  const { pat, region, path, params } = req.body as {
    pat: string
    region: string
    path: string
    params?: Record<string, string>
  }

  if (!pat || !path) {
    res.status(400).json({ error: 'pat and path are required' })
    return
  }

  const base = REGION_BASES[region] ?? REGION_BASES.global
  const url = new URL(`${base}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${pat}` },
    })

    const text = await response.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }

    res.status(response.status).json(body)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    res.status(502).json({ error: msg })
  }
})
