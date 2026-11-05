'use client'

import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { compareArgs, type DiffOp } from '@/lib/argtrail/compare'
import { explainMismatch } from '@/lib/argtrail/explain'
import { codePoints, firstDifference, formatTime } from '@/lib/argtrail/format'
import { runStatus, useArgTrail } from '@/lib/argtrail/store'
import type { ProbeRun } from '@/lib/argtrail/types'
import { cn } from '@/lib/utils'
import { EmptyState, Literal, NativeSelect, Panel, StatusBadge } from './primitives'

export function ResultsPanel() {
  const { state, dispatch } = useArgTrail()
  const measured = state.runs.filter((run) => run.result)
  const selected =
    state.runs.find((run) => run.id === state.selectedRunId && run.result) ?? measured[0]

  return (
    <Panel
      label="D"
      title="Verified comparison"
      description="Only probe output counts as evidence. Comparison is exact: no trimming, case folding or Unicode normalization."
      actions={
        measured.length > 1 && selected ? (
          <>
            <label htmlFor="result-run" className="sr-only">
              Select run
            </label>
            <NativeSelect
              id="result-run"
              className="h-7 w-auto max-w-64 text-xs"
              value={selected.id}
              onChange={(event) => dispatch({ type: 'selectRun', id: event.target.value })}
            >
              {measured.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.label} · {run.id}
                </option>
              ))}
            </NativeSelect>
          </>
        ) : undefined
      }
    >
      {selected ? (
        <RunComparison run={selected} />
      ) : (
        <EmptyState title="No measurement yet">
          Copy the command from panel B, run it locally next to the probe file, then paste the JSON line into panel C. Until then,
          everything ArgTrail shows is a prediction.
        </EmptyState>
      )}
    </Panel>
  )
}

