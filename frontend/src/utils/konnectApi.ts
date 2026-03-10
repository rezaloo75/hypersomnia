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

/** Extract the CP prefix from a control_plane_endpoint URL.
 *  e.g. "https://cf032d53cb.us.cp0.konghq.com" → "cf032d53cb" */
export function extractCpPrefix(endpoint?: string): string | null {
  if (!endpoint) return null
  const match = endpoint.match(/^https?:\/\/([a-z0-9]+)\./)
  return match?.[1] ?? null
}

export interface CloudGatewayResult {
  url: string | null
  /** Normalized CP kind derived from the v3 cloud-gateways API — more reliable than cluster_type. */
  cpKind: 'serverless' | 'dedicated' | null
}

/** Fetch the proxy hostname for a cloud gateway CP from the (undocumented) v3 cloud-gateways API. */
export async function getCloudGatewayBaseUrl(
  pat: string,
  cpId: string,
  geo: string,
  cpEndpoint?: string,
): Promise<CloudGatewayResult | null> {
  const json = await konnectGet(pat, 'global', '/v3/cloud-gateways/configurations', {
    'filter[control_plane_id]': cpId,
    'filter[control_plane_geo]': geo,
  }) as { data?: Array<Record<string, unknown>> }

  const config = json.data?.[0]
  if (!config) return null

  const kind = config.kind as string

  // Serverless gateways: proxy hostname is in dataplane_groups[].hostnames[]
  if (kind === 'serverless.v0') {
    const hostname = (config.dataplane_groups as Array<{ hostnames?: string[] }>)?.[0]?.hostnames?.[0]
    return { url: hostname ? `https://${hostname}` : null, cpKind: 'serverless' }
  }

  // Dedicated gateways: Public Edge DNS is derived from the control_plane_endpoint prefix.
  if (kind === 'dedicated.v0') {
    const prefix = extractCpPrefix(cpEndpoint)
    return { url: prefix ? `https://${prefix}.gateways.konggateway.com` : null, cpKind: 'dedicated' }
  }

  return { url: null, cpKind: null }
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

/** Normalize a stored kongCpType value to a simplified category.
 *  Handles clean values ('serverless', 'dedicated') stored from the v3 API,
 *  as well as raw cluster_type strings like CLUSTER_TYPE_SERVER_LESS from the v2 API. */
export function cpKindFromClusterType(clusterType?: string): 'serverless' | 'dedicated' | 'hybrid' {
  if (!clusterType) return 'hybrid'
  // Already-normalized values stored from the v3 cloud-gateways API
  if (clusterType === 'serverless') return 'serverless'
  if (clusterType === 'dedicated') return 'dedicated'
  // Raw cluster_type strings from the v2 API: normalize by stripping underscores/dashes
  const t = clusterType.toUpperCase().replace(/[_-]/g, '')
  if (t.includes('SERVERLESS')) return 'serverless'
  // CLUSTER_TYPE_CONTROL_PLANE is hybrid (manages hybrid DPs), not dedicated cloud.
  // Dedicated is only reliably identified when stored from the v3 cloud-gateways API above.
  return 'hybrid'
}

/** Fetch the current KONG_REQUEST_DEBUG_TOKEN env var from a dedicated cloud gateway configuration.
 *  Returns the token string if found, or null if not set / not reachable. */
export async function fetchDedicatedCpDebugToken(
  pat: string,
  cpId: string,
  geo: string,
): Promise<string | null> {
  try {
    const json = await konnectGet(pat, 'global', '/v3/cloud-gateways/configurations', {
      'filter[control_plane_id]': cpId,
      'filter[control_plane_geo]': geo,
    }) as { data?: Array<Record<string, unknown>> }

    const config = json.data?.[0]
    if (!config) return null

    // Try top-level environment_variables
    const topEnv = config.environment_variables as Record<string, unknown> | undefined
    if (topEnv?.KONG_REQUEST_DEBUG_TOKEN) return String(topEnv.KONG_REQUEST_DEBUG_TOKEN)

    // Try dataplane_groups[].environment_variables
    const groups = config.dataplane_groups as Array<Record<string, unknown>> | undefined
    for (const group of groups ?? []) {
      const env = group.environment_variables as Record<string, unknown> | undefined
      if (env?.KONG_REQUEST_DEBUG_TOKEN) return String(env.KONG_REQUEST_DEBUG_TOKEN)
    }

    return null
  } catch {
    return null
  }
}

/** Fetch full detail for a control plane. */
export async function getCpDetail(
  pat: string,
  region: KonnectRegion,
  cpId: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await konnectGet(pat, region, `/v2/control-planes/${cpId}`) as Record<string, unknown>
  } catch { return null }
}

/** Fetch all plugins for a CP (global + route-scoped + service-scoped). */
export async function listAllPlugins(
  pat: string,
  region: KonnectRegion,
  cpId: string,
): Promise<Array<Record<string, unknown>>> {
  try {
    const json = await konnectGet(pat, region, `/v2/control-planes/${cpId}/core-entities/plugins`, { size: '1000' }) as { data?: Array<Record<string, unknown>> }
    return json.data ?? []
  } catch { return [] }
}

/** Fetch a single route's full detail from a CP. */
export async function getRouteDetail(
  pat: string,
  region: KonnectRegion,
  cpId: string,
  routeId: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await konnectGet(pat, region, `/v2/control-planes/${cpId}/core-entities/routes/${routeId}`) as Record<string, unknown>
  } catch { return null }
}

