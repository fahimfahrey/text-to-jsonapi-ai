import { NextRequest } from 'next/server'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type AiRequestBody = {
  messages: ChatMessage[]
  model?: string
  max_tokens?: number
}

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const DEFAULT_MAX_TOKENS = 512

export async function POST(request: NextRequest) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    return Response.json(
      { error: 'Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN' },
      { status: 500 },
    )
  }

  let body: AiRequestBody
  try {
    body = (await request.json()) as AiRequestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { messages, model = DEFAULT_MODEL, max_tokens = DEFAULT_MAX_TOKENS } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: '`messages` must be a non-empty array' },
      { status: 400 },
    )
  }

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
  let data: unknown
  try {
    data = JSON.parse(raw)
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

  return Response.json(data)
}
