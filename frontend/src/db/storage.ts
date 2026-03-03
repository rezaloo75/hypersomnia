import type { Workspace, Folder, Request, Environment, RequestExecution } from '../types'

const KEYS = {
  workspaces: 'hs_workspaces',
  folders: 'hs_folders',
  requests: 'hs_requests',
  environments: 'hs_environments',
  history: 'hs_history',
  activeWorkspaceId: 'hs_activeWorkspaceId',
  activeRequestId: 'hs_activeRequestId',
  activeEnvironmentId: 'hs_activeEnvironmentId',
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
  loadWorkspaces: () => load<Workspace[]>(KEYS.workspaces, []),
  saveWorkspaces: (v: Workspace[]) => save(KEYS.workspaces, v),

  loadFolders: () => load<Folder[]>(KEYS.folders, []),
  saveFolders: (v: Folder[]) => save(KEYS.folders, v),

  loadRequests: () => load<Request[]>(KEYS.requests, []),
  saveRequests: (v: Request[]) => save(KEYS.requests, v),

  loadEnvironments: () => load<Environment[]>(KEYS.environments, []),
  saveEnvironments: (v: Environment[]) => save(KEYS.environments, v),

  loadHistory: () => load<RequestExecution[]>(KEYS.history, []),
  saveHistory: (v: RequestExecution[]) => save(KEYS.history, v),

  loadActiveWorkspaceId: () => load<string | null>(KEYS.activeWorkspaceId, null),
  saveActiveWorkspaceId: (v: string | null) => save(KEYS.activeWorkspaceId, v),

  loadActiveRequestId: () => load<string | null>(KEYS.activeRequestId, null),
  saveActiveRequestId: (v: string | null) => save(KEYS.activeRequestId, v),

  loadActiveEnvironmentId: () => load<string | null>(KEYS.activeEnvironmentId, null),
  saveActiveEnvironmentId: (v: string | null) => save(KEYS.activeEnvironmentId, v),
}
