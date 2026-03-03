import { API_BASE } from './api'

export type KonnectRegion = 'global' | 'us' | 'eu' | 'au'

export const REGION_LABELS: Record<KonnectRegion, string> = {
  global: 'Global',
  us: 'US',
  eu: 'EU',
  au: 'Australia',
}

export interface KonnectProxyUrl {
  host: string
  port: number
  protocol: string
}

export interface KonnectCP {
  id: string
  name: string
  config?: {
    proxy_urls?: KonnectProxyUrl[]
    control_plane_endpoint?: string
    cluster_type?: string
  }
}

/** Extract geo slug from a control_plane_endpoint URL.
 *  e.g. "https://3d67a91782.us.cp0.konghq.com" → "us" */
export function extractGeo(endpoint?: string): string | null {
  if (!endpoint) return null
  const match = endpoint.match(/\.([a-z0-9-]+)\.cp0\.konghq\.com/)
  return match?.[1] ?? null
}

/** Fetch the proxy hostname for a serverless CP from the (undocumented) v3 cloud-gateways API.
 *  Returns a full https:// URL or null if unavailable. */
export async function getCloudGatewayBaseUrl(
  pat: string,
  cpId: string,
  geo: string,
): Promise<string | null> {
  const json = await konnectGet(pat, 'global', '/v3/cloud-gateways/configurations', {
    'filter[control_plane_id]': cpId,
    'filter[control_plane_geo]': geo,
  })
  console.log(`[Konnect] cloud-gateways config for ${cpId}:`, JSON.stringify(json, null, 2))
  const data = (json as { data?: Array<Record<string, unknown>> }).data
  const hostname = (data?.[0]?.dataplane_groups as Array<{ hostnames?: string[] }>)?.[0]?.hostnames?.[0]
  return hostname ? `https://${hostname}` : null
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

export function buildBaseUrl(cp: KonnectCP): string {
  const proxyUrls = cp.config?.proxy_urls
  if (proxyUrls?.length) {
    const p = proxyUrls[0]
    const isDefaultPort =
      (p.protocol === 'https' && p.port === 443) ||
      (p.protocol === 'http' && p.port === 80)
    return isDefaultPort
      ? `${p.protocol}://${p.host}`
      : `${p.protocol}://${p.host}:${p.port}`
  }
  return ''
}

async function konnectGet(
  pat: string,
  region: KonnectRegion,
  path: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/konnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pat, region, path, params }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`)
  }
  return res.json()
}

export async function listControlPlanes(pat: string, region: KonnectRegion): Promise<KonnectCP[]> {
  const results: KonnectCP[] = []
  let pageAfter: string | undefined
  do {
    const params: Record<string, string> = { pageSize: '100' }
    if (pageAfter) params.pageAfter = pageAfter
    const json = await konnectGet(pat, region, '/v2/control-planes', params) as { data?: KonnectCP[]; meta?: { next?: { cursor?: string } } }
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
  const results: KonnectService[] = []
  let offset: string | undefined
  do {
    const params: Record<string, string> = { size: '1000' }
    if (offset) params.offset = offset
    const json = await konnectGet(pat, region, `/v2/control-planes/${cpId}/core-entities/services`, params) as { data?: KonnectService[]; offset?: string }
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
  const results: KonnectRoute[] = []
  let offset: string | undefined
  do {
    const params: Record<string, string> = { size: '1000' }
    if (offset) params.offset = offset
    const json = await konnectGet(pat, region, `/v2/control-planes/${cpId}/core-entities/routes`, params) as { data?: KonnectRoute[]; offset?: string }
    results.push(...(json.data ?? []))
    offset = json.offset
  } while (offset)
  return results
}
