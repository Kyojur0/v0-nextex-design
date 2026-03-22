// ─── lib/mock-api.ts ──────────────────────────────────────────────────────────
// In-memory mock implementation of the lib/api.ts contract.
// Maintains mutable state: file tree, file contents, build history, versions.
// Simulates network latency (50–250 ms) and occasional transient errors (5%).

import type {
  ApiResult,
  BuildLogEntry,
  BuildResult,
  CompileRequest,
  CreateItemRequest,
  DeleteItemRequest,
  FileItem,
  FileTreeNode,
  LogLevel,
  Project,
  RenameItemRequest,
  VersionSnapshot,
  WriteFileRequest,
} from "@/lib/api-types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function isoNow(): string {
  return new Date().toISOString()
}

/** Simulate async latency */
function delay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 120))
}

/** Wrap a successful value */
function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

/** Wrap an error */
function err(error: string, status = 500): ApiResult<never> {
  return { ok: false, error, status }
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const ROOT_ID = "root"
const MAIN_FILE_ID = "file-main"
const SECTIONS_ID = "file-sections"
const PREAMBLE_ID = "file-preamble"
const FOLDER_ID = "folder-sections"

const SEED_PROJECT: Project = {
  id: "project-1",
  name: "My Resume",
  mainFileId: MAIN_FILE_ID,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: isoNow(),
}

const SEED_MAIN_CONTENT = `\\documentclass[11pt,a4paper]{article}
\\input{preamble}

\\begin{document}

\\begin{center}
  {\\LARGE \\textbf{Jane Doe}} \\\\[4pt]
  jane@example.com $\\cdot$ github.com/janedoe $\\cdot$ +1 555 000 1234
\\end{center}

\\input{sections/experience}

\\end{document}
`

const SEED_PREAMBLE = `% Preamble — shared packages and commands
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}

\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\setlength{\\parindent}{0pt}
`

const SEED_SECTIONS = `% Experience section
\\section{Experience}

\\textbf{Software Engineer} \\hfill Jan 2023 -- Present \\\\
Acme Corp, San Francisco, CA

\\begin{itemize}[noitemsep]
  \\item Designed and shipped three major product features.
  \\item Reduced API latency by 40\\% via query optimisation.
  \\item Mentored two junior engineers.
\\end{itemize}
`

// ─── In-memory store ──────────────────────────────────────────────────────────

let _project: Project = { ...SEED_PROJECT }

// Flat map of all file items (files + folders)
const _items = new Map<string, FileItem>([
  [ROOT_ID, { id: ROOT_ID, name: "My Resume", type: "folder", parentId: null }],
  [FOLDER_ID, { id: FOLDER_ID, name: "sections", type: "folder", parentId: ROOT_ID }],
  [MAIN_FILE_ID, { id: MAIN_FILE_ID, name: "main.tex", type: "file", parentId: ROOT_ID, content: SEED_MAIN_CONTENT, isMainFile: true }],
  [PREAMBLE_ID, { id: PREAMBLE_ID, name: "preamble.tex", type: "file", parentId: ROOT_ID, content: SEED_PREAMBLE }],
  [SECTIONS_ID, { id: SECTIONS_ID, name: "experience.tex", type: "file", parentId: FOLDER_ID, content: SEED_SECTIONS }],
])

// Build log store: buildId → result
const _builds = new Map<string, BuildResult>()

// Version snapshots: id → snapshot
const _versions = new Map<string, VersionSnapshot>()

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildTree(parentId: string | null): FileTreeNode[] {
  return [..._items.values()]
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => {
      // Folders first, then alphabetical
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((item) => ({
      ...item,
      children: item.type === "folder" ? buildTree(item.id) : undefined,
    }))
}

function flatItems(): FileItem[] {
  return [..._items.values()]
}

// ─── Build log parser helpers ─────────────────────────────────────────────────

function parseBuildLogs(compiler: string, content: string): BuildLogEntry[] {
  const logs: BuildLogEntry[] = []

  const push = (level: LogLevel, message: string, line?: number, file?: string, raw?: string) =>
    logs.push({ id: uid(), level, message, line, file, raw: raw ?? message })

  push("info", `Starting ${compiler} compilation...`)
  push("info", `Processing: main.tex`)

  // Simulate a few realistic passes
  push("info", `LaTeX2e <2023-11-01> patch level 1`)
  push("info", `Document class: article 2023/05/17 v1.4n Standard LaTeX document class`)

  // Scan content for common issues
  const lines = content.split("\n")
  let hasUnclosedBrace = false
  let undefinedRefs: string[] = []

  lines.forEach((line, idx) => {
    const lineNo = idx + 1
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length
    if (opens !== closes) hasUnclosedBrace = true

    const refMatch = line.match(/\\ref\{([^}]+)\}/)
    if (refMatch) undefinedRefs.push(`\`${refMatch[1]}' on line ${lineNo}`)

    // Missing package simulation
    if (line.includes("\\usepackage") && line.includes("minted")) {
      push("warning", `Package minted requires -shell-escape flag`, lineNo, "preamble.tex")
    }
  })

  if (hasUnclosedBrace) {
    push("warning", `Possible unmatched brace detected — check your source`, undefined, "main.tex")
  }

  // Simulate successful multi-pass
  push("info", `[1] (./main.aux)`)
  push("info", `LaTeX Warning: Label(s) may have changed. Rerun to get cross-references right.`)
  push("warning", `LaTeX Warning: Label(s) may have changed. Rerun to get cross-references right.`)
  push("info", `[1] (./main.aux)`)

  if (Math.random() > 0.15) {
    push("success", `Output written on main.pdf (1 page, ${Math.floor(Math.random() * 40000 + 20000)} bytes).`)
    push("info", `Transcript written on main.log.`)
  } else {
    push("error", `! Undefined control sequence.`, Math.floor(Math.random() * lines.length + 1), "main.tex")
    push("error", `l.${Math.floor(Math.random() * lines.length + 1)} \\badcommand`, undefined, "main.tex")
  }

  return logs
}

// ─── Mock API implementation ──────────────────────────────────────────────────

export const mockApi = {
  // ── Projects ────────────────────────────────────────────────────────────────

  async fetchProject(): Promise<ApiResult<Project>> {
    await delay()
    return ok({ ..._project })
  },

  async renameProject(name: string): Promise<ApiResult<Project>> {
    await delay(60)
    _project = { ..._project, name, updatedAt: isoNow() }
    // Also rename the root folder
    const root = _items.get(ROOT_ID)
    if (root) _items.set(ROOT_ID, { ...root, name })
    return ok({ ..._project })
  },

  // ── File tree ────────────────────────────────────────────────────────────────

  async fetchFileTree(): Promise<ApiResult<FileTreeNode[]>> {
    await delay()
    return ok(buildTree(ROOT_ID))
  },

  async fetchFlatFiles(): Promise<ApiResult<FileItem[]>> {
    await delay()
    return ok(flatItems())
  },

  // ── Single file ──────────────────────────────────────────────────────────────

  async readFile(id: string): Promise<ApiResult<FileItem>> {
    await delay(40)
    const item = _items.get(id)
    if (!item) return err(`File not found: ${id}`, 404)
    return ok({ ...item })
  },

  async writeFile(req: WriteFileRequest): Promise<ApiResult<FileItem>> {
    await delay(50)
    const item = _items.get(req.id)
    if (!item) return err(`File not found: ${req.id}`, 404)
    if (item.type !== "file") return err("Cannot write to a folder", 400)
    const updated: FileItem = { ...item, content: req.content }
    _items.set(req.id, updated)
    return ok({ ...updated })
  },

  // ── Tree mutations ────────────────────────────────────────────────────────────

  async createItem(req: CreateItemRequest): Promise<ApiResult<FileItem>> {
    await delay(80)
    // Name collision check
    const siblings = [..._items.values()].filter((i) => i.parentId === req.parentId)
    if (siblings.some((s) => s.name === req.name)) {
      return err(`An item named "${req.name}" already exists here`, 409)
    }
    const newItem: FileItem = {
      id: uid(),
      name: req.name,
      type: req.type,
      parentId: req.parentId,
      content: req.type === "file" ? (req.content ?? "") : undefined,
    }
    _items.set(newItem.id, newItem)
    return ok({ ...newItem })
  },

  async renameItem(req: RenameItemRequest): Promise<ApiResult<FileItem>> {
    await delay(60)
    const item = _items.get(req.id)
    if (!item) return err(`Item not found: ${req.id}`, 404)
    // Collision check among siblings
    const siblings = [..._items.values()].filter(
      (i) => i.parentId === item.parentId && i.id !== req.id
    )
    if (siblings.some((s) => s.name === req.name)) {
      return err(`An item named "${req.name}" already exists here`, 409)
    }
    const updated: FileItem = { ...item, name: req.name }
    _items.set(req.id, updated)
    return ok({ ...updated })
  },

  async deleteItem(req: DeleteItemRequest): Promise<ApiResult<{ deletedIds: string[] }>> {
    await delay(60)
    if (!_items.has(req.id)) return err(`Item not found: ${req.id}`, 404)

    const toDelete: string[] = []
    const collect = (id: string) => {
      toDelete.push(id)
      // Recursively collect children
      ;[..._items.values()]
        .filter((i) => i.parentId === id)
        .forEach((child) => collect(child.id))
    }
    collect(req.id)
    toDelete.forEach((id) => _items.delete(id))

    return ok({ deletedIds: toDelete })
  },

  // ── Build / compile ────────────────────────────────────────────────────────────

  async compileLaTeX(req: CompileRequest): Promise<ApiResult<BuildResult>> {
    // Longer delay for compile
    await delay(900 + Math.random() * 600)

    const mainFile = _items.get(req.mainFileId)
    const content = mainFile?.content ?? ""
    const logs = parseBuildLogs(req.compiler, content)
    const hasError = logs.some((l) => l.level === "error")
    const buildId = uid()

    const result: BuildResult = {
      buildId,
      success: !hasError,
      logs,
      durationMs: 900 + Math.random() * 600,
      pages: hasError ? undefined : 1,
    }

    _builds.set(buildId, result)
    return ok(result)
  },

  getPdfUrl(buildId: string): string {
    // Always return the static placeholder PDF in /public
    return `/sample.pdf`
  },

  // ── Version history ─────────────────────────────────────────────────────────

  async listVersions(fileId: string): Promise<ApiResult<VersionSnapshot[]>> {
    await delay(60)
    const snapshots = [..._versions.values()]
      .filter((v) => v.fileId === fileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return ok(snapshots)
  },

  async saveVersion(
    fileId: string,
    content: string,
    label: string,
    isAutoSave: boolean
  ): Promise<ApiResult<VersionSnapshot>> {
    await delay(50)
    const snap: VersionSnapshot = {
      id: uid(),
      fileId,
      content,
      label,
      isStarred: false,
      isAutoSave,
      createdAt: isoNow(),
    }
    _versions.set(snap.id, snap)
    return ok({ ...snap })
  },

  async updateVersion(
    id: string,
    patch: Partial<Pick<VersionSnapshot, "label" | "isStarred">>
  ): Promise<ApiResult<VersionSnapshot>> {
    await delay(50)
    const snap = _versions.get(id)
    if (!snap) return err(`Version not found: ${id}`, 404)
    const updated: VersionSnapshot = { ...snap, ...patch }
    _versions.set(id, updated)
    return ok({ ...updated })
  },

  async deleteVersion(id: string): Promise<ApiResult<{ id: string }>> {
    await delay(50)
    if (!_versions.has(id)) return err(`Version not found: ${id}`, 404)
    _versions.delete(id)
    return ok({ id })
  },
}

export type MockApi = typeof mockApi
