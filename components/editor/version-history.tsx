"use client"

import { memo, useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Clock,
  Star,
  X,
  RotateCcw,
  Plus,
  Trash2,
  GitCompare,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  listVersions,
  saveVersion,
  updateVersion,
  deleteVersion,
} from "@/lib/api"
import type { VersionSnapshot } from "@/lib/api-types"
import { useEditorStore } from "@/lib/store"

interface VersionHistoryProps {
  onClose: () => void
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(isoString).toLocaleDateString()
}

// ── Minimal line-level diff ───────────────────────────────────────────────────
type DiffRow =
  | { kind: "same"; text: string }
  | { kind: "removed"; text: string }
  | { kind: "added"; text: string }

function diffLines(a: string, b: string): DiffRow[] {
  const aLines = a.split("\n")
  const bLines = b.split("\n")
  const rows: DiffRow[] = []

  // Simple LCS-less approach: build a "unified" view by pairing lines.
  // For a real diff we'd use Myers; for the sidebar this is good enough.
  const maxLen = Math.max(aLines.length, bLines.length)
  for (let i = 0; i < maxLen; i++) {
    const aLine = aLines[i]
    const bLine = bLines[i]
    if (aLine === undefined) {
      rows.push({ kind: "added", text: bLine })
    } else if (bLine === undefined) {
      rows.push({ kind: "removed", text: aLine })
    } else if (aLine === bLine) {
      rows.push({ kind: "same", text: aLine })
    } else {
      rows.push({ kind: "removed", text: aLine })
      rows.push({ kind: "added", text: bLine })
    }
  }
  return rows
}

// ── Commit message input ──────────────────────────────────────────────────────
interface CommitInputProps {
  onCommit: (message: string) => void
  isLoading: boolean
}

function CommitInput({ onCommit, isLoading }: CommitInputProps) {
  const [msg, setMsg] = useState("")
  return (
    <div className="flex gap-2 px-3 py-2 border-b border-border shrink-0">
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && msg.trim()) { onCommit(msg.trim()); setMsg("") }
        }}
        placeholder="Commit message... (Enter)"
        className="flex-1 text-xs bg-muted/40 border border-border/60 rounded px-2 py-1 outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
        disabled={isLoading}
      />
      <Button
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={!msg.trim() || isLoading}
        onClick={() => { onCommit(msg.trim()); setMsg("") }}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ── Diff view panel ───────────────────────────────────────────────────────────
interface DiffViewProps {
  version: VersionSnapshot
  currentContent: string
  onBack: () => void
  onRestore: () => void
}

