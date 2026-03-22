// ─── lib/api-mode.ts ──────────────────────────────────────────────────────────
// Single switch point between mock and real backend.
//
// TO GO LIVE: replace `mockApi` with your real REST client that implements
// the same interface. lib/api.ts and all components never need to change.
//
// Usage inside lib/api.ts only:  impl().fetchFileTree() etc.

import { mockApi, type MockApi } from "@/lib/mock-api"

// The API_MODE env var is checked at runtime so you can override via
// NEXT_PUBLIC_API_MODE=real in production without touching source.
// For now, this repo is always "mock".
const mode =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_MODE ?? "mock")
    : "mock"

// Real client would be imported here and returned when mode === "real"
// import { realApi } from "@/lib/real-api"

/** Returns the active API implementation. */
export function impl(): MockApi {
  if (mode === "real") {
    // Placeholder: swap mockApi for realApi once a backend exists.
    // return realApi
    throw new Error(
      "NEXT_PUBLIC_API_MODE=real but no real API client is configured yet."
    )
  }
  return mockApi
}
