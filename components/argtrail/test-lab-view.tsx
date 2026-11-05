'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { compareArgs, outcomeForExpected, type CaseOutcome } from '@/lib/argtrail/compare'
import { randomId } from '@/lib/argtrail/format'
import { SHELLS } from '@/lib/argtrail/shells'
import { launchFromEnv, runIdFor, useArgTrail } from '@/lib/argtrail/store'
import type { LaunchPath, TestSuite } from '@/lib/argtrail/types'
import { cn } from '@/lib/utils'
import { CommandPlan } from './command-plan'
import { EmptyState, inputClass, Literal, NativeSelect, Panel } from './primitives'

const OUTCOME_STYLE: Record<CaseOutcome, { label: string; className: string }> = {
  pass: { label: 'pass', className: 'bg-success/15 text-success' },
  changed: { label: 'changed', className: 'bg-destructive/15 text-destructive' },
  missing: { label: 'missing', className: 'bg-destructive/15 text-destructive' },
  awaiting: { label: 'not run', className: 'border border-dashed border-muted-foreground/40 text-muted-foreground' },
}

export function TestLabView() {
  const { state, dispatch } = useArgTrail()
  const [suiteId, setSuiteId] = useState(state.suites[0]?.id ?? '')
  const suite = state.suites.find((candidate) => candidate.id === suiteId) ?? state.suites[0]

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <CaseLibrary suite={suite} />
      <Panel
        title="Test suite matrix"
        description="Each suite is sent as one argument vector through every launch path. Every cell is a measured result or explicitly marked as not run."
        actions={
          <>
            <label htmlFor="suite-select" className="sr-only">Select suite</label>
            <NativeSelect id="suite-select" className="h-7 w-auto text-xs" value={suite?.id ?? ''} onChange={(event) => setSuiteId(event.target.value)}>
              {state.suites.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                const created: TestSuite = { id: `suite-${randomId(6)}`, name: 'New suite', caseIds: [] }
                dispatch({ type: 'addSuite', suite: created })
                setSuiteId(created.id)
              }}
            >
              <Plus aria-hidden="true" />
              Suite
            </Button>
          </>
        }
      >
        {suite ? <SuiteMatrix suite={suite} /> : <EmptyState title="No suites">Create a suite to group test values.</EmptyState>}
      </Panel>
    </div>
  )
}

