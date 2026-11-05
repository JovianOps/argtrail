'use client'

import { AlertTriangle, Ban, Download, Eye, Info } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { downloadText } from '@/lib/argtrail/format'
import { buildLaunchPlan, type LaunchPlan } from '@/lib/argtrail/launch'
import { runIdFor, runStatus, useArgTrail } from '@/lib/argtrail/store'
import type { LaunchConfig, ProbeRun, RunSource } from '@/lib/argtrail/types'
import { CodeBlock, CopyButton, StatusBadge } from './primitives'
import { StageSequence } from './stage-sequence'

export function usePlannedRun({
  launch,
  expected,
  source,
}: {
  launch: LaunchConfig
  expected: string[]
  source: RunSource
}): { runId: string | null; plan: LaunchPlan | null; run: ProbeRun | undefined } {
  const { state, sessionPrefix } = useArgTrail()
  const runId = sessionPrefix ? runIdFor(sessionPrefix, { source, launch, expected }) : null
  const plan = useMemo(() => (runId ? buildLaunchPlan(launch, expected, runId) : null), [launch, expected, runId])
  const run = runId ? state.runs.find((candidate) => candidate.id === runId) : undefined
  return { runId, plan, run }
}

export function CommandPlan({
  launch,
  expected,
  source,
  label,
  caseIds,
  showStages = false,
}: {
  launch: LaunchConfig
  expected: string[]
  source: RunSource
  label: string
  caseIds?: string[]
  showStages?: boolean
}) {
  const { dispatch } = useArgTrail()
  const { runId, plan, run } = usePlannedRun({ launch, expected, source })

  if (!plan || !runId) {
    return <div className="h-24 animate-pulse rounded-lg border bg-muted/30" aria-label="Preparing command" />
  }

  const register = () => {
    if (run || !plan.command) return
    dispatch({
      type: 'addRuns',
      runs: [
        {
          id: runId,
          label,
          createdAt: Date.now(),
          source,
          launch,
          expected,
          caseIds,
          command: plan.command,
        },
      ],
    })
  }

  if (!plan.ok) {
    return (
      <div className="flex flex-col gap-3">
        <div role="alert" className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Ban className="size-4" aria-hidden="true" />
            ArgTrail will not generate this command
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            {plan.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Producing a command anyway would be misleading. Adjust the arguments or the launch path.
          </p>
        </div>
        {showStages && plan.stages.length > 0 && <StageSequence plan={plan} />}
      </div>
    )
  }

  const status = run ? runStatus(run) : 'awaiting'
  const command = plan.command ?? ''

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        <span className="font-mono text-[11px] text-muted-foreground">run {runId}</span>
        {run?.result && (
          <Button type="button" variant="ghost" size="xs" onClick={() => dispatch({ type: 'selectRun', id: runId, openWorkspace: true })}>
            <Eye aria-hidden="true" />
            View comparison
          </Button>
        )}
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-auto text-xs font-medium text-muted-foreground">Run this in {plan.stages[0]?.label}</span>
          <CopyButton text={command} label="Copy command" size="xs" variant="default" onCopy={register} />
          {plan.script && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => {
                register()
                downloadText(plan.script!.name, plan.script!.content, plan.script!.mime)
              }}
            >
              <Download aria-hidden="true" />
              {plan.script.name.endsWith('.ps1') ? '.ps1' : '.sh'}
            </Button>
          )}
        </div>
        <CodeBlock>{command}</CodeBlock>
        {plan.script && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Script alternative: <code className="font-mono">{plan.script.runHint}</code>
          </p>
        )}
        {!run && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Copying or downloading registers this run, so the probe output can be matched to it automatically.
          </p>
        )}
      </div>

      {plan.risks.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Predicted risks — documented behaviour, not yet measured
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            {plan.risks.map((risk, i) => (
              <li key={`${risk.message}-${i}`}>{risk.message}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.notes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {plan.notes.map((note) => (
            <li key={note} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              {note}
            </li>
          ))}
        </ul>
      )}

      {showStages && <StageSequence plan={plan} result={run?.result} />}
    </div>
  )
}
