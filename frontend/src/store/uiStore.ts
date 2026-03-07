import { create } from 'zustand'
import type { RequestExecution, AIMessage } from '../types'

type ResponseTab = 'body' | 'headers' | 'debug' | 'kong'
type BodyFormat = 'pretty' | 'raw'

interface UIState {
  // Layout
  sidebarWidth: number
  aiPanelOpen: boolean
  setSidebarWidth: (w: number) => void
  setAiPanelOpen: (open: boolean) => void
  toggleAiPanel: () => void

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
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 260,
  aiPanelOpen: true,
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),

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

  expandedFolders: new Set<string>(),
  toggleFolder: (id) => set((s) => {
    const next = new Set(s.expandedFolders)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { expandedFolders: next }
  }),
  expandFolder: (id) => set((s) => {
    const next = new Set(s.expandedFolders)
    next.add(id)
    return { expandedFolders: next }
  }),
}))
