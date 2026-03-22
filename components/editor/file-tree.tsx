"use client"

import { memo, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  Clock,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useEditorStore } from "@/lib/store"
import type { FileTreeNode, FileType } from "@/lib/api-types"

interface FileTreeItemProps {
  item: FileTreeNode
  depth: number
  activeFileId: string | null
  onFileSelect: (id: string) => void
  onRename: (id: string, newName: string) => void
  onDelete: (id: string) => void
  onCreate: (parentId: string | null, name: string, type: FileType) => void
}

const FileTreeItemComponent = memo(function FileTreeItem({
  item,
  depth,
  activeFileId,
  onFileSelect,
  onRename,
  onDelete,
  onCreate,
}: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(item.name)

  const isActive = activeFileId === item.id
  const isFolder = item.type === "folder"

  const handleRenameCommit = useCallback(() => {
    const trimmed = newName.trim()
    if (trimmed && trimmed !== item.name) {
      onRename(item.id, trimmed)
    }
    setIsRenaming(false)
    setNewName(item.name)
  }, [newName, item.id, item.name, onRename])

  const handleDeleteClick = useCallback(() => {
    onDelete(item.id)
  }, [item.id, onDelete])

  const handleCreateFile = useCallback(() => {
    onCreate(item.id, "untitled.tex", "file")
  }, [item.id, onCreate])

  const handleCreateFolder = useCallback(() => {
    onCreate(item.id, "New Folder", "folder")
  }, [item.id, onCreate])

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 h-7 px-2 cursor-pointer rounded-sm transition-colors relative",
          isActive
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) setIsExpanded((v) => !v)
          else onFileSelect(item.id)
        }}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0" />
            )}
          </>
        ) : (
          <>
            <div className="w-3.5" />
            <FileText className="h-3.5 w-3.5 shrink-0" />
          </>
        )}

        {isRenaming ? (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameCommit()
              if (e.key === "Escape") { setIsRenaming(false); setNewName(item.name) }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent px-1 outline-none border-b border-accent focus:border-foreground"
          />
        ) : (
          <span className="flex-1 truncate text-xs">{item.name}</span>
        )}

        {/* Context menu */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => { setIsRenaming(true); setNewName(item.name) }}>
                <Edit2 className="mr-2 h-3 w-3" />
                Rename
              </DropdownMenuItem>
              {isFolder && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCreateFile}>
                    <FileText className="mr-2 h-3 w-3" />
                    New File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreateFolder}>
                    <Folder className="mr-2 h-3 w-3" />
                    New Folder
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Children */}
      {isFolder && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItemComponent
              key={child.id}
              item={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreate={onCreate}
            />
          ))}
        </div>
      )}
    </div>
  )
})

interface FileTreeProps {
  files: FileTreeNode[]
  activeFileId: string | null
  onFileSelect: (id: string) => void
  onShowHistory: () => void
  onRename: (id: string, newName: string) => void
  onDelete: (id: string) => void
  onCreate: (parentId: string | null, name: string, type: FileType) => void
}

export const FileTree = memo(function FileTree({
  files,
  activeFileId,
  onFileSelect,
  onShowHistory,
  onRename,
  onDelete,
  onCreate,
}: FileTreeProps) {
  const { projectName } = useEditorStore()

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="h-9 border-b border-sidebar-border px-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-sidebar-foreground truncate">
          {projectName}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onCreate(null, "untitled.tex", "file")}>
              <FileText className="mr-2 h-3 w-3" />
              New File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate(null, "New Folder", "folder")}>
              <Folder className="mr-2 h-3 w-3" />
              New Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {files.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            No files. Create a new file to get started.
          </div>
        ) : (
          files.map((item) => (
            <FileTreeItemComponent
              key={item.id}
              item={item}
              depth={0}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreate={onCreate}
            />
          ))
        )}
      </div>

      {/* Footer: Version History tab */}
      <div className="shrink-0 border-t border-sidebar-border">
        <button
          onClick={onShowHistory}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Version History
        </button>
      </div>
    </div>
  )
})
