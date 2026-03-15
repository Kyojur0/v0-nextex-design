"use client"

import { useCallback, useEffect, useState } from "react"
import { ThemeProvider } from "next-themes"
import { Header } from "@/components/editor/header"
import { FileTree } from "@/components/editor/file-tree"
import { SmoothCodeEditor } from "@/components/editor/smooth-code-editor"
import { PdfPreview } from "@/components/editor/pdf-preview"
import { BuildLog } from "@/components/editor/build-log"
import { TemplateModal } from "@/components/editor/template-modal"
import { AdvancedSettings } from "@/components/editor/advanced-settings"
import { LayoutWrapper } from "@/components/editor/layout-wrapper"
import { ColorPaletteProvider } from "@/lib/color-palette-context"
import { useEditorStore } from "@/lib/store"
import { cn } from "@/lib/utils"

// Sample resume content
const SAMPLE_RESUME = `\\documentclass{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{hyperref}

\\title{John Doe}
\\author{}
\\date{}

\\begin{document}

\\maketitle

\\section*{CONTACT}
Email: john@example.com | Phone: (555) 123-4567 | LinkedIn: linkedin.com/in/johndoe

\\section*{PROFESSIONAL SUMMARY}
Experienced software engineer with 5+ years of expertise in full-stack development, cloud architecture, and team leadership.

\\section*{EXPERIENCE}

\\textbf{Senior Software Engineer} | Tech Company Inc. | Jan 2021 - Present
\\begin{itemize}
  \\item Led development of microservices architecture handling 10M+ requests/day
  \\item Mentored 3 junior developers and conducted technical interviews
  \\item Reduced system latency by 40% through optimization efforts
\\end{itemize}

\\section*{EDUCATION}

\\textbf{Bachelor of Science in Computer Science}\\\\
State University | Graduated: May 2018

\\section*{SKILLS}

\\textbf{Languages:} Python, JavaScript, TypeScript, Go, SQL\\\\
\\textbf{Frameworks:} React, Node.js, FastAPI, Kubernetes\\\\
\\textbf{Tools:} Docker, AWS, PostgreSQL, Git

\\end{document}`

export default function EditorPage() {
  const {
    files,
    activeFileId,
    projectName,
    content,
    isModified,
    isBuilding,
    showBuildLog,
    showTemplateModal,
    showSettings,
    sidebarWidth,
    isDragging,
    settings,
    buildLogs,
    setActiveFile,
    setContent,
    setIsModified,
    setIsBuilding,
    setShowBuildLog,
    setShowTemplateModal,
    setShowSettings,
    setSidebarWidth,
    setIsDragging,
    setFiles,
    setBuildLogs,
  } = useEditorStore()

  const [mounted, setMounted] = useState(false)

  // Initialize with sample data
  useEffect(() => {
    setMounted(true)
    if (files.length === 0) {
      setFiles([
        {
          id: "folder-1",
          name: "my-resume",
          type: "folder",
          children: [
            {
              id: "file-1",
              name: "resume.tex",
              type: "file",
              isMain: true,
              content: SAMPLE_RESUME,
            },
            {
              id: "file-2",
              name: "sections.tex",
              type: "file",
              content: "% Include your sections here\n",
            },
            {
              id: "file-3",
              name: "style.sty",
              type: "file",
              content: "% Custom style definitions\n",
            },
          ],
        },
      ])
      setActiveFile("file-1", SAMPLE_RESUME)
    }
  }, [files.length, setFiles, setActiveFile])

  // Handle sidebar resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true)
      e.preventDefault()
    },
    [setIsDragging]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(150, Math.min(500, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, setSidebarWidth, setIsDragging])

  // Handle file selection
  const handleFileSelect = useCallback(
    (fileId: string) => {
      const findFileContent = (items: any[]): string | null => {
        for (const item of items) {
          if (item.id === fileId) {
            return item.content || ""
          }
          if (item.children) {
            const found = findFileContent(item.children)
            if (found !== null) return found
          }
        }
        return null
      }

      const fileContent = findFileContent(files)
      if (fileContent !== null) {
        setActiveFile(fileId, fileContent)
      }
    },
    [files, setActiveFile]
  )

  // Handle content change
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent)
      setIsModified(true)
    },
    [setContent, setIsModified]
  )

  // Handle build
  const handleBuild = useCallback(() => {
    setIsBuilding(true)
    // Simulate build process
    const newLogs = [
      { type: "info" as const, message: "Starting pdfLaTeX compilation...", timestamp: new Date().toLocaleTimeString() },
      { type: "info" as const, message: `Processing ${activeFileId || "document"}.tex`, timestamp: new Date().toLocaleTimeString() },
      { type: "success" as const, message: "Output written to PDF (1 page, 142.5 KB)", timestamp: new Date().toLocaleTimeString() },
    ]
    setBuildLogs(newLogs)
    setShowBuildLog(true)

    setTimeout(() => {
      setIsBuilding(false)
    }, 2000)
  }, [setIsBuilding, setBuildLogs, setShowBuildLog, activeFileId])

  // Handle save
  const handleSave = useCallback(() => {
    setIsModified(false)
    // In real app: save to file system
  }, [setIsModified])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S: Save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
      // Cmd/Ctrl + B: Build
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        handleBuild()
      }
      // Cmd/Ctrl + K: Focus search (can be extended later)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, handleBuild])

  if (!mounted) {
    return null
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem suppressHydrationWarning>
      <ColorPaletteProvider>
        <LayoutWrapper>
          {/* Header */}
          <Header
            onOpenFolder={() => console.log("Open folder")}
            onOpenFile={() => console.log("Open file")}
            onSave={handleSave}
            onSaveAs={() => console.log("Save as")}
            onBuild={handleBuild}
            onNewFromTemplate={() => setShowTemplateModal(true)}
            onOpenSettings={() => setShowSettings(true)}
          />

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar - File Explorer */}
            <div
              style={{ width: `${sidebarWidth}px` }}
              className={cn(
                "flex flex-col transition-all",
                isDragging && "select-none"
              )}
            >
              <FileTree
                files={files}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
              />
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              className={cn(
                "w-1 bg-border hover:bg-muted-foreground/20 cursor-col-resize transition-colors",
                isDragging && "bg-muted-foreground/40"
              )}
            />

            {/* Editor and Preview Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Code Editor */}
              <div className="flex-1 flex flex-col min-w-0 p-4">
                <SmoothCodeEditor
                  content={content}
                  onChange={handleContentChange}
                  fileName={
                    files.find((f) => f.id === activeFileId)?.name ||
                    "Untitled"
                  }
                  fontSize={settings.fontSize}
                  tabSize={settings.tabSize}
                />
              </div>

              {/* Divider */}
              <div className="w-1 bg-border" />

              {/* PDF Preview */}
              <div className="flex-1 flex flex-col min-w-0 p-4">
                <PdfPreview
                  fileName={
                    files.find((f) => f.id === activeFileId)?.name ||
                    "Untitled"
                  }
                  isBuilding={isBuilding}
                />
              </div>
            </div>
          </div>

          {/* Build Log Panel */}
          {showBuildLog && (
            <div className="h-40 border-t border-border bg-panel-bg">
              <BuildLog
                logs={buildLogs}
                onClose={() => setShowBuildLog(false)}
              />
            </div>
          )}

          {/* Modals */}
          <TemplateModal
            open={showTemplateModal}
            onOpenChange={setShowTemplateModal}
          />
          <AdvancedSettings
            open={showSettings}
            onOpenChange={setShowSettings}
          />
        </LayoutWrapper>
      </ColorPaletteProvider>
    </ThemeProvider>
  )
}
