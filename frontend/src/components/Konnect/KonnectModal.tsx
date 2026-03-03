import { useState, useEffect } from 'react'
import { XMarkIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { storage } from '../../db/storage'
import { useWorkspaceStore } from '../../store/workspaceStore'
import {
  listControlPlanes,
  listServices,
  listRoutes,
  buildBaseUrl,
  REGION_LABELS,
  type KonnectRegion,
} from '../../utils/konnectApi'
import type { Folder, Request, Environment, Workspace } from '../../types'

const REGIONS = Object.keys(REGION_LABELS) as KonnectRegion[]
const KONNECT_WS_ID = 'konnect-workspace'

/**
 * Kong route paths can be regex patterns prefixed with `~`.
 * Strip the prefix and remove `^` / `$` anchors to get a clean URL path.
 * e.g. "~/breweries/random$" → "/breweries/random"
 */
function cleanPath(path: string): string {
  let p = path.startsWith('~') ? path.slice(1) : path
  p = p.replace(/^\^/, '').replace(/\$$/, '')
  return p || '/'
}

interface SyncProgress {
  current: string
  done: number
  total: number
}

interface SyncResult {
  controlPlanes: number
  environments: number
  folders: number
  requests: number
  missingBaseUrl: string[]
}

interface Props {
  onClose: () => void
}

export function KonnectModal({ onClose }: Props) {
  const { importWorkspaceData, setActiveEnvironment } = useWorkspaceStore()

  const [pat, setPat] = useState(() => storage.loadKonnectPat() ?? '')
  const [region, setRegion] = useState<KonnectRegion>(
    () => (storage.loadKonnectRegion() as KonnectRegion) ?? 'global',
  )
  const [lastSync, setLastSync] = useState(() => storage.loadKonnectLastSync())
  const [savedPat, setSavedPat] = useState(() => storage.loadKonnectPat())
  const [replacing, setReplacing] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SyncResult | null>(null)

  const isConnected = !!savedPat && !replacing

  useEffect(() => {
    if (!syncing) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [syncing])

  function maskPat(p: string) {
    if (p.length <= 8) return '••••••••'
    return p.slice(0, 8) + '••••••••' + p.slice(-4)
  }

  function savePat() {
    const trimmed = pat.trim()
    if (!trimmed) return
    storage.saveKonnectPat(trimmed)
    storage.saveKonnectRegion(region)
    setSavedPat(trimmed)
    setReplacing(false)
    setError(null)
    setResult(null)
  }

  function removePat() {
    storage.saveKonnectPat(null)
    storage.saveKonnectLastSync(null)
    setSavedPat(null)
    setPat('')
    setError(null)
    setResult(null)
    setLastSync(null)
  }

  async function runSync() {
    const token = savedPat!
    setSyncing(true)
    setError(null)
    setResult(null)
    setProgress(null)

    try {
      const cps = await listControlPlanes(token, region)

      const workspace: Workspace = {
        id: KONNECT_WS_ID,
        name: 'Konnect',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const environments: Environment[] = []
      const folders: Folder[] = []
      const requests: Request[] = []
      let totalRequests = 0
      const missingBaseUrl: string[] = []

      for (let i = 0; i < cps.length; i++) {
        const cp = cps[i]
        setProgress({ current: cp.name, done: i, total: cps.length })

        // Environment for this control plane
        const baseUrl = buildBaseUrl(cp)
        if (!baseUrl) missingBaseUrl.push(cp.name)
        environments.push({
          id: `konnect-env-${cp.id}`,
          workspaceId: KONNECT_WS_ID,
          name: cp.name,
          variables: { baseUrl },
        })

        // Top-level folder per control plane
        const cpFolderId = `konnect-cp-${cp.id}`
        folders.push({
          id: cpFolderId,
          workspaceId: KONNECT_WS_ID,
          name: cp.name,
          sortOrder: i,
        })

        // Fetch services + routes in parallel
        const [services, routes] = await Promise.all([
          listServices(token, region, cp.id),
          listRoutes(token, region, cp.id),
        ])

        // Index services by id
        const svcMap = new Map(services.map(s => [s.id, s]))

        // Group routes by service id (null = no service)
        const routesByService = new Map<string | null, typeof routes>()
        for (const route of routes) {
          const svcId = route.service?.id ?? null
          if (!routesByService.has(svcId)) routesByService.set(svcId, [])
          routesByService.get(svcId)!.push(route)
        }

        let svcSortOrder = 0
        for (const [svcId, svcRoutes] of routesByService) {
          const svc = svcId ? svcMap.get(svcId) : null
          const folderName = svc?.name ?? '(No Service)'
          const svcFolderId = svcId
            ? `konnect-svc-${svcId}`
            : `konnect-nosvc-${cp.id}`

          folders.push({
            id: svcFolderId,
            workspaceId: KONNECT_WS_ID,
            name: folderName,
            parentId: cpFolderId,
            sortOrder: svcSortOrder++,
          })

          svcRoutes.forEach((route, ri) => {
            const method = (route.methods?.[0] ?? 'GET').toUpperCase()
            const path = cleanPath(route.paths?.[0] ?? '/')
            const name = route.name ?? `${method} ${path}`
            const url = `{{baseUrl}}${path}`

            requests.push({
              id: `konnect-route-${route.id}`,
              workspaceId: KONNECT_WS_ID,
              folderId: svcFolderId,
              name,
              method: method as Request['method'],
              url,
              headers: [],
              queryParams: [],
              body: { type: 'none', content: '' },
              auth: { type: 'none' },
              settings: {},
              sortOrder: ri,
            })
            totalRequests++
          })
        }
      }

      setProgress({ current: '', done: cps.length, total: cps.length })

      importWorkspaceData({ workspace, folders, requests, environments })

      // Auto-select the first CP's environment so {{baseUrl}} resolves immediately
      if (environments.length > 0) {
        setActiveEnvironment(environments[0].id)
      }

      const now = new Date().toISOString()
      storage.saveKonnectLastSync(now)
      setLastSync(now)

      setResult({
        controlPlanes: cps.length,
        environments: environments.length,
        folders: folders.filter(f => !f.parentId).length,
        requests: totalRequests,
        missingBaseUrl,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
      setProgress(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className="relative w-[520px] rounded-lg shadow-2xl flex flex-col"
        style={{ background: '#111111', border: '1px solid #2a2a2a' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: '#1a1a1a' }}>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <circle cx="16" cy="16" r="15.5" fill="#0a0a0a"/>
            <path d="M16 0C7.163 0 0 7.163 0 16C0 24.837 7.163 32 16 32C24.837 32 32 24.837 32 16C32 7.163 24.837 0 16 0ZM16 1.627C23.938 1.627 30.373 8.062 30.373 16C30.373 23.938 23.938 30.373 16 30.373C8.062 30.373 1.627 23.938 1.627 16C1.627 8.062 8.062 1.627 16 1.627Z" fill="#6fdc0e"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M16.181 4.61C22.471 4.61 27.571 9.71 27.571 16C27.571 22.29 22.471 27.39 16.181 27.39C9.89 27.39 4.791 22.29 4.791 16C4.791 14.463 5.096 12.997 5.648 11.659C6.454 12.756 7.754 13.469 9.22 13.469C11.667 13.469 13.65 11.486 13.65 9.04C13.65 7.573 12.937 6.273 11.839 5.467C13.177 4.915 14.644 4.61 16.181 4.61Z" fill="#6fdc0e"/>
          </svg>
          <span className="font-semibold text-sm text-gray-200">Kong Konnect</span>
          <span className="text-xs text-gray-600 ml-1">Integration</span>
          <div className="flex-1" />
          <button className="btn-ghost p-1" onClick={onClose} disabled={syncing}>
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5">
          {/* PAT section */}
          {isConnected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#6fdc0e' }} />
                <span className="text-sm text-gray-300">Connected</span>
                <span className="text-xs text-gray-500 font-mono ml-1">{maskPat(savedPat!)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">
                  {lastSync
                    ? `Last synced ${new Date(lastSync).toLocaleString()}`
                    : 'Not yet synced'}
                </span>
                <div className="flex-1" />
                <button
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  onClick={() => { setReplacing(true); setPat('') }}
                  disabled={syncing}
                >
                  Replace PAT
                </button>
                <span className="text-gray-700">·</span>
                <button
                  className="text-red-500/70 hover:text-red-400 transition-colors"
                  onClick={removePat}
                  disabled={syncing}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  className="input-base w-full font-mono text-xs"
                  placeholder="kpat_••••••••••••••••"
                  value={pat}
                  onChange={e => setPat(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePat()}
                  autoFocus
                />
                <p className="text-xs text-gray-600 mt-1.5">
                  Generate a token at{' '}
                  <span className="text-gray-400">
                    Konnect → Organization → Personal Access Tokens
                  </span>
                </p>
              </div>

              {/* Region selector */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Region</label>
                <div className="flex gap-1.5">
                  {REGIONS.map(r => (
                    <button
                      key={r}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        region === r
                          ? 'text-gray-900 font-medium'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                      style={
                        region === r
                          ? { background: '#6fdc0e', border: '1px solid #6fdc0e' }
                          : { background: 'transparent', border: '1px solid #2a2a2a' }
                      }
                      onClick={() => setRegion(r)}
                    >
                      {REGION_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {replacing && (
                  <button className="btn-secondary text-xs" onClick={() => setReplacing(false)}>
                    Cancel
                  </button>
                )}
                <button
                  className="btn-primary text-xs"
                  onClick={savePat}
                  disabled={!pat.trim()}
                >
                  {replacing ? 'Update PAT' : 'Connect'}
                </button>
              </div>
            </div>
          )}

          {/* Region selector when connected */}
          {isConnected && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Region</label>
              <div className="flex gap-1.5">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    className={`px-3 py-1 rounded text-xs transition-colors ${
                      region === r
                        ? 'text-gray-900 font-medium'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                    style={
                      region === r
                        ? { background: '#6fdc0e', border: '1px solid #6fdc0e' }
                        : { background: 'transparent', border: '1px solid #2a2a2a' }
                    }
                    onClick={() => {
                      setRegion(r)
                      storage.saveKonnectRegion(r)
                    }}
                    disabled={syncing}
                  >
                    {REGION_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded text-xs text-red-400"
              style={{ background: '#1a0a0a', border: '1px solid #3a1a1a' }}>
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sync result */}
          {result && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 p-3 rounded text-xs"
                style={{ background: '#0a1a0a', border: '1px solid #1a3a1a', color: '#6fdc0e' }}>
                <CheckCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Synced <strong>{result.controlPlanes}</strong> control planes →{' '}
                  <strong>{result.environments}</strong> environments,{' '}
                  <strong>{result.requests}</strong> requests imported into the{' '}
                  <strong>Konnect</strong> workspace.
                </span>
              </div>
              {result.missingBaseUrl.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded text-xs"
                  style={{ background: '#1a1200', border: '1px solid #3a2a00', color: '#f59e0b' }}>
                  <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>{result.missingBaseUrl.length}</strong> control plane{result.missingBaseUrl.length > 1 ? 's have' : ' has'} no proxy URL
                    ({result.missingBaseUrl.join(', ')}). Set <code className="font-mono">baseUrl</code> manually
                    in each environment to use <code className="font-mono">{'{{baseUrl}}'}</code> in requests.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sync progress */}
          {syncing && progress && (
            <div className="flex items-center gap-2 text-xs text-gray-400 p-3 rounded"
              style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              <ArrowPathIcon className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: '#6fdc0e' }} />
              <span>
                {progress.done < progress.total
                  ? <>Syncing <strong className="text-gray-200">{progress.current}</strong>… ({progress.done + 1}/{progress.total})</>
                  : 'Finalising…'
                }
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        {isConnected && (
          <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: '#1a1a1a' }}>
            <button className="btn-secondary text-xs" onClick={onClose} disabled={syncing}>
              Close
            </button>
            <button
              className="btn-primary text-xs flex items-center gap-1.5"
              onClick={runSync}
              disabled={syncing}
            >
              {syncing
                ? <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                : <><ArrowPathIcon className="w-3.5 h-3.5" /> {lastSync ? 'Re-sync' : 'Sync Now'}</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
