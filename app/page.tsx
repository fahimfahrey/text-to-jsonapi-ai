'use client'

import { useState } from 'react'

const SCHEMA_PLACEHOLDER = `{
  "type": "object",
  "properties": {
    "name":  { "type": "string" },
    "email": { "type": "string" },
    "role":  { "type": "string" }
  },
  "required": ["name", "email"]
}`

const TEXT_PLACEHOLDER =
  'Paste an email, a memo, a meeting transcript, a job posting, an invoice — anything with structure waiting to be discovered.'

type ParseResult =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: unknown }
  | { kind: 'err'; message: string; raw?: string }

export default function Home() {
  const [text, setText] = useState('')
  const [schema, setSchema] = useState(SCHEMA_PLACEHOLDER)
  const [result, setResult] = useState<ParseResult>({ kind: 'idle' })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let parsedSchema: unknown
    try {
      parsedSchema = JSON.parse(schema)
    } catch (err) {
      setResult({
        kind: 'err',
        message: `Schema is not valid JSON — ${(err as Error).message}`,
      })
      return
    }

    setResult({ kind: 'loading' })

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, schema: parsedSchema }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setResult({
          kind: 'err',
          message: payload?.error ?? `Request failed (${res.status})`,
          raw: payload?.raw,
        })
        return
      }
      setResult({ kind: 'ok', data: payload.data })
    } catch (err) {
      setResult({ kind: 'err', message: (err as Error).message })
    }
  }

  const disabled = result.kind === 'loading' || text.trim().length === 0

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#ededed] font-[family-name:var(--font-geist-sans)] selection:bg-[#d4ff3a] selection:text-black">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.035] mix-blend-screen"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 4px)',
        }}
      />

      <header className="relative border-b border-[#1f1f1f]">
        <div className="grid grid-cols-12 items-end gap-6 px-6 pt-10 pb-6 md:px-10">
          <div className="col-span-12 md:col-span-6">
            <p className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.35em] text-[#666]">
              t2j / v0.1 — text-to-json
            </p>
            <h1 className="mt-3 text-5xl font-light leading-none tracking-tight md:text-7xl">
              text<span className="text-[#d4ff3a]">→</span>json
            </h1>
          </div>
          <div className="col-span-12 md:col-span-6 md:text-right">
            <p className="font-[family-name:var(--font-geist-mono)] text-xs leading-relaxed text-[#888] md:max-w-sm md:ml-auto">
              Feed raw text. Define a schema. Receive structured JSON,
              extracted by a small language model on the edge.
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={onSubmit} className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <Panel
            index="01"
            label="Unstructured Text"
            hint="paste anything — emails, memos, transcripts"
            border="lg:border-r"
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={TEXT_PLACEHOLDER}
              spellCheck={false}
              className="w-full h-[44vh] lg:h-[58vh] resize-none bg-transparent text-[15px] leading-[1.7] text-[#ededed] placeholder:text-[#3a3a3a] outline-none"
            />
          </Panel>

          <Panel
            index="02"
            label="JSON Schema"
            hint="describes the shape you want back"
          >
            <textarea
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              spellCheck={false}
              className="w-full h-[44vh] lg:h-[58vh] resize-none bg-transparent font-[family-name:var(--font-geist-mono)] text-[13px] leading-[1.7] text-[#d4ff3a]/90 placeholder:text-[#3a3a3a] outline-none"
            />
          </Panel>
        </div>

        <div className="border-t border-[#1f1f1f]">
          <div className="grid grid-cols-12 items-stretch">
            <div className="col-span-12 md:col-span-7 px-6 md:px-10 py-6 border-b md:border-b-0 md:border-r border-[#1f1f1f]">
              <p className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.35em] text-[#666]">
                03 / output
              </p>
              <div className="mt-3 min-h-[3rem]">
                <Output result={result} />
              </div>
            </div>

            <button
              type="submit"
              disabled={disabled}
              className="col-span-12 md:col-span-5 relative bg-[#d4ff3a] text-black font-[family-name:var(--font-geist-mono)] text-sm uppercase tracking-[0.3em] enabled:hover:bg-[#c1ec1e] disabled:bg-[#1a1a1a] disabled:text-[#444] disabled:cursor-not-allowed transition-colors min-h-[5.5rem] flex items-center justify-center"
            >
              <span className="flex items-center gap-3">
                {result.kind === 'loading' ? (
                  <>
                    <Spinner />
                    extracting…
                  </>
                ) : (
                  <>
                    <span>extract</span>
                    <span aria-hidden className="text-lg">→</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </form>

      <footer className="border-t border-[#1f1f1f] px-6 md:px-10 py-5 flex items-center justify-between font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.35em] text-[#444]">
        <span>edge · cloudflare workers ai</span>
        <span>llama-3.1-8b-instruct</span>
      </footer>
    </main>
  )
}

function Panel({
  index,
  label,
  hint,
  border = '',
  children,
}: {
  index: string
  label: string
  hint: string
  border?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={`relative px-6 md:px-10 py-8 border-t border-[#1f1f1f] ${border}`}
    >
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-baseline gap-4">
          <span className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.35em] text-[#d4ff3a]">
            {index}
          </span>
          <h2 className="text-lg tracking-tight">{label}</h2>
        </div>
        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.2em] text-[#555]">
          {hint}
        </span>
      </div>
      {children}
    </section>
  )
}

function Output({ result }: { result: ParseResult }) {
  if (result.kind === 'idle') {
    return (
      <p className="font-[family-name:var(--font-geist-mono)] text-xs text-[#555]">
        awaiting input — press extract to run.
      </p>
    )
  }
  if (result.kind === 'loading') {
    return (
      <p className="font-[family-name:var(--font-geist-mono)] text-xs text-[#888] flex items-center gap-2">
        <Spinner /> contacting edge model…
      </p>
    )
  }
  if (result.kind === 'err') {
    return (
      <div className="space-y-2">
        <p className="font-[family-name:var(--font-geist-mono)] text-xs text-[#ff6b6b]">
          error · {result.message}
        </p>
        {result.raw && (
          <pre className="font-[family-name:var(--font-geist-mono)] text-[11px] leading-[1.6] text-[#666] whitespace-pre-wrap break-words max-h-40 overflow-auto border-l border-[#2a2a2a] pl-3">
            {result.raw}
          </pre>
        )}
      </div>
    )
  }
  return (
    <pre className="font-[family-name:var(--font-geist-mono)] text-[12px] leading-[1.7] text-[#d4ff3a] whitespace-pre-wrap break-words max-h-64 overflow-auto">
      {JSON.stringify(result.data, null, 2)}
    </pre>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"
    />
  )
}
