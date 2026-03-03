import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type {
  Workspace, Folder, Request, Environment, RequestExecution,
  HttpMethod, KeyValuePair
} from '../types'
import { storage } from '../db/storage'
import {
  seedWorkspace, seedFolders, seedRequests, seedEnvironment,
  SEED_ACTIVE_REQUEST_ID, SEED_ACTIVE_ENV_ID,
} from '../db/seed'

// Seed localStorage on first ever load (no existing workspaces)
function initStorage() {
  const existing = storage.loadWorkspaces()
  if (existing.length === 0) {
    storage.saveWorkspaces([seedWorkspace])
    storage.saveFolders(seedFolders)
    storage.saveRequests(seedRequests)
    storage.saveEnvironments([seedEnvironment])
    storage.saveActiveWorkspaceId(seedWorkspace.id)
    storage.saveActiveRequestId(SEED_ACTIVE_REQUEST_ID)
    storage.saveActiveEnvironmentId(SEED_ACTIVE_ENV_ID)
  }
}
initStorage()

const MAX_HISTORY = 50

interface WorkspaceState {
  workspaces: Workspace[]
  folders: Folder[]
  requests: Request[]
  environments: Environment[]
  history: RequestExecution[]
  activeWorkspaceId: string | null
  activeRequestId: string | null
  activeEnvironmentId: string | null

  // Workspace CRUD
  createWorkspace: (name: string) => Workspace
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void
  deleteWorkspace: (id: string) => void
  setActiveWorkspace: (id: string | null) => void

  // Folder CRUD
  createFolder: (workspaceId: string, name: string, parentId?: string) => Folder
  updateFolder: (id: string, patch: Partial<Folder>) => void
  deleteFolder: (id: string) => void

  // Request CRUD
  createRequest: (workspaceId: string, name: string, folderId?: string) => Request
  updateRequest: (id: string, patch: Partial<Request>) => void
  deleteRequest: (id: string) => void
  setActiveRequest: (id: string | null) => void
  duplicateRequest: (id: string) => Request | null

  // Environment CRUD
  createEnvironment: (workspaceId: string, name: string) => Environment
  updateEnvironment: (id: string, patch: Partial<Environment>) => void
  deleteEnvironment: (id: string) => void
  setActiveEnvironment: (id: string | null) => void

  // History
  addHistory: (entry: RequestExecution) => void
  clearHistory: () => void

  // Import
  importWorkspaceData: (data: {
    workspace: Workspace
    folders: Folder[]
    requests: Request[]
    environments: Environment[]
  }) => void
  importRequests: (workspaceId: string, folders: Partial<Folder>[], requests: Partial<Request>[]) => void
}

