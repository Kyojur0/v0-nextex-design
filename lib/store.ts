import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FileTreeNode, BuildLogEntry } from '@/lib/api-types'

// Re-export for components that imported FileItem from here previously.
// FileTreeNode is the canonical type — it has id, name, type, parentId, content,
// isMainFile, and an optional children array for folders.
export type { FileTreeNode as FileItem } from '@/lib/api-types'

export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  autoSave: boolean
  buildOnSave: boolean
  compiler: 'pdflatex' | 'xetex' | 'luatex'
  colorPalette: 'monochrome' | 'blue' | 'emerald' | 'warm' | 'minimal'
  enableSyntaxHighlight: boolean
  aiModel: string
  aiProvider: 'openai' | 'anthropic' | 'google' | 'xai'
  /** Runtime API key — stored in localStorage, never committed to code */
  aiApiKey: string
}

interface EditorStore {
  // File Management (populated via API)
  files: FileTreeNode[]
  activeFileId: string | null
  projectName: string

  // Editor State
  content: string
  isModified: boolean
  isBuilding: boolean
  hasError: boolean

  // Build State
  buildLogs: BuildLogEntry[]
  currentBuildId: string | null
  pdfUrl: string | null

  // UI State
  showBuildLog: boolean
  showTemplateModal: boolean
  showSettings: boolean
  showPreview: boolean
  showHistory: boolean
  showAISpotlight: boolean
  sidebarWidth: number
  isDragging: boolean

  // Settings
  settings: EditorSettings

  // Recent Files
  recentFiles: string[]

  // ── Actions ──────────────────────────────────────────────────────────────

  setFiles: (files: FileTreeNode[]) => void
  setActiveFile: (id: string | null, content: string) => void
  setContent: (content: string) => void
  setIsModified: (value: boolean) => void
  setIsBuilding: (value: boolean) => void
  setHasError: (value: boolean) => void
  setBuildLogs: (logs: BuildLogEntry[]) => void
  setCurrentBuildId: (id: string | null) => void
  setPdfUrl: (url: string | null) => void
  setShowBuildLog: (value: boolean) => void
  setShowTemplateModal: (value: boolean) => void
  setShowSettings: (value: boolean) => void
  setShowPreview: (value: boolean) => void
  setShowHistory: (value: boolean) => void
  setShowAISpotlight: (value: boolean) => void
  setSidebarWidth: (width: number) => void
  setIsDragging: (value: boolean) => void
  setSettings: (settings: Partial<EditorSettings>) => void
  setProjectName: (name: string) => void
  addRecentFile: (filePath: string) => void
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      // Initial state
      files: [],
      activeFileId: null,
      projectName: 'Untitled Project',
      content: '',
      isModified: false,
      isBuilding: false,
      hasError: false,
      buildLogs: [],
      currentBuildId: null,
      pdfUrl: null,
      showBuildLog: false,
      showTemplateModal: false,
      showSettings: false,
      showPreview: true,
      showHistory: false,
      showAISpotlight: false,
      sidebarWidth: 240,
      isDragging: false,
      recentFiles: [],
      settings: {
        fontSize: 14,
        tabSize: 2,
        wordWrap: true,
        autoSave: true,
        buildOnSave: false,
        compiler: 'pdflatex',
        colorPalette: 'monochrome',
        enableSyntaxHighlight: false,
        aiModel: 'openai/gpt-4o-mini',
        aiProvider: 'openai',
        aiApiKey: '',
      },

      // Actions
      setFiles: (files) => set({ files }),
      setActiveFile: (id, content) => set({ activeFileId: id, content }),
      setContent: (content) => set({ content }),
      setIsModified: (value) => set({ isModified: value }),
      setIsBuilding: (value) => set({ isBuilding: value }),
      setHasError: (value) => set({ hasError: value }),
      setBuildLogs: (logs) => set({ buildLogs: logs }),
      setCurrentBuildId: (id) => set({ currentBuildId: id }),
      setPdfUrl: (url) => set({ pdfUrl: url }),
      setShowBuildLog: (value) => set({ showBuildLog: value }),
      setShowTemplateModal: (value) => set({ showTemplateModal: value }),
      setShowSettings: (value) => set({ showSettings: value }),
      setShowPreview: (value) => set({ showPreview: value }),
      setShowHistory: (value) => set({ showHistory: value }),
      setShowAISpotlight: (value) => set({ showAISpotlight: value }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setIsDragging: (value) => set({ isDragging: value }),
      setSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      setProjectName: (name) => set({ projectName: name }),
      addRecentFile: (filePath) =>
        set((state) => ({
          recentFiles: [
            filePath,
            ...state.recentFiles.filter((f) => f !== filePath),
          ].slice(0, 10),
        })),
    }),
    {
      name: 'editor-store',
      // Only persist user preferences, never file tree or build state
      partialize: (state) => ({
        settings: state.settings,
        recentFiles: state.recentFiles,
        projectName: state.projectName,
        sidebarWidth: state.sidebarWidth,
        showPreview: state.showPreview,
      }),
    }
  )
)
