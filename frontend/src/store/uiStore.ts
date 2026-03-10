import { create } from 'zustand'
import type { RequestExecution, AIMessage } from '../types'

type ResponseTab = 'body' | 'headers' | 'details' | 'kong'
type BodyFormat = 'pretty' | 'raw'

interface UIState {
  // Layout
  sidebarWidth: number
  activeRightPanel: string | null
  setSidebarWidth: (w: number) => void
  setActiveRightPanel: (id: string | null) => void
  toggleRightPanel: (id: string) => void

  // Response
  activeResponseTab: ResponseTab
  bodyFormat: BodyFormat
  setActiveResponseTab: (tab: ResponseTab) => void
  setBodyFormat: (fmt: BodyFormat) => void

  // Execution state
  isSending: boolean
  currentExecution: RequestExecution | null
  setSending: (v: boolean) => void
  setCurrentExecution: (e: RequestExecution | null) => void

  // AI
  aiMessages: AIMessage[]
  aiLoading: boolean
  addAiMessage: (msg: AIMessage) => void
  setAiMessages: (msgs: AIMessage[]) => void
  setAiLoading: (v: boolean) => void
  clearAiMessages: () => void

  // Search
  sidebarSearch: string
  setSidebarSearch: (q: string) => void

  // Expanded folders in sidebar
  expandedFolders: Set<string>
  toggleFolder: (id: string) => void
  expandFolder: (id: string) => void

  // Active folder (for variable editor)
  activeFolderId: string | null
  setActiveFolderId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: parseInt(localStorage.getItem('hs_sidebarWidth') ?? '260', 10),
  activeRightPanel: localStorage.getItem('hs_activeRightPanel') || null,
  setSidebarWidth: (w) => { localStorage.setItem('hs_sidebarWidth', String(w)); set({ sidebarWidth: w }) },
  setActiveRightPanel: (id) => { localStorage.setItem('hs_activeRightPanel', id ?? ''); set({ activeRightPanel: id }) },
  toggleRightPanel: (id) => set((s) => {
    const next = s.activeRightPanel === id ? null : id
    localStorage.setItem('hs_activeRightPanel', next ?? '')
    return { activeRightPanel: next }
  }),

  activeResponseTab: 'body',
  bodyFormat: 'pretty',
  setActiveResponseTab: (tab) => set({ activeResponseTab: tab }),
  setBodyFormat: (fmt) => set({ bodyFormat: fmt }),

  isSending: false,
  currentExecution: null,
  setSending: (v) => set({ isSending: v }),
  setCurrentExecution: (e) => set({ currentExecution: e }),

  aiMessages: [],
  aiLoading: false,
  addAiMessage: (msg) => set((s) => ({ aiMessages: [...s.aiMessages, msg] })),
  setAiMessages: (msgs) => set({ aiMessages: msgs }),
  setAiLoading: (v) => set({ aiLoading: v }),
  clearAiMessages: () => set({ aiMessages: [] }),

  sidebarSearch: '',
  setSidebarSearch: (q) => set({ sidebarSearch: q }),

  expandedFolders: new Set<string>(JSON.parse(localStorage.getItem('hs_expandedFolders') ?? '[]') as string[]),
  toggleFolder: (id) => set((s) => {
    const next = new Set(s.expandedFolders)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    localStorage.setItem('hs_expandedFolders', JSON.stringify([...next]))
    return { expandedFolders: next }
  }),
  expandFolder: (id) => set((s) => {
    const next = new Set(s.expandedFolders)
    next.add(id)
    localStorage.setItem('hs_expandedFolders', JSON.stringify([...next]))
    return { expandedFolders: next }
  }),

  activeFolderId: localStorage.getItem('hs_activeFolderId') ?? null,
  setActiveFolderId: (id) => { localStorage.setItem('hs_activeFolderId', id ?? ''); set({ activeFolderId: id }) },
}))
