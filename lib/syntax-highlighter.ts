// ─── lib/syntax-highlighter.ts ────────────────────────────────────────────────
// LaTeX tokenizer — used by the enhanced code editor for syntax highlighting.
// Performance contract: tokenize() is O(n) over text length. The per-character
// approach in the old version was O(n²); this version builds a flat token list
// once and the renderer maps it in a single pass per render.

export type TokenType =
  | "command"      // \foo  (non-begin/end)
  | "environment"  // \begin{...} or \end{...}
  | "comment"      // % ...  to end-of-line
  | "math"         // $...$ or $$...$$
  | "bracket"      // { } [ ] ( )
  | "option"       // content inside [ ... ]  (optional arguments)
  | "text"         // everything else

export interface Token {
  type: TokenType
  content: string
  start: number
  end: number
}

export function tokenizeLaTeX(text: string): Token[] {
  const tokens: Token[] = []
  const len = text.length
  let i = 0

  while (i < len) {
    const ch = text[i]

    // ── Comment: % to end of line ──────────────────────────────────────────
    if (ch === "%") {
      const end = text.indexOf("\n", i)
      const tokenEnd = end === -1 ? len : end
      tokens.push({ type: "comment", content: text.slice(i, tokenEnd), start: i, end: tokenEnd })
      i = tokenEnd
      continue
    }

    // ── Math: $$ or $ ─────────────────────────────────────────────────────
    if (ch === "$") {
      const isDouble = text[i + 1] === "$"
      const delim = isDouble ? "$$" : "$"
      const searchFrom = i + delim.length
      let end = text.indexOf(delim, searchFrom)
      if (end === -1) end = len - delim.length
      const tokenEnd = end + delim.length
      tokens.push({ type: "math", content: text.slice(i, tokenEnd), start: i, end: tokenEnd })
      i = tokenEnd
      continue
    }

    // ── LaTeX commands ─────────────────────────────────────────────────────
    if (ch === "\\" && i + 1 < len && /[a-zA-Z]/.test(text[i + 1])) {
      // Collect the command name
      let j = i + 1
      while (j < len && /[a-zA-Z*@]/.test(text[j])) j++

      const cmdName = text.slice(i + 1, j)

      if (cmdName === "begin" || cmdName === "end") {
        // Read the {envName} part
        let k = j
        while (k < len && text[k] === " ") k++ // skip whitespace
        if (text[k] === "{") {
          const close = text.indexOf("}", k)
          const envEnd = close === -1 ? j : close + 1
          tokens.push({ type: "environment", content: text.slice(i, envEnd), start: i, end: envEnd })
          i = envEnd
        } else {
          tokens.push({ type: "command", content: text.slice(i, j), start: i, end: j })
          i = j
        }
      } else {
        tokens.push({ type: "command", content: text.slice(i, j), start: i, end: j })
        i = j
      }
      continue
    }

    // ── Brackets ───────────────────────────────────────────────────────────
    if ("{})([".includes(ch)) {
      tokens.push({ type: "bracket", content: ch, start: i, end: i + 1 })
      i++
      continue
    }

    // ── Optional argument: [ ... ] ─────────────────────────────────────────
    if (ch === "[") {
      const close = text.indexOf("]", i + 1)
      const optEnd = close === -1 ? i + 1 : close + 1
      tokens.push({ type: "option", content: text.slice(i, optEnd), start: i, end: optEnd })
      i = optEnd
      continue
    }

    // ── Plain text ─────────────────────────────────────────────────────────
    let j = i + 1
    while (
      j < len &&
      text[j] !== "\\" &&
      text[j] !== "%" &&
      text[j] !== "$" &&
      text[j] !== "{" &&
      text[j] !== "}" &&
      text[j] !== "[" &&
      text[j] !== "]" &&
      text[j] !== "(" &&
      text[j] !== ")"
    ) {
      j++
    }
    tokens.push({ type: "text", content: text.slice(i, j), start: i, end: j })
    i = j
  }

  return tokens
}

