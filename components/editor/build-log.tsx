"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { X, ChevronDown, ChevronUp, AlertCircle, CheckCircle, XCircle } from "lucide-react"

interface LogEntry {
  type: "info" | "warning" | "error" | "success"
  message: string
  line?: number
  timestamp: string
}

interface BuildLogProps {
  logs: LogEntry[]
  isVisible: boolean
  onClose: () => void
  onToggle: () => void
  onGoToLine: (line: number) => void
}

export function BuildLog({
  logs,
  isVisible,
  onClose,
  onToggle,
  onGoToLine,
}: BuildLogProps) {
  const errorCount = logs.filter((l) => l.type === "error").length
  const warningCount = logs.filter((l) => l.type === "warning").length
  const hasErrors = errorCount > 0

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          "h-7 flex items-center gap-2 px-3 border-t border-border bg-background text-xs",
          hasErrors ? "text-destructive" : "text-muted-foreground"
        )}
      >
        <ChevronUp className="h-3.5 w-3.5" />
        Build Log
        {errorCount > 0 && (
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-[var(--warning)]">
            <AlertCircle className="h-3 w-3" />
            {warningCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="border-t border-border bg-background">
      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium">Build Log</span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3 w-3" />
                {errorCount} errors
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-[var(--warning)]">
                <AlertCircle className="h-3 w-3" />
                {warningCount} warnings
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={onToggle}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <div className="h-32 overflow-y-auto scrollbar-thin p-2 font-mono text-xs">
        {logs.map((log, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 py-1 px-2 rounded hover:bg-accent/50 cursor-pointer",
              log.type === "error" && "text-destructive",
              log.type === "warning" && "text-[var(--warning)]",
              log.type === "success" && "text-[var(--success)]"
            )}
            onClick={() => log.line && onGoToLine(log.line)}
          >
            {log.type === "error" && <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
            {log.type === "warning" && <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
            {log.type === "success" && <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
            {log.type === "info" && <span className="w-3.5 shrink-0" />}
            <span className="text-muted-foreground shrink-0">[{log.timestamp}]</span>
            {log.line && (
              <span className="text-muted-foreground shrink-0">Line {log.line}:</span>
            )}
            <span className="break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
