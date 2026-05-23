import { NextRequest } from 'next/server'
import { buildExtractionPrompt, type JsonSchema } from '@/lib/prompt-builder'
import { InvalidJsonResponseError, safeParseJson } from '@/lib/json-sanitizer'

type ParseRequestBody = {
  text: string
  schema: JsonSchema
  model?: string
  max_tokens?: number
}

type CloudflareAiResponse = {
  result?: { response?: string }
  success?: boolean
  errors?: unknown
}

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const DEFAULT_MAX_TOKENS = 1024

export async function POST(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    return Response.json(
      { error: 'Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN' },
      { status: 500 },
    )
  }

  let body: ParseRequestBody
  try {
    body = (await request.json()) as ParseRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, schema, model = DEFAULT_MODEL, max_tokens = DEFAULT_MAX_TOKENS } = body

  if (typeof text !== 'string' || text.length === 0) {
    return Response.json(
      { error: '`text` must be a non-empty string' },
      { status: 400 },
    )
  }

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return Response.json(
      { error: '`schema` must be a JSON Schema object' },
      { status: 400 },
    )
  }

  const messages = buildExtractionPrompt(text, schema)

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, max_tokens }),
  })

  const raw = await upstream.text()
  let data: CloudflareAiResponse
  try {
    data = JSON.parse(raw) as CloudflareAiResponse
  } catch {
    return Response.json(
      { error: 'Upstream returned non-JSON response', status: upstream.status, raw },
      { status: 502 },
    )
  }

  if (!upstream.ok) {
    return Response.json(
      { error: 'Cloudflare AI request failed', status: upstream.status, data },
      { status: upstream.status },
    )
  }

  const modelText = data.result?.response
  if (typeof modelText !== 'string') {
    return Response.json(
      { error: 'Cloudflare AI response missing `result.response` text', data },
      { status: 502 },
    )
  }

  try {
    const parsed = safeParseJson(modelText)
    return Response.json({ data: parsed })
  } catch (err) {
    if (err instanceof InvalidJsonResponseError) {
      return Response.json(
        { error: err.message, raw: err.raw },
        { status: 422 },
      )
    }
    throw err
  }
}