function makeDefaultRequest(workspaceId: string, name: string, folderId?: string): Request {
  return {
    id: uuid(),
    workspaceId,
    folderId,
    name,
    method: 'GET' as HttpMethod,
    url: '',
    headers: [] as KeyValuePair[],
    queryParams: [] as KeyValuePair[],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    settings: {},
    sortOrder: Date.now(),
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: storage.loadWorkspaces(),
  folders: storage.loadFolders(),
  requests: storage.loadRequests(),
  environments: storage.loadEnvironments(),
  history: storage.loadHistory(),
  activeWorkspaceId: storage.loadActiveWorkspaceId(),
  activeRequestId: storage.loadActiveRequestId(),
  activeEnvironmentId: storage.loadActiveEnvironmentId(),

  // — Workspaces —
  createWorkspace: (name) => {
    const ws: Workspace = { id: uuid(), name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    set((s) => {
      const workspaces = [...s.workspaces, ws]
      storage.saveWorkspaces(workspaces)
      storage.saveActiveWorkspaceId(ws.id)
      return { workspaces, activeWorkspaceId: ws.id }
    })
    return ws
  },

  updateWorkspace: (id, patch) => set((s) => {
    const workspaces = s.workspaces.map(w => w.id === id ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w)
    storage.saveWorkspaces(workspaces)
    return { workspaces }
  }),

  deleteWorkspace: (id) => set((s) => {
    const workspaces = s.workspaces.filter(w => w.id !== id)
    const folders = s.folders.filter(f => f.workspaceId !== id)
    const requests = s.requests.filter(r => r.workspaceId !== id)
    const environments = s.environments.filter(e => e.workspaceId !== id)
    const activeWorkspaceId = s.activeWorkspaceId === id ? (workspaces[0]?.id ?? null) : s.activeWorkspaceId
    storage.saveWorkspaces(workspaces)
    storage.saveFolders(folders)
    storage.saveRequests(requests)
    storage.saveEnvironments(environments)
    storage.saveActiveWorkspaceId(activeWorkspaceId)
    return { workspaces, folders, requests, environments, activeWorkspaceId }
  }),

  setActiveWorkspace: (id) => set(() => {
    storage.saveActiveWorkspaceId(id)
    storage.saveActiveRequestId(null)
    return { activeWorkspaceId: id, activeRequestId: null }
  }),

  // — Folders —
  createFolder: (workspaceId, name, parentId) => {
    const folder: Folder = { id: uuid(), workspaceId, name, parentId, sortOrder: Date.now() }
    set((s) => {
      const folders = [...s.folders, folder]
      storage.saveFolders(folders)
      return { folders }
    })
    return folder
  },

  updateFolder: (id, patch) => set((s) => {
    const folders = s.folders.map(f => f.id === id ? { ...f, ...patch } : f)
    storage.saveFolders(folders)
    return { folders }
  }),

  deleteFolder: (id) => set((s) => {
    const toDelete = new Set<string>()
    const collect = (fid: string) => {
      toDelete.add(fid)
      s.folders.filter(f => f.parentId === fid).forEach(f => collect(f.id))
    }
    collect(id)
    const folders = s.folders.filter(f => !toDelete.has(f.id))
    const requests = s.requests.filter(r => !r.folderId || !toDelete.has(r.folderId))
    storage.saveFolders(folders)
    storage.saveRequests(requests)
    return { folders, requests }
  }),

  // — Requests —
  createRequest: (workspaceId, name, folderId) => {
    const req = makeDefaultRequest(workspaceId, name, folderId)
    set((s) => {
      const requests = [...s.requests, req]
      storage.saveRequests(requests)
      storage.saveActiveRequestId(req.id)
      return { requests, activeRequestId: req.id }
    })
    return req
  },

  updateRequest: (id, patch) => set((s) => {
    const requests = s.requests.map(r => r.id === id ? { ...r, ...patch } : r)
    storage.saveRequests(requests)
    return { requests }
  }),

  deleteRequest: (id) => set((s) => {
    const requests = s.requests.filter(r => r.id !== id)
    const activeRequestId = s.activeRequestId === id ? null : s.activeRequestId
    storage.saveRequests(requests)
    storage.saveActiveRequestId(activeRequestId)
    return { requests, activeRequestId }
  }),

  setActiveRequest: (id) => set(() => {
    storage.saveActiveRequestId(id)
    return { activeRequestId: id }
  }),

  duplicateRequest: (id) => {
    const orig = get().requests.find(r => r.id === id)
    if (!orig) return null
    const dup = { ...orig, id: uuid(), name: `${orig.name} (copy)`, sortOrder: Date.now() }
    set((s) => {
      const requests = [...s.requests, dup]
      storage.saveRequests(requests)
      storage.saveActiveRequestId(dup.id)
      return { requests, activeRequestId: dup.id }
    })
    return dup
  },

  // — Environments —
  createEnvironment: (workspaceId, name) => {
    const env: Environment = { id: uuid(), workspaceId, name, variables: {} }
    set((s) => {
      const environments = [...s.environments, env]
      storage.saveEnvironments(environments)
      return { environments }
    })
    return env
  },

  updateEnvironment: (id, patch) => set((s) => {
    const environments = s.environments.map(e => e.id === id ? { ...e, ...patch } : e)
    storage.saveEnvironments(environments)
    return { environments }
  }),

  deleteEnvironment: (id) => set((s) => {
    const environments = s.environments.filter(e => e.id !== id)
    const activeEnvironmentId = s.activeEnvironmentId === id ? null : s.activeEnvironmentId
    storage.saveEnvironments(environments)
    storage.saveActiveEnvironmentId(activeEnvironmentId)
    return { environments, activeEnvironmentId }
  }),

  setActiveEnvironment: (id) => set(() => {
    storage.saveActiveEnvironmentId(id)
    return { activeEnvironmentId: id }
  }),

  // — History —
  addHistory: (entry) => set((s) => {
    const history = [entry, ...s.history].slice(0, MAX_HISTORY)
    storage.saveHistory(history)
    return { history }
  }),

  clearHistory: () => set(() => {
    storage.saveHistory([])
    return { history: [] }
  }),

  // — Import —
  importWorkspaceData: ({ workspace, folders, requests, environments }) => set((s) => {
    const workspaces = [...s.workspaces.filter(w => w.id !== workspace.id), workspace]
    const newFolders = [...s.folders.filter(f => f.workspaceId !== workspace.id), ...folders]
    const newRequests = [...s.requests.filter(r => r.workspaceId !== workspace.id), ...requests]
    const newEnvironments = [...s.environments.filter(e => e.workspaceId !== workspace.id), ...environments]
    storage.saveWorkspaces(workspaces)
    storage.saveFolders(newFolders)
    storage.saveRequests(newRequests)
    storage.saveEnvironments(newEnvironments)
    storage.saveActiveWorkspaceId(workspace.id)
    return { workspaces, folders: newFolders, requests: newRequests, environments: newEnvironments, activeWorkspaceId: workspace.id }
  }),

  importRequests: (workspaceId, partialFolders, partialRequests) => set((s) => {
    const newFolders: Folder[] = partialFolders.map(f => ({
      id: f.id ?? uuid(),
      workspaceId,
      name: f.name ?? 'Unnamed',
      parentId: f.parentId,
      sortOrder: f.sortOrder ?? Date.now(),
    }))
    const newRequests: Request[] = partialRequests.map(r => ({
      ...makeDefaultRequest(workspaceId, r.name ?? 'Unnamed', r.folderId),
      ...r,
      id: r.id ?? uuid(),
      workspaceId,
    }))
    const folders = [...s.folders, ...newFolders]
    const requests = [...s.requests, ...newRequests]
    storage.saveFolders(folders)
    storage.saveRequests(requests)
    return { folders, requests }
  }),
}))