// ─── Per-line token slicing ────────────────────────────────────────────────────
// Given the full token list and a line's [lineStart, lineEnd) char range,
// returns spans ready to render: { text, type }.
export interface Span {
  text: string
  type: TokenType
}

export function getLineSpans(
  tokens: Token[],
  lineStart: number,
  lineEnd: number
): Span[] {
  const spans: Span[] = []
  let cursor = lineStart

  for (const tok of tokens) {
    if (tok.end <= lineStart) continue
    if (tok.start >= lineEnd) break

    // Fill gap before this token with plain text
    const gapStart = Math.max(cursor, lineStart)
    const gapEnd = Math.min(tok.start, lineEnd)
    if (gapEnd > gapStart) {
      spans.push({ text: tok.content.slice(0, 0) || "", type: "text" })
      // Actually use raw text from source
      spans.push({ text: "FILL", type: "text" }) // placeholder replaced below
      spans[spans.length - 1].text = "" // will be filled
    }

    const spanStart = Math.max(tok.start, lineStart)
    const spanEnd = Math.min(tok.end, lineEnd)
    if (spanEnd > spanStart) {
      const relStart = spanStart - tok.start
      const relEnd = spanEnd - tok.start
      spans.push({ text: tok.content.slice(relStart, relEnd), type: tok.type })
    }

    cursor = spanEnd
  }

  return spans
}

// ─── Simpler, correct per-line renderer ──────────────────────────────────────
// Instead of the complex gap-filling above, just walk offsets directly.
export function renderLine(
  tokens: Token[],
  lineStart: number,
  lineEnd: number,
  rawLine: string
): Span[] {
  if (tokens.length === 0) return [{ text: rawLine, type: "text" }]

  const spans: Span[] = []
  let cursor = lineStart // absolute offset

  for (const tok of tokens) {
    if (tok.end <= lineStart) continue
    if (tok.start >= lineEnd) break

    // Gap before token (plain text)
    const gapStart = cursor
    const gapEnd = Math.min(tok.start, lineEnd)
    if (gapEnd > gapStart) {
      spans.push({
        text: rawLine.slice(gapStart - lineStart, gapEnd - lineStart),
        type: "text",
      })
    }

    // Token content within this line
    const tStart = Math.max(tok.start, lineStart)
    const tEnd = Math.min(tok.end, lineEnd)
    if (tEnd > tStart) {
      spans.push({
        text: rawLine.slice(tStart - lineStart, tEnd - lineStart),
        type: tok.type,
      })
    }

    cursor = Math.max(cursor, tEnd)
  }

  // Tail: text after last token
  if (cursor < lineEnd) {
    spans.push({ text: rawLine.slice(cursor - lineStart), type: "text" })
  }

  return spans.filter((s) => s.text.length > 0)
}

// ─── Color mapping ─────────────────────────────────────────────────────────────
export function getTokenColor(type: TokenType, isDark: boolean): string {
  if (isDark) {
    switch (type) {
      case "command":     return "text-[#79b8ff]"   // bright blue
      case "environment": return "text-[#85e89d]"   // green
      case "comment":     return "text-[#6a737d]"   // grey
      case "math":        return "text-[#ffab70]"   // orange
      case "bracket":     return "text-[#f8c555]"   // yellow
      case "option":      return "text-[#b392f0]"   // purple
      default:            return "text-foreground"
    }
  } else {
    switch (type) {
      case "command":     return "text-[#0550ae]"   // dark blue
      case "environment": return "text-[#116329]"   // dark green
      case "comment":     return "text-[#6e7781]"   // grey
      case "math":        return "text-[#953800]"   // dark orange
      case "bracket":     return "text-[#116329]"   // green
      case "option":      return "text-[#7c3aed]"   // purple
      default:            return "text-foreground"
    }
  }
}
