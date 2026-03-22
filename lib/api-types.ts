// ─── Central type definitions for TeXPress REST-client architecture ───────────
// All API functions and components must import types from here.

export type FileType = "file" | "folder"

export interface FileItem {
  id: string
  name: string
  type: FileType
  parentId: string | null
  /** Only present for files, not folders */
  content?: string
  isMainFile?: boolean
}

export interface FileTreeNode extends FileItem {
  children?: FileTreeNode[]
}

export interface Project {
  id: string
  name: string
  mainFileId: string | null
  createdAt: string
  updatedAt: string
}

// ─── Build types ──────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warning" | "error" | "success"

export interface BuildLogEntry {
  id: string
  level: LogLevel
  message: string
  /** 1-based line number in the source file, if parsed */
  line?: number
  /** Source file name if applicable */
  file?: string
  raw: string
}

export interface BuildResult {
  buildId: string
  success: boolean
  logs: BuildLogEntry[]
  /** Duration in milliseconds */
  durationMs: number
  /** Page count if successful */
  pages?: number
}

// ─── Version / history types ──────────────────────────────────────────────────

export interface VersionSnapshot {
  id: string
  fileId: string
  content: string
  label: string
  isStarred: boolean
  isAutoSave: boolean
  createdAt: string
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  status?: number
}

export type ApiResult<T> = ApiOk<T> | ApiError

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface CreateItemRequest {
  parentId: string | null
  name: string
  type: FileType
  content?: string
}

export interface RenameItemRequest {
  id: string
  name: string
}

export interface DeleteItemRequest {
  id: string
}

export interface WriteFileRequest {
  id: string
  content: string
}

export interface CompileRequest {
  projectId: string
  mainFileId: string
  /** Engine to use */
  compiler: "pdflatex" | "xetex" | "luatex"
}
