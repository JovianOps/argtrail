'use client'

import { ClipboardPaste, FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { parseProbeOutput } from '@/lib/argtrail/probes'
import { useArgTrail } from '@/lib/argtrail/store'
import type { ProbeResult } from '@/lib/argtrail/types'
import { NativeSelect, Panel } from './primitives'

interface Unmatched {
  key: string
  result: ProbeResult
  reason: string
}

export function ImportPanel() {
  const { state, dispatch } = useArgTrail()
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<{ tone: 'ok' | 'error'; text: string }[]>([])
  const [unmatched, setUnmatched] = useState<Unmatched[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = (input: string) => {
    const { results, errors } = parseProbeOutput(input)
    const nextMessages: { tone: 'ok' | 'error'; text: string }[] = errors.map((error) => ({ tone: 'error', text: error }))
    const nextUnmatched: Unmatched[] = []
    for (const result of results) {
      const run = result.runId ? state.runs.find((candidate) => candidate.id === result.runId) : undefined
      if (run) {
        dispatch({ type: 'attachResult', runId: run.id, result, matchedBy: 'run-id' })
        nextMessages.push({ tone: 'ok', text: `Matched run ${run.id} (${run.label}) — ${result.argc} argument(s) received.` })
      } else {
        nextUnmatched.push({
          key: `${result.runId ?? 'none'}-${nextUnmatched.length}-${Date.now()}`,
          result,
          reason: result.runId
            ? `Run id "${result.runId}" is not part of this session (it may come from an earlier session).`
            : 'The output has no run id — the probe was started without an ArgTrail command.',
        })
      }
    }
    setMessages(nextMessages)
    setUnmatched(nextUnmatched)
    if (results.length > 0 && errors.length === 0) setText('')
  }

  return (
    <Panel
      label="C"
      title="Import probe output"
      description="Paste the single JSON line the probe printed. Several lines from different runs can be pasted at once."
    >
      <label htmlFor="probe-output" className="sr-only">
        Probe output JSON
      </label>
      <textarea
        id="probe-output"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        spellCheck={false}
        placeholder='{"probe":"argtrail","probeVersion":"1.0.0","runId":"…","argv":[…]}'
        className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" disabled={!text.trim()} onClick={() => handleImport(text)}>
          <ClipboardPaste aria-hidden="true" />
          Import & compare
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <FileUp aria-hidden="true" />
          From file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,.log,application/json,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (file) handleImport(await file.text())
            event.target.value = ''
          }}
        />
      </div>

      {messages.length > 0 && (
        <ul className="flex flex-col gap-1" aria-live="polite">
          {messages.map((message, i) => (
            <li key={i} className={message.tone === 'ok' ? 'text-xs text-success' : 'text-xs text-destructive'}>
              {message.text}
            </li>
          ))}
        </ul>
      )}

      {unmatched.map((item) => (
        <UnmatchedResult
          key={item.key}
          item={item}
          onAttach={(runId) => {
            dispatch({ type: 'attachResult', runId, result: item.result, matchedBy: 'manual' })
            setUnmatched((current) => current.filter((candidate) => candidate.key !== item.key))
          }}
        />
      ))}
    </Panel>
  )
}

function UnmatchedResult({ item, onAttach }: { item: Unmatched; onAttach: (runId: string) => void }) {
  const { state } = useArgTrail()
  const [runId, setRunId] = useState(state.runs[0]?.id ?? '')
  const selectId = `attach-${item.key}`
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="text-xs font-medium text-primary">Output not linked to a run</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
      {state.runs.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Copy a command first to create a run, then attach this output to it.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <label htmlFor={selectId} className="sr-only">
            Attach to run
          </label>
          <NativeSelect id={selectId} className="h-7 w-auto flex-1 text-xs" value={runId} onChange={(event) => setRunId(event.target.value)}>
            {state.runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id} — {run.label} ({run.expected.length} args)
              </option>
            ))}
          </NativeSelect>
          <Button type="button" size="xs" disabled={!runId} onClick={() => onAttach(runId)}>
            Attach manually
          </Button>
        </div>
      )}
    </div>
  )
}