function DiffView({ version, currentContent, onBack, onRestore }: DiffViewProps) {
  const rows = diffLines(version.content, currentContent)
  const removed = rows.filter((r) => r.kind === "removed").length
  const added = rows.filter((r) => r.kind === "added").length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="flex items-center gap-2 text-xs">
          {removed > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
              -{removed}
            </span>
          )}
          {added > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
              +{added}
            </span>
          )}
        </div>
        <Button size="sm" className="h-6 px-2.5 text-xs gap-1" onClick={onRestore}>
          <RotateCcw className="h-3 w-3" />
          Restore
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin font-mono text-xs">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "px-3 py-0 leading-5 whitespace-pre-wrap break-all",
              row.kind === "removed" && "bg-red-500/10 text-red-700 dark:text-red-300",
              row.kind === "added" && "bg-green-500/10 text-green-700 dark:text-green-300",
              row.kind === "same" && "text-muted-foreground/60"
            )}
          >
            {row.kind === "removed" && <span className="select-none mr-1 opacity-60">-</span>}
            {row.kind === "added" && <span className="select-none mr-1 opacity-60">+</span>}
            {row.kind === "same" && <span className="select-none mr-1 opacity-0">·</span>}
            {row.text || " "}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export const VersionHistory = memo(function VersionHistory({ onClose }: VersionHistoryProps) {
  const { activeFileId, content, setContent, setIsModified } = useEditorStore()
  const [versions, setVersions] = useState<VersionSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [diffTarget, setDiffTarget] = useState<VersionSnapshot | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  const loadVersions = useCallback(async () => {
    if (!activeFileId) return
    setIsLoading(true)
    const result = await listVersions(activeFileId)
    if (result.ok) setVersions(result.data)
    setIsLoading(false)
  }, [activeFileId])

  useEffect(() => { loadVersions() }, [loadVersions])

  // Auto-save every 2 minutes
  useEffect(() => {
    if (!activeFileId || !content) return
    const timer = setTimeout(async () => {
      await saveVersion(activeFileId, content, "Auto-saved", true)
      loadVersions()
    }, 2 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [content, activeFileId, loadVersions])

  const handleCommit = useCallback(async (message: string) => {
    if (!activeFileId) return
    setIsSaving(true)
    await saveVersion(activeFileId, content, message, false)
    await loadVersions()
    setIsSaving(false)
  }, [activeFileId, content, loadVersions])

  const handleToggleStar = useCallback(async (version: VersionSnapshot, e: React.MouseEvent) => {
    e.stopPropagation()
    await updateVersion(version.id, { isStarred: !version.isStarred })
    loadVersions()
  }, [loadVersions])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteVersion(id)
    loadVersions()
    if (diffTarget?.id === id) setDiffTarget(null)
  }, [loadVersions, diffTarget])

  const handleStartRename = useCallback((version: VersionSnapshot, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(version.id)
    setEditingLabel(version.label)
    setTimeout(() => editInputRef.current?.select(), 50)
  }, [])

  const handleSaveRename = useCallback(async () => {
    if (!editingId) return
    await updateVersion(editingId, { label: editingLabel || "Unnamed version" })
    setEditingId(null)
    loadVersions()
  }, [editingId, editingLabel, loadVersions])

  const handleRestore = useCallback(() => {
    if (!diffTarget) return
    setContent(diffTarget.content)
    setIsModified(true)
    setDiffTarget(null)
  }, [diffTarget, setContent, setIsModified])

  // Show diff view if a version is selected
  if (diffTarget) {
    return (
      <DiffView
        version={diffTarget}
        currentContent={content}
        onBack={() => setDiffTarget(null)}
        onRestore={handleRestore}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Version History</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Commit message input */}
      <CommitInput onCommit={handleCommit} isLoading={isSaving} />

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="p-4 text-xs text-muted-foreground text-center">Loading history...</div>
        ) : versions.length === 0 ? (
          <div className="p-5 flex flex-col items-center gap-3 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">No history yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Type a commit message above and press Enter, or versions auto-save every 2 minutes.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2 relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[22px] top-4 bottom-4 w-px bg-border" aria-hidden />

            {versions.map((version, index) => {
              const isEditing = editingId === version.id
              return (
                <div
                  key={version.id}
                  className="flex gap-3 px-3 py-2 hover:bg-muted/50 transition-colors group relative"
                >
                  {/* Timeline node */}
                  <div className="shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center z-10">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2 transition-all",
                        version.isStarred
                          ? "bg-primary border-primary"
                          : index === 0
                          ? "bg-foreground border-foreground"
                          : "bg-background border-border group-hover:border-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename()
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs w-full bg-background border border-primary/40 rounded px-1.5 py-0.5 outline-none"
                      />
                    ) : (
                      <p
                        className="text-xs font-medium leading-tight truncate cursor-default"
                        onDoubleClick={(e) => handleStartRename(version, e)}
                        title="Double-click to rename"
                      >
                        {version.label}
                        {index === 0 && (
                          <span className="ml-1.5 text-[10px] text-primary">current</span>
                        )}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {formatRelativeTime(version.createdAt)}
                      {version.isAutoSave ? " · auto" : " · manual"}
                    </p>
                  </div>

                  {/* Actions (hover) */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setDiffTarget(version)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-colors"
                      title="Show diff vs current"
                    >
                      <GitCompare className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => handleToggleStar(version, e)}
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors",
                        version.isStarred ? "text-primary" : "text-muted-foreground"
                      )}
                      title={version.isStarred ? "Unstar" : "Star version"}
                    >
                      <Star className={cn("h-3 w-3", version.isStarred && "fill-current")} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(version.id, e)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete version"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})
