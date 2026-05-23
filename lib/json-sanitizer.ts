export class InvalidJsonResponseError extends Error {
  readonly name = 'InvalidJsonResponseError'
  readonly raw: string
  readonly cause?: unknown

  constructor(message: string, raw: string, cause?: unknown) {
    super(message)
    this.raw = raw
    this.cause = cause
  }
}

const FENCE_PATTERN = /^\s*```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```\s*$/

export function extractJson(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(FENCE_PATTERN)
  return (match ? match[1] : trimmed).trim()
}

export function safeParseJson<T = unknown>(text: string): T {
  const cleaned = extractJson(text)
  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    throw new InvalidJsonResponseError(
      `Model returned invalid JSON: ${(err as Error).message}`,
      text,
      err,
    )
  }
}