/** Fetch a single service's full detail from a CP. */
export async function getServiceDetail(
  pat: string,
  region: KonnectRegion,
  cpId: string,
  serviceId: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await konnectGet(pat, region, `/v2/control-planes/${cpId}/core-entities/services/${serviceId}`) as Record<string, unknown>
  } catch { return null }
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

export interface KonnectPortalApi {
  id: string
  name: string
  slug?: string
  description?: string
}

export interface KonnectApiPublication {
  id: string
  api_id?: string
  portal_id?: string
  status?: string
}

export interface KonnectPortal {
  id: string
  name: string
  custom_domain?: string | null
  default_domain?: string | null
}

export interface KonnectPortalApplication {
  id: string
  name: string
  description?: string | null
  status?: string
  created_at?: string
  developer?: {
    id?: string
    full_name?: string | null
    email?: string | null
  } | null
}

export interface KonnectApiImplementation {
  id: string
  api_id?: string
  service?: {
    id: string
    control_plane_id: string
  }
}

/** List all APIs in the API Builder. */
export async function listApis(
  pat: string,
  region: KonnectRegion,
): Promise<KonnectPortalApi[]> {
  const results: KonnectPortalApi[] = []
  let pageAfter: string | undefined
  do {
    const params: Record<string, string> = { 'page[size]': '100' }
    if (pageAfter) params['page[after]'] = pageAfter
    const json = await konnectGet(pat, region, '/v3/apis', params) as {
      data?: KonnectPortalApi[]
      meta?: { next?: { cursor?: string } }
    }
    results.push(...(json.data ?? []))
    pageAfter = json.meta?.next?.cursor ?? undefined
  } while (pageAfter)
  return results
}

/** List all portals. */
export async function listPortals(
  pat: string,
  region: KonnectRegion,
): Promise<KonnectPortal[]> {
  try {
    const results: KonnectPortal[] = []
    let pageAfter: string | undefined
    do {
      const params: Record<string, string> = { 'page[size]': '100' }
      if (pageAfter) params['page[after]'] = pageAfter
      const json = await konnectGet(pat, region, '/v3/portals', params) as {
        data?: KonnectPortal[]
        meta?: { next?: { cursor?: string } }
      }
      results.push(...(json.data ?? []))
      pageAfter = json.meta?.next?.cursor ?? undefined
    } while (pageAfter)
    return results
  } catch { return [] }
}

/** List all API publications (top-level resource). */
export async function listApiPublications(
  pat: string,
  region: KonnectRegion,
): Promise<KonnectApiPublication[]> {
  try {
    const results: KonnectApiPublication[] = []
    let pageAfter: string | undefined
    do {
      const params: Record<string, string> = { 'page[size]': '100' }
      if (pageAfter) params['page[after]'] = pageAfter
      const json = await konnectGet(pat, region, '/v3/api-publications', params) as {
        data?: KonnectApiPublication[]
        meta?: { next?: { cursor?: string } }
      }
      results.push(...(json.data ?? []))
      pageAfter = json.meta?.next?.cursor ?? undefined
    } while (pageAfter)
    return results
  } catch { return [] }
}

/** List all API implementations (top-level resource, not a sub-path of /v3/apis/{id}). */
export async function listApiImplementations(
  pat: string,
  region: KonnectRegion,
): Promise<KonnectApiImplementation[]> {
  try {
    const results: KonnectApiImplementation[] = []
    let pageAfter: string | undefined
    do {
      const params: Record<string, string> = { 'page[size]': '100' }
      if (pageAfter) params['page[after]'] = pageAfter
      const json = await konnectGet(pat, region, '/v3/api-implementations', params) as {
        data?: KonnectApiImplementation[]
        meta?: { next?: { cursor?: string } }
      }
      results.push(...(json.data ?? []))
      pageAfter = json.meta?.next?.cursor ?? undefined
    } while (pageAfter)
    return results
  } catch { return [] }
}

/** List all applications for a portal.
 *  Tries the v3 portal endpoint first; falls back to v2 (legacy portals). */
export async function listPortalApplications(
  pat: string,
  region: KonnectRegion,
  portalId: string,
): Promise<KonnectPortalApplication[]> {
  // Try v3 endpoint first (used by newer Konnect orgs with v3 Dev Portal IDs)
  try {
    const results: KonnectPortalApplication[] = []
    let pageAfter: string | undefined
    do {
      const params: Record<string, string> = { 'page[size]': '100' }
      if (pageAfter) params['page[after]'] = pageAfter
      const json = await konnectGet(pat, region, `/v3/portals/${portalId}/applications`, params)
      console.debug('[konnect] v3 portal applications raw response', portalId, json)
      const typed = json as { data?: KonnectPortalApplication[]; meta?: { next?: { cursor?: string } } }
      results.push(...(typed.data ?? []))
      pageAfter = typed.meta?.next?.cursor ?? undefined
    } while (pageAfter)
    return results
  } catch (e3) {
    console.debug('[konnect] v3 portal applications failed, trying v2', portalId, e3)
  }

  // Fall back to v2 (legacy portal IDs)
  try {
    const results: KonnectPortalApplication[] = []
    let offset: string | undefined
    do {
      const params: Record<string, string> = { size: '100' }
      if (offset) params.offset = offset
      const json = await konnectGet(pat, region, `/v2/portals/${portalId}/applications`, params)
      console.debug('[konnect] v2 portal applications raw response', portalId, json)
      const typed = json as { data?: KonnectPortalApplication[]; offset?: string }
      results.push(...(typed.data ?? []))
      offset = typed.offset
    } while (offset)
    return results
  } catch (e2) {
    console.error('[konnect] listPortalApplications both v3+v2 failed', portalId, e2)
    return []
  }
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
