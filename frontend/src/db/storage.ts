import type { Folder, Request, Environment, RequestExecution } from '../types'

const KEYS = {
  folders: 'hs_folders',
  requests: 'hs_requests',
  environments: 'hs_environments',
  history: 'hs_history',
  activeRequestId: 'hs_activeRequestId',
  activeEnvironmentId: 'hs_activeEnvironmentId',
  konnectPat: 'hs_konnect_pat',
  konnectRegion: 'hs_konnect_region',
  konnectLastSync: 'hs_konnect_last_sync',
} as const

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

export const storage = {
  loadFolders: () => load<Folder[]>(KEYS.folders, []),
  saveFolders: (v: Folder[]) => save(KEYS.folders, v),

  loadRequests: () => load<Request[]>(KEYS.requests, []),
  saveRequests: (v: Request[]) => save(KEYS.requests, v),

  loadEnvironments: () => load<Environment[]>(KEYS.environments, []),
  saveEnvironments: (v: Environment[]) => save(KEYS.environments, v),

  loadHistory: () => load<RequestExecution[]>(KEYS.history, []),
  saveHistory: (v: RequestExecution[]) => save(KEYS.history, v),

  loadActiveRequestId: () => load<string | null>(KEYS.activeRequestId, null),
  saveActiveRequestId: (v: string | null) => save(KEYS.activeRequestId, v),

  loadActiveEnvironmentId: () => load<string | null>(KEYS.activeEnvironmentId, null),
  saveActiveEnvironmentId: (v: string | null) => save(KEYS.activeEnvironmentId, v),

  loadKonnectPat: () => load<string | null>(KEYS.konnectPat, null),
  saveKonnectPat: (v: string | null) => save(KEYS.konnectPat, v),

  loadKonnectRegion: () => load<string>(KEYS.konnectRegion, 'global'),
  saveKonnectRegion: (v: string) => save(KEYS.konnectRegion, v),

  loadKonnectLastSync: () => load<string | null>(KEYS.konnectLastSync, null),
  saveKonnectLastSync: (v: string | null) => save(KEYS.konnectLastSync, v),
}
