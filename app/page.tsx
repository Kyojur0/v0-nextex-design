"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ThemeProvider } from "next-themes"
import { Header } from "@/components/editor/header"
import { FileTree } from "@/components/editor/file-tree"
import { EnhancedCodeEditor } from "@/components/editor/enhanced-code-editor"
import { PdfPreview } from "@/components/editor/pdf-preview"
import { SmartTerminal } from "@/components/editor/smart-terminal"
import { TemplateModal } from "@/components/editor/template-modal"
import { AdvancedSettings } from "@/components/editor/advanced-settings"
import { LayoutWrapper } from "@/components/editor/layout-wrapper"
import { VersionHistory } from "@/components/editor/version-history"
import { AISpotlight } from "@/components/editor/ai-spotlight"
import { SelectionPopover } from "@/components/editor/selection-popover"
import { ColorPaletteProvider } from "@/lib/color-palette-context"
import { useEditorStore } from "@/lib/store"
import {
  fetchProject,
  fetchFileTree,
  readFile,
  writeFile,
  createItem,
  renameItem,
  deleteItem,
  compileLaTeX,
  getPdfUrl,
} from "@/lib/api"
import type { FileType } from "@/lib/api-types"
import { cn } from "@/lib/utils"

function EditorInner() {
  const {
    files,
    activeFileId,
    content,
    isBuilding,
    showBuildLog,
    showTemplateModal,
    showSettings,
    showPreview,
    showHistory,
    showAISpotlight,
    sidebarWidth,
    isDragging,
    settings,
    buildLogs,
    pdfUrl,
    setActiveFile,
    setContent,
    setIsModified,
    setIsBuilding,
    setShowBuildLog,
    setShowTemplateModal,
    setShowSettings,
    setShowPreview,
    setShowHistory,
    setShowAISpotlight,
    setSidebarWidth,
    setIsDragging,
    setFiles,
    setProjectName,
    setBuildLogs,
    setCurrentBuildId,
    setPdfUrl,
  } = useEditorStore()

  const [mounted, setMounted] = useState(false)
  // Horizontal split ratio between editor and preview (editor takes splitRatio%)
  const [splitRatio, setSplitRatio] = useState(0.55)
  // Selection popover state
  const [selectedText, setSelectedText] = useState("")
  const [selectionAnchor, setSelectionAnchor] = useState<HTMLTextAreaElement | null>(null)
  const splitDragging = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // ── Bootstrap: load project + file tree from API ─────────────────────────
  const refreshFileTree = useCallback(async () => {
    const result = await fetchFileTree()
    if (result.ok) setFiles(result.data)
  }, [setFiles])

  useEffect(() => {
    setMounted(true)

    const bootstrap = async () => {
      // Load project metadata
      const projectResult = await fetchProject()
      if (projectResult.ok) setProjectName(projectResult.data.name)

      // Load file tree
      const treeResult = await fetchFileTree()
      if (!treeResult.ok) return
      setFiles(treeResult.data)

      // Auto-open the first .tex file
      const flat = (nodes: typeof treeResult.data): typeof treeResult.data =>
        nodes.flatMap((n) => (n.type === "folder" ? flat(n.children ?? []) : [n]))
      const firstTex = flat(treeResult.data).find((f) => f.name.endsWith(".tex"))
      if (firstTex) {
        const fileResult = await readFile(firstTex.id)
        if (fileResult.ok) setActiveFile(firstTex.id, fileResult.data.content ?? "")
      }
    }
    bootstrap()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sidebar resize ─────────────────────────────────────────────────────────
  const handleSidebarMouseDown = useCallback(
    (e: React.MouseEvent) => { setIsDragging(true); e.preventDefault() },
    [setIsDragging]
  )

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) =>
      setSidebarWidth(Math.max(150, Math.min(500, e.clientX)))
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, setSidebarWidth, setIsDragging])

  // ── Editor/preview split resize ────────────────────────────────────────────
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    splitDragging.current = true
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitDragging.current || !splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      setSplitRatio(Math.max(0.25, Math.min(0.8, (e.clientX - rect.left) / rect.width)))
    }
    const handleMouseUp = () => { splitDragging.current = false }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  // ── File select ────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (fileId: string) => {
    const result = await readFile(fileId)
    if (result.ok) {
      setActiveFile(fileId, result.data.content ?? "")
      setIsModified(false)
    }
  }, [setActiveFile, setIsModified])

  // ── Content change ─────────────────────────────────────────────────────────
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setIsModified(true)
  }, [setContent, setIsModified])

  // ── Build ──────────────────────────────────────────────────────────────────
  // Declared before handleSave so it can be referenced via ref below.
  const handleBuildRef = useRef<() => Promise<void>>(async () => {})

  const handleBuild = useCallback(async () => {
    if (!activeFileId) return
    setIsBuilding(true)
    setShowBuildLog(true)
    setPdfUrl(null)
    setBuildLogs([])

    const result = await compileLaTeX({
      projectId: "project-1",
      mainFileId: activeFileId,
      compiler: settings.compiler,
    })

    if (result.ok) {
      setBuildLogs(result.data.logs)
      setCurrentBuildId(result.data.buildId)
      if (result.data.success) {
        setPdfUrl(getPdfUrl(result.data.buildId))
      }
    } else {
      setBuildLogs([{
        id: "err",
        level: "error",
        message: result.error,
        raw: result.error,
      }])
    }
    setIsBuilding(false)
  }, [activeFileId, settings.compiler, setIsBuilding, setShowBuildLog, setBuildLogs, setPdfUrl, setCurrentBuildId])

  // Keep ref current so handleSave can call it without a circular dep
  useEffect(() => { handleBuildRef.current = handleBuild }, [handleBuild])

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!activeFileId) return
    const result = await writeFile({ id: activeFileId, content })
    if (result.ok) {
      setIsModified(false)
      // Build-on-save: only trigger if enabled and not already building
      if (settings.buildOnSave && !isBuilding) {
        setTimeout(() => handleBuildRef.current(), 0)
      }
    }
  }, [activeFileId, content, setIsModified, settings.buildOnSave, isBuilding])

  // ── File tree mutations (call API then refresh tree) ───────────────────────
  const handleRename = useCallback(async (id: string, newName: string) => {
    const result = await renameItem({ id, name: newName })
    if (result.ok) await refreshFileTree()
  }, [refreshFileTree])

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteItem({ id })
    if (result.ok) {
      await refreshFileTree()
      // If the deleted item was active, clear the editor
      if (result.data.deletedIds.includes(activeFileId ?? "")) {
        setActiveFile(null, "")
        setIsModified(false)
      }
    }
  }, [refreshFileTree, activeFileId, setActiveFile, setIsModified])

  const handleCreate = useCallback(async (
    parentId: string | null,
    name: string,
    type: FileType
  ) => {
    const result = await createItem({ parentId, name, type })
    if (result.ok) {
      await refreshFileTree()
      // Auto-open new files
      if (type === "file") {
        setActiveFile(result.data.id, result.data.content ?? "")
        setIsModified(false)
      }
    }
  }, [refreshFileTree, setActiveFile, setIsModified])

  // ── Selection popover ──────────────────────────────────────────────────────
  const handleSelectionChange = useCallback(
    (text: string, anchor: HTMLTextAreaElement | null) => {
      setSelectedText(text)
      setSelectionAnchor(anchor)
    },
    []
  )

  const handleAIFromSelection = useCallback((text: string) => {
    // Pre-fill the spotlight with selected text and open it
    setShowAISpotlight(true)
  }, [setShowAISpotlight])

  // ── Jump to line (from terminal) ───────────────────────────────────────────
  const handleJumpToLine = useCallback((line: number) => {
    window.dispatchEvent(new CustomEvent("editor:jump-to-line", { detail: { line } }))
  }, [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave() }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); handleBuild() }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowAISpotlight(true) }
      if (e.key === "Escape") setShowAISpotlight(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, handleBuild, setShowAISpotlight])

  if (!mounted) return null

  // Flatten tree to find active file's name
  const flat = (nodes: typeof files): typeof files =>
    nodes.flatMap((n) => (n.type === "folder" ? flat(n.children ?? []) : [n]))
  const activeFileName = flat(files).find((f) => f.id === activeFileId)?.name ?? "Untitled"

  // Map BuildLogEntry (level) → SmartTerminal LogEntry shape (type) for display
  const terminalLogs = buildLogs.map((log) => ({
    type: log.level as "info" | "warning" | "error" | "success",
    message: log.message,
    line: log.line,
    timestamp: new Date().toLocaleTimeString(),
  }))

  return (
    <LayoutWrapper>
      <Header
        onOpenFolder={() => {}}
        onOpenFile={() => {}}
        onSave={handleSave}
        onSaveAs={() => {}}
        onBuild={handleBuild}
        onNewFromTemplate={() => setShowTemplateModal(true)}
        onOpenSettings={() => setShowSettings(true)}
        onTogglePreview={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
      />

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left sidebar: file tree or version history */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className={cn(
            "flex flex-col border-r border-border shrink-0 overflow-hidden",
            isDragging && "select-none"
          )}
        >
          {showHistory ? (
            <VersionHistory onClose={() => setShowHistory(false)} />
          ) : (
            <FileTree
              files={files}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              onShowHistory={() => setShowHistory(true)}
              onRename={handleRename}
              onDelete={handleDelete}
              onCreate={handleCreate}
            />
          )}
        </div>

        {/* Sidebar resize handle */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className={cn(
            "w-1 bg-border hover:bg-primary/30 cursor-col-resize transition-colors shrink-0",
            isDragging && "bg-primary/40"
          )}
        />

        {/* Editor + Preview horizontal split */}
        <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">

          {/* Code editor */}
          <div
            style={{ width: showPreview ? `${splitRatio * 100}%` : "100%" }}
            className="flex flex-col overflow-hidden transition-all duration-200 p-3"
          >
            <EnhancedCodeEditor
              content={content}
              onChange={handleContentChange}
              onSelectionChange={handleSelectionChange}
              fileName={activeFileName}
              fontSize={settings.fontSize}
              tabSize={settings.tabSize}
              enableSyntaxHighlight={settings.enableSyntaxHighlight}
              wordWrap={settings.wordWrap}
              onAISpotlight={() => setShowAISpotlight(true)}
            />
          </div>

          {/* Draggable divider */}
          {showPreview && (
            <div
              onMouseDown={handleSplitMouseDown}
              className="w-1 bg-border hover:bg-primary/30 cursor-col-resize transition-colors shrink-0"
            />
          )}

          {/* PDF preview */}
          {showPreview && (
            <div
              style={{ width: `${(1 - splitRatio) * 100}%` }}
              className="flex flex-col overflow-hidden p-3"
            >
              <PdfPreview
                fileName={activeFileName.replace(".tex", ".pdf")}
                isBuilding={isBuilding}
                pdfUrl={pdfUrl}
              />
            </div>
          )}
        </div>
      </div>

      {/* Smart Terminal — collapsible bottom panel */}
      <SmartTerminal
        logs={terminalLogs}
        isBuilding={isBuilding}
        isOpen={showBuildLog}
        onToggle={() => setShowBuildLog(!showBuildLog)}
        onJumpToLine={handleJumpToLine}
      />

      {/* AI Spotlight modal */}
      {showAISpotlight && (
        <AISpotlight
          selectedCode={content}
          currentContent={content}
          onAccept={(newContent) => {
            handleContentChange(newContent)
            setShowAISpotlight(false)
          }}
          onClose={() => setShowAISpotlight(false)}
          aiModel={settings.aiModel ?? "openai/gpt-4o-mini"}
        />
      )}

      {/* Selection popover */}
      {selectedText && selectionAnchor && (
        <SelectionPopover
          selectedText={selectedText}
          anchorEl={selectionAnchor}
          content={content}
          onAskAI={handleAIFromSelection}
          onDismiss={() => { setSelectedText(""); setSelectionAnchor(null) }}
          onContentChange={handleContentChange}
        />
      )}

      {/* Modals */}
      <TemplateModal open={showTemplateModal} onOpenChange={setShowTemplateModal} />
      <AdvancedSettings open={showSettings} onOpenChange={setShowSettings} />
    </LayoutWrapper>
  )
}

export default function EditorPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem suppressHydrationWarning>
      <ColorPaletteProvider>
        <EditorInner />
      </ColorPaletteProvider>
    </ThemeProvider>
  )
}