function CaseLibrary({ suite }: { suite?: TestSuite }) {
  const { state, dispatch } = useArgTrail()
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')

  return (
    <Panel title="Test value library" description="Built-in tricky values plus your own. Tick values to include them in the selected suite.">
      <ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto pr-1">
        {state.cases.map((testCase) => {
          const checked = suite?.caseIds.includes(testCase.id) ?? false
          return (
            <li key={testCase.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40">
              <input
                id={`case-${testCase.id}`}
                type="checkbox"
                className="mt-1 size-3.5 accent-primary"
                checked={checked}
                disabled={!suite}
                onChange={() =>
                  suite &&
                  dispatch({
                    type: 'updateSuite',
                    suite: {
                      ...suite,
                      caseIds: checked ? suite.caseIds.filter((id) => id !== testCase.id) : [...suite.caseIds, testCase.id],
                    },
                  })
                }
              />
              <label htmlFor={`case-${testCase.id}`} className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-medium">{testCase.label}</span>
                <Literal value={testCase.value} muted />
                <span className="text-[11px] leading-relaxed text-muted-foreground">{testCase.note}</span>
              </label>
              {!testCase.builtIn && (
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Delete ${testCase.label}`} onClick={() => dispatch({ type: 'removeCase', id: testCase.id })}>
                  <Trash2 />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <form
        className="flex flex-col gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault()
          dispatch({ type: 'addCase', testCase: { id: `case-${randomId(6)}`, label: label.trim() || 'Custom value', value, note: 'Custom test value.', builtIn: false } })
          setLabel('')
          setValue('')
        }}
      >
        <span className="text-xs font-medium text-muted-foreground">Add custom value</span>
        <label htmlFor="new-case-label" className="sr-only">Label</label>
        <input id="new-case-label" className={inputClass} placeholder="Label" value={label} onChange={(event) => setLabel(event.target.value)} />
        <label htmlFor="new-case-value" className="sr-only">Value</label>
        <textarea
          id="new-case-value"
          rows={2}
          spellCheck={false}
          placeholder="Exact value (empty is allowed)"
          className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" size="sm" className="self-start">
          <Plus aria-hidden="true" />
          Add value
        </Button>
      </form>
    </Panel>
  )
}

function SuiteMatrix({ suite }: { suite: TestSuite }) {
  const { state, dispatch, sessionPrefix } = useArgTrail()
  const cases = suite.caseIds.map((id) => state.cases.find((testCase) => testCase.id === id)).filter((testCase) => testCase !== undefined)
  const expected = useMemo(() => cases.map((testCase) => testCase.value), [cases])
  const [activePath, setActivePath] = useState<string | null>(null)

  const columns = state.paths.map((path) => {
    const launch = launchFromEnv(state.env, { os: path.os, stages: path.stages })
    const source = { kind: 'suite' as const, suiteId: suite.id, pathId: path.id }
    const runId = sessionPrefix ? runIdFor(sessionPrefix, { source, launch, expected }) : null
    const run = runId ? state.runs.find((candidate) => candidate.id === runId) : undefined
    const comparison = run?.result ? compareArgs(expected, run.result.argv) : null
    return { path, launch, source, comparison }
  })
  const active = columns.find((column) => column.path.id === activePath)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="suite-name" className="text-xs text-muted-foreground">Suite name</label>
        <div className="flex gap-1.5">
          <input id="suite-name" className={inputClass} value={suite.name} onChange={(event) => dispatch({ type: 'updateSuite', suite: { ...suite, name: event.target.value } })} />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete suite" onClick={() => dispatch({ type: 'removeSuite', id: suite.id })}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {cases.length === 0 || state.paths.length === 0 ? (
        <EmptyState title={cases.length === 0 ? 'This suite has no values' : 'No launch paths'}>
          {cases.length === 0 ? 'Tick values in the library to add them.' : 'Add a launch path in the Launch paths tab.'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium text-muted-foreground">Value</th>
                {columns.map(({ path, comparison }) => (
                  <th key={path.id} scope="col" className="px-2 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => setActivePath(activePath === path.id ? null : path.id)}
                      aria-pressed={activePath === path.id}
                      className={cn('flex flex-col items-start rounded px-1 py-0.5 text-left hover:bg-muted', activePath === path.id && 'bg-primary/15 text-primary')}
                    >
                      <span className="whitespace-nowrap">{path.stages.map((id) => SHELLS[id].short).join(' → ')}</span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {comparison ? `${comparison.matches}/${expected.length} pass${comparison.unexpected ? ` · +${comparison.unexpected} extra` : ''}` : 'get command'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((testCase, index) => (
                <tr key={testCase.id} className="border-t">
                  <th scope="row" className="max-w-48 px-2 py-1.5 font-normal">
                    <span className="block text-xs">{testCase.label}</span>
                    <Literal value={testCase.value} muted className="text-[10px]" />
                  </th>
                  {columns.map(({ path, comparison }) => {
                    const outcome = outcomeForExpected(comparison, index)
                    const style = OUTCOME_STYLE[outcome]
                    return (
                      <td key={path.id} className="px-2 py-1.5">
                        <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium', style.className)}>{style.label}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && cases.length > 0 && <SuitePathCommand path={active.path} launch={active.launch} source={active.source} suite={suite} expected={expected} />}
      {!active && cases.length > 0 && state.paths.length > 0 && (
        <p className="text-xs text-muted-foreground">Select a path column to get its command. Results appear here after you import the probe output.</p>
      )}
    </div>
  )
}

function SuitePathCommand({
  path,
  launch,
  source,
  suite,
  expected,
}: {
  path: LaunchPath
  launch: ReturnType<typeof launchFromEnv>
  source: { kind: 'suite'; suiteId: string; pathId: string }
  suite: TestSuite
  expected: string[]
}) {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <p className="mb-3 text-sm font-medium">
        {suite.name} via {path.name}
      </p>
      <CommandPlan launch={launch} expected={expected} source={source} label={`${suite.name} · ${path.name}`} caseIds={suite.caseIds} />
    </div>
  )
}
