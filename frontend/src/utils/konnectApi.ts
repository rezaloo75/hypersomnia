export type KonnectRegion = 'global' | 'us' | 'eu' | 'au'

export const REGION_LABELS: Record<KonnectRegion, string> = {
  global: 'Global',
  us: 'US',
  eu: 'EU',
  au: 'Australia',
}

const REGION_BASES: Record<KonnectRegion, string> = {
  global: 'https://global.api.konghq.com',
  us: 'https://us.api.konghq.com',
  eu: 'https://eu.api.konghq.com',
  au: 'https://au.api.konghq.com',
}

export interface KonnectProxyUrl {
  host: string
  port: number
  protocol: string
}

export interface KonnectCP {
  id: string
  name: string
  proxy_urls?: KonnectProxyUrl[]
  config?: { control_plane_endpoint?: string }
}

export interface KonnectService {
  id: string
  name: string
}

export interface KonnectRoute {
  id: string
  name?: string
  methods?: string[] | null
  paths?: string[] | null
  service?: { id: string } | null
}

function headers(pat: string) {
  return { Authorization: `Bearer ${pat}` }
}

export function buildBaseUrl(proxyUrls?: KonnectProxyUrl[]): string {
  if (!proxyUrls?.length) return ''
  const p = proxyUrls[0]
  const isDefaultPort =
    (p.protocol === 'https' && p.port === 443) ||
    (p.protocol === 'http' && p.port === 80)
  return isDefaultPort
    ? `${p.protocol}://${p.host}`
    : `${p.protocol}://${p.host}:${p.port}`
}

export async function listControlPlanes(pat: string, region: KonnectRegion): Promise<KonnectCP[]> {
  const base = REGION_BASES[region]
  const results: KonnectCP[] = []
  let pageAfter: string | undefined
  do {
    const url = new URL(`${base}/v2/control-planes`)
    url.searchParams.set('pageSize', '100')
    if (pageAfter) url.searchParams.set('pageAfter', pageAfter)
    const res = await fetch(url.toString(), { headers: headers(pat) })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`)
    }
    const json = await res.json()
    results.push(...(json.data ?? []))
    pageAfter = json.meta?.next?.cursor ?? undefined
  } while (pageAfter)
  return results
}

export async function listServices(
  pat: string,
  region: KonnectRegion,
  cpId: string,
): Promise<KonnectService[]> {
  const base = REGION_BASES[region]
  const results: KonnectService[] = []
  let offset: string | undefined
  do {
    const url = new URL(`${base}/v2/control-planes/${cpId}/core-entities/services`)
    url.searchParams.set('size', '1000')
    if (offset) url.searchParams.set('offset', offset)
    const res = await fetch(url.toString(), { headers: headers(pat) })
    if (!res.ok) throw new Error(`services ${res.status}`)
    const json = await res.json()
    results.push(...(json.data ?? []))
    offset = json.offset
  } while (offset)
  return results
}

export async function listRoutes(
  pat: string,
  region: KonnectRegion,
  cpId: string,
): Promise<KonnectRoute[]> {
  const base = REGION_BASES[region]
  const results: KonnectRoute[] = []
  let offset: string | undefined
  do {
    const url = new URL(`${base}/v2/control-planes/${cpId}/core-entities/routes`)
    url.searchParams.set('size', '1000')
    if (offset) url.searchParams.set('offset', offset)
    const res = await fetch(url.toString(), { headers: headers(pat) })
    if (!res.ok) throw new Error(`routes ${res.status}`)
    const json = await res.json()
    results.push(...(json.data ?? []))
    offset = json.offset
  } while (offset)
  return results
}
