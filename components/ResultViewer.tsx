'use client'

import { useState, useMemo } from 'react'

type ResultViewerProps = {
  outputData: unknown
  className?: string
}

export default function ResultViewer({ outputData, className = '' }: ResultViewerProps) {
  const [copied, setCopied] = useState(false)

  const jsonString = useMemo(() => {
    if (outputData === null || outputData === undefined) return ''
    try {
      return JSON.stringify(outputData, null, 2)
    } catch {
      return String(outputData)
    }
  }, [outputData])

  const highlighted = useMemo(() => highlightJson(jsonString), [jsonString])

  if (outputData === null || outputData === undefined) return null

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy JSON to clipboard'}
        className={`absolute top-3 right-3 z-10 px-3 py-1.5 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.25em] border transition-colors ${
          copied
            ? 'bg-[#d4ff3a] text-black border-[#d4ff3a]'
            : 'bg-[#0a0a0a] text-[#888] border-[#2a2a2a] hover:text-[#ededed] hover:border-[#4a4a4a]'
        }`}
      >
        {copied ? 'copied!' : 'copy'}
      </button>

      <pre
        className="font-[family-name:var(--font-geist-mono)] text-[12px] leading-[1.7] bg-[#0d0d0d] border border-[#1f1f1f] p-4 pr-20 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words"
        aria-label="Structured JSON output"
      >
        <code
          className="text-[#ededed]"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightJson(src: string): string {
  if (!src) return ''
  const escaped = escapeHtml(src)
  const tokenRe =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

  return escaped.replace(tokenRe, (match, key, str, kw, num) => {
    if (key) return `<span style="color:#d4ff3a">${key}</span>`
    if (str) return `<span style="color:#a5e3ff">${str}</span>`
    if (kw) return `<span style="color:#ff9d6b">${kw}</span>`
    if (num) return `<span style="color:#ffd86b">${num}</span>`
    return match
  })
}
