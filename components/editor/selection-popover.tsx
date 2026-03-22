"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Copy, Scissors, Clipboard, Sparkles, AlignJustify } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectionPopoverProps {
  /** The currently selected text */
  selectedText: string
  /** The textarea element that contains the selection */
  anchorEl: HTMLTextAreaElement | null
  /** Called when "Ask AI" is clicked */
  onAskAI: (text: string) => void
  /** Called when the popover should close */
  onDismiss: () => void
  /** Called when content changes (cut/paste) */
  onContentChange: (newContent: string) => void
  /** Full editor content (needed for cut) */
  content: string
}

export function SelectionPopover({
  selectedText,
  anchorEl,
  onAskAI,
  onDismiss,
  onContentChange,
  content,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // ── Position the popover above the selection ─────────────────────────────
  useEffect(() => {
    if (!anchorEl || !selectedText) { setPos(null); return }

    // Use the Selection API to get precise bounding rect
    const domSel = window.getSelection()
    if (domSel && domSel.rangeCount > 0) {
      const range = domSel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width > 0) {
        setPos({
          top: rect.top + window.scrollY - 48, // 8px above
          left: rect.left + window.scrollX + rect.width / 2,
        })
        return
      }
    }

    // Fallback: position near top-centre of textarea
    const rect = anchorEl.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY + 40,
      left: rect.left + window.scrollX + rect.width / 2,
    })
  }, [selectedText, anchorEl])

  // ── Dismiss on Escape or click-outside ───────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss() }
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          e.target !== anchorEl) {
        onDismiss()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("pointerdown", handlePointerDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [onDismiss, anchorEl])

  const showFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(null), 1200)
  }

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(selectedText)
    showFeedback("Copied")
  }, [selectedText])

  const handleCut = useCallback(async () => {
    if (!anchorEl) return
    const { selectionStart: s, selectionEnd: e } = anchorEl
    await navigator.clipboard.writeText(selectedText)
    onContentChange(content.slice(0, s) + content.slice(e))
    showFeedback("Cut")
    onDismiss()
  }, [anchorEl, selectedText, content, onContentChange, onDismiss])

  const handlePaste = useCallback(async () => {
    if (!anchorEl) return
    const text = await navigator.clipboard.readText()
    const { selectionStart: s, selectionEnd: e } = anchorEl
    onContentChange(content.slice(0, s) + text + content.slice(e))
    onDismiss()
  }, [anchorEl, content, onContentChange, onDismiss])

  const handleAskAI = useCallback(() => {
    onAskAI(selectedText)
    onDismiss()
  }, [selectedText, onAskAI, onDismiss])

  // Indent selected lines
  const handleIndent = useCallback(() => {
    if (!anchorEl) return
    const { selectionStart: s, selectionEnd: e } = anchorEl
    const before = content.slice(0, s)
    const selected = content.slice(s, e)
    const after = content.slice(e)
    const indented = selected
      .split("\n")
      .map((line) => "  " + line)
      .join("\n")
    onContentChange(before + indented + after)
    onDismiss()
  }, [anchorEl, content, onContentChange, onDismiss])

  if (!pos || !selectedText) return null

  const actions = [
    { icon: Copy, label: feedback === "Copied" ? "Copied!" : "Copy", onClick: handleCopy },
    { icon: Scissors, label: feedback === "Cut" ? "Cut!" : "Cut", onClick: handleCut },
    { icon: Clipboard, label: "Paste", onClick: handlePaste },
    { icon: AlignJustify, label: "Indent", onClick: handleIndent },
    { icon: Sparkles, label: "Ask AI", onClick: handleAskAI, accent: true },
  ]

  return (
    <div
      ref={popoverRef}
      role="toolbar"
      aria-label="Text selection actions"
      className={cn(
        "fixed z-50 flex items-center gap-0.5 p-1 rounded-xl",
        "bg-background/90 backdrop-blur-xl border border-border/60 shadow-xl",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      style={{
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
      }}
      // Prevent the textarea from losing focus/selection when clicking popover
      onMouseDown={(e) => e.preventDefault()}
    >
      {actions.map(({ icon: Icon, label, onClick, accent }) => (
        <button
          key={label}
          onClick={onClick}
          title={label}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
            "hover:bg-muted active:scale-95",
            accent
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}

      {/* Small caret arrow at bottom-centre */}
      <div
        aria-hidden
        className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-background/90 border-r border-b border-border/60 rotate-45"
      />
    </div>
  )
}