function RunComparison({ run }: { run: ProbeRun }) {
  const result = run.result!
  const comparison = useMemo(() => compareArgs(run.expected, result.argv), [run.expected, result.argv])
  const [view, setView] = useState<'diff' | 'index'>('diff')
  const status = runStatus(run)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        <span className="text-xs text-muted-foreground">
          {run.label} · run <span className="font-mono">{run.id}</span> · imported {run.importedAt ? formatTime(run.importedAt) : ''}
          {run.matchedBy === 'manual' && ' · attached manually'}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Expected argc" value={comparison.expectedCount} />
        <Stat label="Received argc" value={comparison.actualCount} tone={comparison.actualCount === comparison.expectedCount ? undefined : 'bad'} />
        <Stat label="Exact matches" value={`${comparison.matches}/${comparison.expectedCount}`} tone={comparison.identical ? 'good' : undefined} />
        <Stat label="Changed / missing / extra" value={`${comparison.changed} / ${comparison.missing} / ${comparison.unexpected}`} tone={comparison.identical ? undefined : 'bad'} />
      </dl>

      <p className="text-[11px] text-muted-foreground">
        Probe {result.probeVersion} · {result.runtime.name} {result.runtime.version} · {result.platform.os}
        {result.platform.release ? ` ${result.platform.release}` : ''}
        {result.platform.arch ? ` (${result.platform.arch})` : ''}
        {result.executable && (
          <>
            {' '}· <span className="font-mono">{result.executable}</span>
          </>
        )}
      </p>

      <div className="flex gap-1 rounded-lg border p-0.5 self-start" role="tablist" aria-label="Comparison view">
        {(['diff', 'index'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs',
              view === id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {id === 'diff' ? 'Aligned diff' : 'Index by index'}
          </button>
        ))}
      </div>

      {view === 'diff' ? (
        <ol className="flex flex-col gap-1.5" aria-label="Aligned argument diff">
          {comparison.ops.map((op, i) => (
            <DiffRow key={i} op={op} run={run} />
          ))}
          {comparison.ops.length === 0 && <li className="text-xs text-muted-foreground">Both argument vectors are empty.</li>}
        </ol>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-medium">#</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Expected</th>
                <th scope="col" className="px-2 py-1.5 font-medium">Received</th>
                <th scope="col" className="px-2 py-1.5 font-medium">
                  <span className="sr-only">Equal</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.indexRows.map((row) => (
                <tr key={row.index} className="border-t align-top">
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.index}</td>
                  <td className="px-2 py-1.5"><Literal value={row.expected} /></td>
                  <td className="px-2 py-1.5"><Literal value={row.actual} /></td>
                  <td className="px-2 py-1.5">
                    <span className={row.equal ? 'text-success' : 'text-destructive'}>{row.equal ? 'equal' : 'differs'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('font-mono text-sm', tone === 'good' && 'text-success', tone === 'bad' && 'text-destructive')}>{value}</dd>
    </div>
  )
}

const OP_STYLES = {
  match: { label: 'match', className: 'border-border', badge: 'text-success' },
  changed: { label: 'changed', className: 'border-destructive/40 bg-destructive/5', badge: 'text-destructive' },
  missing: { label: 'missing', className: 'border-destructive/40 bg-destructive/5', badge: 'text-destructive' },
  unexpected: { label: 'extra', className: 'border-primary/40 bg-primary/5', badge: 'text-primary' },
}

function DiffRow({ op, run }: { op: DiffOp; run: ProbeRun }) {
  const actualAll = run.result!.argv
  const expected = 'e' in op ? run.expected[op.e] : undefined
  const actual = 'a' in op ? actualAll[op.a] : undefined
  const style = OP_STYLES[op.type]
  const [open, setOpen] = useState(op.type !== 'match')

  if (op.type === 'match') {
    return (
      <li className={cn('flex items-start gap-2 rounded-lg border px-3 py-2', style.className)}>
        <IndexTag e={op.e} a={op.a} />
        <Literal value={expected} className="flex-1" />
        <span className={cn('text-[11px] font-medium', style.badge)}>{style.label}</span>
      </li>
    )
  }

  const hints = explainMismatch({
    type: op.type,
    expected,
    actual,
    actualAll,
    actualIndex: 'a' in op ? op.a : undefined,
    launch: run.launch,
  })

  return (
    <li className={cn('rounded-lg border', style.className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-3 py-2 text-left"
      >
        <IndexTag e={'e' in op ? op.e : undefined} a={'a' in op ? op.a : undefined} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex gap-2">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">expected</span>
            <Literal value={expected} />
          </span>
          <span className="flex gap-2">
            <span className="w-14 shrink-0 text-[11px] text-muted-foreground">received</span>
            <Literal value={actual} />
          </span>
        </div>
        <span className={cn('text-[11px] font-medium', style.badge)}>{style.label}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t px-3 py-3">
          {op.type === 'changed' && expected !== undefined && actual !== undefined && (
            <CodePointDiff expected={expected} actual={actual} />
          )}
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Likely causes (heuristic — the measurement above is the fact)</p>
            <ul className="flex flex-col gap-2">
              {hints.map((hint) => (
                <li key={hint.title} className="rounded-md bg-background/60 p-2">
                  <p className="text-xs font-medium">{hint.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint.detail}</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    <span className="text-primary">Fix: </span>
                    {hint.fix}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  )
}

function IndexTag({ e, a }: { e?: number; a?: number }) {
  return (
    <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 font-mono text-[10px] text-muted-foreground" title="expected index → received index">
      {e ?? '–'}→{a ?? '–'}
    </span>
  )
}

function CodePointDiff({ expected, actual }: { expected: string; actual: string }) {
  const first = firstDifference(expected, actual)
  const left = codePoints(expected)
  const right = codePoints(actual)
  const from = Math.max(0, first - 4)
  const render = (points: ReturnType<typeof codePoints>) =>
    points.slice(from, from + 16).map((point, i) => {
      const index = from + i
      return (
        <span
          key={index}
          className={cn(
            'inline-flex flex-col items-center rounded px-1 py-0.5 font-mono',
            index >= first ? 'bg-destructive/15 text-destructive' : 'bg-muted/60',
          )}
        >
          <span className="text-xs">{JSON.stringify(point.char).slice(1, -1) || ' '}</span>
          <span className="text-[9px] text-muted-foreground">{point.hex}</span>
        </span>
      )
    })
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] text-muted-foreground">
        First difference at character {first} (expected {left.length} chars, received {right.length})
      </p>
      <div className="flex flex-wrap gap-0.5" aria-label="Expected code points">{render(left)}</div>
      <div className="flex flex-wrap gap-0.5" aria-label="Received code points">{render(right)}</div>
    </div>
  )
}
