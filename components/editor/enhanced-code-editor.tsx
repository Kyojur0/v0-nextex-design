"use client"

import { memo, useRef, useEffect, useCallback, useState, useMemo } from "react"
import { tokenizeLaTeX, renderLine, getTokenColor } from "@/lib/syntax-highlighter"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

interface EnhancedCodeEditorProps {
  content: string
  onChange: (content: string) => void
  /** Called whenever the selection changes. null rect = selection cleared. */
  onSelectionChange?: (selected: string, anchorEl: HTMLTextAreaElement | null) => void
  fileName: string
  fontSize?: number
  tabSize?: number
  enableSyntaxHighlight?: boolean
  wordWrap?: boolean
  onAISpotlight?: () => void
}

export const EnhancedCodeEditor = memo(function EnhancedCodeEditor({
  content,
  onChange,
  onSelectionChange,
  fileName,
  fontSize = 14,
  tabSize = 2,
  enableSyntaxHighlight = false,
  wordWrap = true,
  onAISpotlight,
}: EnhancedCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const lineNumRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // ── Jump-to-line from terminal ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: CustomEvent<{ line: number }>) => {
      const ta = textareaRef.current
      if (!ta) return
      const lines = content.split("\n")
      const targetLine = Math.max(0, e.detail.line - 1)
      let charOffset = 0
      for (let i = 0; i < targetLine; i++) charOffset += lines[i].length + 1
      ta.focus()
      ta.setSelectionRange(charOffset, charOffset + (lines[targetLine]?.length ?? 0))
      ta.scrollTop = Math.max(0, targetLine * fontSize * 1.5 - 80)
    }
    window.addEventListener("editor:jump-to-line", handler as EventListener)
    return () => window.removeEventListener("editor:jump-to-line", handler as EventListener)
  }, [content, fontSize])

  // ── Tab key ───────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Tab") return
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const { selectionStart: s, selectionEnd: end } = ta
      const tab = " ".repeat(tabSize)
      onChange(content.slice(0, s) + tab + content.slice(end))
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + tabSize })
    },
    [content, onChange, tabSize]
  )

  // ── Scroll sync ───────────────────────────────────────────────────────────
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop
      highlightRef.current.scrollLeft = ta.scrollLeft
    }
    if (lineNumRef.current) lineNumRef.current.scrollTop = ta.scrollTop
  }, [])

  // ── Selection reporting ────────────────────────────────────────────────────
  const notifySelection = useCallback(() => {
    const ta = textareaRef.current
    if (!ta || !onSelectionChange) return
    const { selectionStart: s, selectionEnd: e } = ta
    if (s === e) { onSelectionChange("", null); return }
    onSelectionChange(content.slice(s, e), ta)
  }, [content, onSelectionChange])

  // ── Tokenise (memoised) ───────────────────────────────────────────────────
  const tokens = useMemo(
    () => (enableSyntaxHighlight && mounted ? tokenizeLaTeX(content) : []),
    [content, enableSyntaxHighlight, mounted]
  )

  // Pre-compute line start offsets once per content change
  const lines = content.split("\n")
  const lineOffsets = useMemo(() => {
    const offsets: number[] = []
    let pos = 0
    for (const line of lines) { offsets.push(pos); pos += line.length + 1 }
    return offsets
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const isDark = mounted && theme === "dark"

  return (
    <div className="flex flex-col h-full bg-editor-bg border border-border rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="h-9 border-b border-border bg-muted/30 px-4 flex items-center shrink-0">
        <span className="text-xs font-medium text-muted-foreground">{fileName}</span>
      </div>

      {/* Main editor row */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        <div
          ref={lineNumRef}
          className="overflow-hidden bg-muted/20 select-none shrink-0 border-r border-border/30"
          style={{ fontSize: `${fontSize}px`, lineHeight: "1.5em" }}
          aria-hidden
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-end pr-3 pl-2 text-xs text-muted-foreground/60"
              style={{ height: "1.5em" }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor pane: highlight overlay + textarea stacked */}
        <div className="flex-1 relative overflow-hidden">
          {/* Syntax highlight overlay — pointer-events-none, matches textarea exactly */}
          {enableSyntaxHighlight && mounted && (
            <div
              ref={highlightRef}
              aria-hidden
              className="absolute inset-0 pointer-events-none overflow-hidden font-mono"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: "1.5em",
                padding: "1rem",
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                wordBreak: wordWrap ? "break-words" : "normal",
                overflowX: wordWrap ? "hidden" : "scroll",
                overflowY: "scroll",
                // Scrollbars hidden visually
                scrollbarWidth: "none",
              }}
            >
              {lines.map((line, lineIdx) => {
                const lineStart = lineOffsets[lineIdx]
                const lineEnd = lineStart + line.length
                const spans = renderLine(tokens, lineStart, lineEnd, line)
                return (
                  <div key={lineIdx} style={{ height: "1.5em", display: "block", minHeight: "1.5em" }}>
                    {spans.length === 0
                      ? <span> </span>
                      : spans.map((span, si) => (
                          <span key={si} className={getTokenColor(span.type, isDark)}>
                            {span.text}
                          </span>
                        ))
                    }
                  </div>
                )
              })}
            </div>
          )}

          {/* Actual editable textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            onSelect={notifySelection}
            onMouseUp={notifySelection}
            onKeyUp={notifySelection}
            className={cn(
              "absolute inset-0 w-full h-full font-mono p-4 resize-none outline-none bg-transparent",
              "scrollbar-thin",
              enableSyntaxHighlight && mounted
                ? "text-transparent caret-foreground"
                : "text-editor-cursor",
              wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
            )}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: "1.5em",
              tabSize: tabSize,
              caretColor: "currentColor",
              zIndex: 1,
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap={wordWrap ? "soft" : "off"}
            aria-label={`Code editor: ${fileName}`}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="h-7 border-t border-border bg-muted/20 px-4 flex items-center justify-between text-xs text-muted-foreground shrink-0">
        <span>{lines.length} {lines.length === 1 ? "line" : "lines"}</span>
        <div className="flex items-center gap-3">
          <span>{content.length} chars</span>
          {onAISpotlight && (
            <button
              onClick={onAISpotlight}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              title="Open AI Spotlight (Cmd+K)"
            >
              <Sparkles className="h-3 w-3" />
              AI
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
