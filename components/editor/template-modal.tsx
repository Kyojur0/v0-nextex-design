"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { X, FileText, Check } from "lucide-react"

const templates = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean and simple, perfect for tech roles",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Traditional format for corporate positions",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with elegant typography",
  },
  {
    id: "academic",
    name: "Academic",
    description: "Structured format for research positions",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Unique layout for design and creative roles",
  },
]

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (templateId: string) => void
}

export function TemplateModal({ isOpen, onClose, onSelect }: TemplateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">New from Template</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose a template to get started quickly
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Templates grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {templates.map((template) => (
              <button
                key={template.id}
                className={cn(
                  "flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                  selectedTemplate === template.id
                    ? "border-foreground bg-accent"
                    : "border-border hover:border-foreground/50 hover:bg-accent/50"
                )}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="w-full aspect-[8.5/11] bg-muted rounded-sm mb-3 flex items-center justify-center relative overflow-hidden">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  {/* Simulated template preview lines */}
                  <div className="absolute inset-4">
                    <div className="w-1/2 h-2 bg-foreground/10 rounded mx-auto mb-2" />
                    <div className="w-3/4 h-1 bg-foreground/5 rounded mx-auto mb-3" />
                    <div className="w-full h-px bg-foreground/10 mb-2" />
                    <div className="space-y-1">
                      <div className="w-full h-1 bg-foreground/5 rounded" />
                      <div className="w-5/6 h-1 bg-foreground/5 rounded" />
                      <div className="w-4/6 h-1 bg-foreground/5 rounded" />
                    </div>
                  </div>
                  {selectedTemplate === template.id && (
                    <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center">
                        <Check className="h-4 w-4 text-background" />
                      </div>
                    </div>
                  )}
                </div>
                <span className="font-medium text-sm">{template.name}</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {template.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selectedTemplate}
            onClick={() => {
              if (selectedTemplate) {
                onSelect(selectedTemplate)
                onClose()
              }
            }}
          >
            Create Document
          </Button>
        </div>
      </div>
    </div>
  )
}
