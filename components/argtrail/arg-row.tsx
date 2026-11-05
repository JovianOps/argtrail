'use client'

import { ArrowDown, ArrowUp, Braces, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { describeTraits } from '@/lib/argtrail/format'
import type { ArgRow } from '@/lib/argtrail/types'
import { cn } from '@/lib/utils'

/** Textareas normalize CR/CRLF to LF and cannot hold NUL, so such values are only editable as escapes. */
const TEXTAREA_UNSAFE = /[\r\0]/

function toEscaped(value: string) {
  return JSON.stringify(value).slice(1, -1)
}

export function ArgRowEditor({
  row,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  row: ArgRow
  index: number
  total: number
  onChange: (value: string) => void
  onRemove: () => void
  onMove: (offset: number) => void
}) {
  const forcedEscape = TEXTAREA_UNSAFE.test(row.value)
  const [escapeMode, setEscapeMode] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const useEscape = escapeMode || forcedEscape
  const inputId = `arg-${row.id}`
  const traits = describeTraits(row.value)

  return (
    <li className="group flex gap-2 rounded-lg border bg-background/60 p-2 focus-within:border-primary/50">
      <span
        className="mt-1 flex h-6 min-w-6 items-center justify-center rounded bg-muted px-1 font-mono text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        {index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={inputId} className="sr-only">
          Argument {index}
        </label>
        {useEscape ? (
          <input
            id={inputId}
            value={draft ?? toEscaped(row.value)}
            spellCheck={false}
            onChange={(event) => {
              const text = event.target.value
              setDraft(text)
              try {
                const parsed = JSON.parse(`"${text}"`)
                if (typeof parsed !== 'string') throw new Error()
                setError(null)
                onChange(parsed)
              } catch {
                setError('Invalid escape sequence — value not updated. Use \\n, \\r, \\t, \\", \\\\ or \\uXXXX.')
              }
            }}
            onBlur={() => {
              setDraft(null)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="h-7 w-full min-w-0 rounded border border-input bg-card px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
          />
        ) : (
          <textarea
            id={inputId}
            value={row.value}
            rows={1}
            spellCheck={false}
            placeholder="(empty string)"
            onChange={(event) => onChange(event.target.value)}
            className="field-sizing-content max-h-40 min-h-7 w-full min-w-0 resize-none rounded border border-input bg-card px-2 py-1 font-mono text-xs leading-relaxed outline-none placeholder:text-muted-foreground/50 placeholder:italic focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-[11px] text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {traits.map((trait) => (
            <span key={trait} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {trait}
            </span>
          ))}
          <span className="font-mono text-[10px] text-muted-foreground/70">{Array.from(row.value).length} chars</span>
          {forcedEscape && <span className="text-[10px] text-primary">contains CR/NUL — escape mode required</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row sm:items-start">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={useEscape ? `Edit argument ${index} as raw text` : `Edit argument ${index} as escape sequences`}
          aria-pressed={useEscape}
          disabled={forcedEscape}
          onClick={() => setEscapeMode((value) => !value)}
          className={cn(useEscape && 'text-primary')}
        >
          <Braces />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move argument ${index} up`} disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Move argument ${index} down`}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove argument ${index}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
