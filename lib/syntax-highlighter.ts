// ─── lib/syntax-highlighter.ts ────────────────────────────────────────────────
// LaTeX tokenizer — used by the enhanced code editor for syntax highlighting.
// Performance contract: tokenizeLaTeX() is O(n) over text length.

export type TokenType =
  | "command"      // \foo  (non-begin/end)
  | "environment"  // \begin{...} or \end{...}
  | "comment"      // % ...  to end-of-line
  | "math"         // $...$ or $$...$$
  | "bracket"      // { } ) (  ]
  | "option"       // [ ... ]  (optional argument, including brackets)
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
      let j = i + 1
      while (j < len && /[a-zA-Z*@]/.test(text[j])) j++
      const cmdName = text.slice(i + 1, j)

      if (cmdName === "begin" || cmdName === "end") {
        let k = j
        while (k < len && text[k] === " ") k++
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

    // ── Optional argument: [ ... ] ────────────────────────────────────────
    // Handle [ before generic brackets so [ ] are consumed together as one token.
    if (ch === "[") {
      const close = text.indexOf("]", i + 1)
      const optEnd = close === -1 ? i + 1 : close + 1
      tokens.push({ type: "option", content: text.slice(i, optEnd), start: i, end: optEnd })
      i = optEnd
      continue
    }

    // ── Single-char brackets: { } ( ) ─────────────────────────────────────
    // Note: [ and ] are consumed above as part of an option token.
    if ("{}()".includes(ch)) {
      tokens.push({ type: "bracket", content: ch, start: i, end: i + 1 })
      i++
      continue
    }

    // ── Plain text: run until the next special character ───────────────────
    let j = i + 1
    while (
      j < len &&
      text[j] !== "\\" &&
      text[j] !== "%" &&
      text[j] !== "$" &&
      text[j] !== "{" &&
      text[j] !== "}" &&
      text[j] !== "[" &&
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

// ─── Per-line renderer ────────────────────────────────────────────────────────
// Given the full token list and a line's [lineStart, lineEnd) char range,
// returns spans ready to render: { text, type }.
export interface Span {
  text: string
  type: TokenType
}

export function renderLine(
  tokens: Token[],
  lineStart: number,
  lineEnd: number,
  rawLine: string
): Span[] {
  if (tokens.length === 0 || lineStart === lineEnd) {
    return rawLine.length > 0 ? [{ text: rawLine, type: "text" }] : []
  }

  const spans: Span[] = []
  let cursor = lineStart // absolute char offset

  for (const tok of tokens) {
    // Skip tokens that end before this line starts
    if (tok.end <= lineStart) continue
    // Stop once we've passed this line
    if (tok.start >= lineEnd) break

    // Gap before this token — emit as plain text
    const gapStart = cursor
    const gapEnd = Math.min(tok.start, lineEnd)
    if (gapEnd > gapStart) {
      spans.push({
        text: rawLine.slice(gapStart - lineStart, gapEnd - lineStart),
        type: "text",
      })
    }

    // Token content clipped to this line
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

  // Trailing plain text after the last token
  if (cursor < lineEnd) {
    spans.push({ text: rawLine.slice(cursor - lineStart), type: "text" })
  }

  return spans.filter((s) => s.text.length > 0)
}

// ─── Color mapping ─────────────────────────────────────────────────────────────
export function getTokenColor(type: TokenType, isDark: boolean): string {
  if (isDark) {
    switch (type) {
      case "command":     return "text-[#79b8ff]"
      case "environment": return "text-[#85e89d]"
      case "comment":     return "text-[#6a737d]"
      case "math":        return "text-[#ffab70]"
      case "bracket":     return "text-[#f8c555]"
      case "option":      return "text-[#b392f0]"
      default:            return "text-foreground"
    }
  } else {
    switch (type) {
      case "command":     return "text-[#0550ae]"
      case "environment": return "text-[#116329]"
      case "comment":     return "text-[#6e7781]"
      case "math":        return "text-[#953800]"
      case "bracket":     return "text-[#116329]"
      case "option":      return "text-[#7c3aed]"
      default:            return "text-foreground"
    }
  }
}
