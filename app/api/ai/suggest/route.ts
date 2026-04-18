import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createXai } from "@ai-sdk/xai"

/**
 * Resolve a model reference into an AI SDK model instance.
 *
 * - If `apiKey` is provided the user-supplied key is used to call the provider
 *   directly (bypassing the Vercel AI Gateway).
 * - If no key is supplied we fall through to the Vercel AI Gateway which
 *   handles auth automatically — the model string `"openai/gpt-4o-mini"` is
 *   passed straight through.
 */
function resolveModel(modelStr: string, apiKey: string | undefined) {
  // If no user key, let the Gateway handle it (model string pass-through)
  if (!apiKey) return modelStr as any

  // With a user key we must use the provider-specific SDK client
  const [provider, ...rest] = modelStr.split("/")
  const modelId = rest.join("/")

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId || "gpt-4o-mini")
    case "anthropic":
      return createAnthropic({ apiKey })(modelId || "claude-3-5-haiku-20241022")
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId || "gemini-2.0-flash")
    case "xai":
      return createXai({ apiKey })(modelId || "grok-3-mini")
    default:
      // Unknown provider — fall back to gateway
      return modelStr as any
  }
}

export async function POST(req: Request) {
  const { prompt, code, model, apiKey } = await req.json()

  if (!prompt || !code) {
    return Response.json({ error: "prompt and code are required" }, { status: 400 })
  }

  const selectedModel = model || "openai/gpt-4o-mini"
  const resolvedModel = resolveModel(selectedModel, apiKey || undefined)

  const systemPrompt = `You are an expert LaTeX editor specialising in professional resumes and academic documents.
Apply the user's requested change to the provided LaTeX code.
Return ONLY the modified LaTeX code — no explanations, no markdown code fences, no extra text.
Preserve document structure, indentation, and formatting conventions.
Only make the specific changes requested.`

  const userPrompt = `LaTeX code:\n${code}\n\nUser request: ${prompt}\n\nReturn only the modified LaTeX code.`

  try {
    const { text } = await generateText({
      model: resolvedModel,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4000,
      temperature: 0.3,
    })

    // Strip any accidental markdown code fences the model might add
    const cleaned = text
      .replace(/^```(?:latex|tex)?\n?/i, "")
      .replace(/\n?```$/, "")
      .trim()

    return Response.json({ suggestion: cleaned })
  } catch (err: any) {
    return Response.json({ error: err?.message || "AI request failed" }, { status: 500 })
  }
}
