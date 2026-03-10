import { create } from 'zustand'
import { useUIStore } from './uiStore'
import { v4 as uuid } from 'uuid'
import type {
  Folder, Request, RequestExecution,
  HttpMethod, KeyValuePair
} from '../types'
import { storage } from '../db/storage'
import {
  seedFolders, seedRequests,
  SEED_ACTIVE_REQUEST_ID,
} from '../db/seed'

// Seed localStorage on first ever load (no existing folders or requests)
function initStorage() {
  const hasFolders = storage.loadFolders().length > 0
  const hasRequests = storage.loadRequests().length > 0
  if (!hasFolders && !hasRequests) {
    storage.saveFolders(seedFolders)
    storage.saveRequests(seedRequests)
    storage.saveActiveRequestId(SEED_ACTIVE_REQUEST_ID)
  }
}
initStorage()

const MAX_HISTORY = 50

interface WorkspaceState {
  folders: Folder[]
  requests: Request[]
  history: RequestExecution[]
  activeRequestId: string | null

  // Folder CRUD
  createFolder: (name: string, parentId?: string) => Folder
  updateFolder: (id: string, patch: Partial<Folder>) => void
  deleteFolder: (id: string) => void

  // Request CRUD
  createRequest: (name: string, folderId?: string) => Request
  updateRequest: (id: string, patch: Partial<Request>) => void
  deleteRequest: (id: string) => void
  setActiveRequest: (id: string | null) => void
  duplicateRequest: (id: string) => Request | null

  // History
  addHistory: (entry: RequestExecution) => void
  clearHistory: () => void

  // Import
  importWorkspaceData: (data: {
    folders: Folder[]
    requests: Request[]
    idPrefix?: string
  }) => void
  importRequests: (folders: Partial<Folder>[], requests: Partial<Request>[]) => void
}

function makeDefaultRequest(name: string, folderId?: string): Request {
  return {
    id: uuid(),
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
  folders: storage.loadFolders(),
  requests: storage.loadRequests(),
  history: storage.loadHistory(),
  activeRequestId: storage.loadActiveRequestId(),

  // — Folders —
  createFolder: (name, parentId) => {
    const folder: Folder = { id: uuid(), name, parentId, sortOrder: Date.now() }
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
  createRequest: (name, folderId) => {
    const req = makeDefaultRequest(name, folderId)
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

  // — History —
  addHistory: (entry) => set((s) => {
    const history = [entry, ...s.history].slice(0, MAX_HISTORY)
    storage.saveHistory(history)
    return { history }
  }),

  clearHistory: () => {
    storage.saveHistory([])
    localStorage.removeItem('hs_currentExecutionId')
    useUIStore.getState().setCurrentExecution(null)
    set({ history: [] })
  },

  // — Import —
  importWorkspaceData: ({ folders, requests, idPrefix }) => set((s) => {
    const baseFolders = idPrefix ? s.folders.filter(f => !f.id.startsWith(idPrefix)) : s.folders
    const baseRequests = idPrefix ? s.requests.filter(r => !r.id.startsWith(idPrefix)) : s.requests

    const folderMap = new Map([...baseFolders, ...folders].map(f => [f.id, f]))
    const requestMap = new Map([...baseRequests, ...requests].map(r => [r.id, r]))

    const newFolders = [...folderMap.values()]
    const newRequests = [...requestMap.values()]
    storage.saveFolders(newFolders)
    storage.saveRequests(newRequests)
    return { folders: newFolders, requests: newRequests }
  }),

  importRequests: (partialFolders, partialRequests) => set((s) => {
    const newFolders: Folder[] = partialFolders.map(f => ({
      id: f.id ?? uuid(),
      name: f.name ?? 'Unnamed',
      parentId: f.parentId,
      sortOrder: f.sortOrder ?? Date.now(),
    }))
    const newRequests: Request[] = partialRequests.map(r => ({
      ...makeDefaultRequest(r.name ?? 'Unnamed', r.folderId),
      ...r,
      id: r.id ?? uuid(),
    }))
    const folders = [...s.folders, ...newFolders]
    const requests = [...s.requests, ...newRequests]
    storage.saveFolders(folders)
    storage.saveRequests(requests)
    return { folders, requests }
  }),
}))
