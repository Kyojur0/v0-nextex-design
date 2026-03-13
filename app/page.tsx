"use client"

import { useState, useCallback, useEffect } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Header } from "@/components/editor/header"
import { FileExplorer } from "@/components/editor/file-explorer"
import { CodeEditor } from "@/components/editor/code-editor"
import { PdfPreview } from "@/components/editor/pdf-preview"
import { BuildLog } from "@/components/editor/build-log"
import { TemplateModal } from "@/components/editor/template-modal"
import { SettingsPanel } from "@/components/editor/settings-panel"
import { sampleResumeContent } from "@/lib/editor-store"
import { cn } from "@/lib/utils"

// Sample file structure
const sampleFiles = [
  {
    id: "folder-1",
    name: "my-resume",
    type: "folder" as const,
    children: [
      { id: "file-1", name: "resume.tex", type: "file" as const, isMain: true },
      { id: "file-2", name: "sections.tex", type: "file" as const },
      { id: "file-3", name: "style.sty", type: "file" as const },
    ],
  },
]

// Sample build logs
const sampleLogs = [
  { type: "info" as const, message: "Starting pdfLaTeX compilation...", timestamp: "10:32:15" },
  { type: "info" as const, message: "Processing resume.tex", timestamp: "10:32:15" },
  { type: "warning" as const, message: "Underfull \\hbox (badness 10000) in paragraph", line: 24, timestamp: "10:32:16" },
  { type: "success" as const, message: "Output written to resume.pdf (1 page)", timestamp: "10:32:17" },
]

export default function EditorPage() {
  const [content, setContent] = useState(sampleResumeContent)
  const [isModified, setIsModified] = useState(false)
  const [activeFileId, setActiveFileId] = useState<string | null>("file-1")
  const [isBuilding, setIsBuilding] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [showBuildLog, setShowBuildLog] = useState(true)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [isDragging, setIsDragging] = useState(false)
  const [settings, setSettings] = useState({
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    autoSave: true,
    buildOnSave: false,
    compiler: "pdflatex",
  })

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setIsModified(true)
  }, [])

  const handleBuild = useCallback(() => {
    setIsBuilding(true)
    setHasError(false)
    // Simulate build process
    setTimeout(() => {
      setIsBuilding(false)
    }, 2000)
  }, [])

  const handleSave = useCallback(() => {
    setIsModified(false)
    // In real app: save to file system
  }, [])

  const handleOpenFolder = useCallback(() => {
    // In real app: use File System Access API
    console.log("Open folder dialog")
  }, [])

  const handleOpenFile = useCallback(() => {
    // In real app: use File System Access API
    console.log("Open file dialog")
  }, [])

  const handleTemplateSelect = useCallback((templateId: string) => {
    // In real app: load template content
    console.log("Selected template:", templateId)
    setShowTemplateModal(false)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "s":
            e.preventDefault()
            handleSave()
            break
          case "b":
            e.preventDefault()
            handleBuild()
            break
          case "n":
            e.preventDefault()
            setShowTemplateModal(true)
            break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, handleBuild])

  // Resize handling
  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const newWidth = Math.max(180, Math.min(400, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="h-screen flex flex-col bg-background overflow-hidden select-none">
        <Header
          projectName="my-resume"
          isModified={isModified}
          onOpenFolder={handleOpenFolder}
          onOpenFile={handleOpenFile}
          onSave={handleSave}
          onSaveAs={() => {}}
          onBuild={handleBuild}
          onNewFromTemplate={() => setShowTemplateModal(true)}
          onOpenSettings={() => setShowSettings(true)}
          isBuilding={isBuilding}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div
            className="flex-shrink-0 border-r border-border"
            style={{ width: sidebarWidth }}
          >
            <FileExplorer
              files={sampleFiles}
              activeFileId={activeFileId}
              onFileSelect={setActiveFileId}
              onNewFile={() => {}}
            />
          </div>

          {/* Resize handle */}
          <div
            className={cn(
              "w-1 cursor-col-resize hover:bg-border transition-colors flex-shrink-0",
              isDragging && "bg-border"
            )}
            onMouseDown={handleMouseDown}
          />

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              {/* Editor */}
              <div className="flex-1 min-w-0">
                <CodeEditor
                  content={content}
                  onChange={handleContentChange}
                  fileName="resume.tex"
                  fontSize={settings.fontSize}
                />
              </div>

              {/* Vertical divider */}
              <div className="w-px bg-border flex-shrink-0" />

              {/* PDF Preview */}
              <div className="flex-1 min-w-0">
                <PdfPreview isBuilding={isBuilding} hasError={hasError} />
              </div>
            </div>

            {/* Build Log */}
            <BuildLog
              logs={sampleLogs}
              isVisible={showBuildLog}
              onClose={() => setShowBuildLog(false)}
              onToggle={() => setShowBuildLog(!showBuildLog)}
              onGoToLine={(line) => console.log("Go to line:", line)}
            />
          </div>
        </div>

        {/* Modals */}
        <TemplateModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onSelect={handleTemplateSelect}
        />

        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSettingsChange={setSettings}
        />
      </div>
    </ThemeProvider>
  )
}
