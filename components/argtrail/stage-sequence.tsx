import { ArrowDown, CircleHelp, ShieldCheck, Terminal } from 'lucide-react'
import type { LaunchPlan } from '@/lib/argtrail/launch'
import type { ProbeResult } from '@/lib/argtrail/types'
import { CodeBlock } from './primitives'

export function StageChips({ labels, target }: { labels: string[]; target: string }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px]" aria-label="Launch path">
      {labels.map((label, i) => (
        <li key={`${label}-${i}`} className="flex items-center gap-1">
          <span className="rounded border bg-background px-1.5 py-0.5 font-mono">{label}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
        </li>
      ))}
      <li>
        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-primary">{target}</span>
      </li>
    </ol>
  )
}

export function StageSequence({ plan, result }: { plan: LaunchPlan; result?: ProbeResult }) {
  return (
    <ol className="flex flex-col" aria-label="Launch stages">
      {plan.stages.map((stage, i) => (
        <li key={`${stage.shell}-${i}`} className="flex flex-col">
          <div className="rounded-lg border bg-background/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded bg-muted font-mono text-[11px]">{i + 1}</span>
              <Terminal className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <h4 className="text-sm font-medium">{stage.label}</h4>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{stage.transport}</p>
            <p className="mt-3 mb-1 text-[11px] font-medium text-muted-foreground">Command this shell parses</p>
            <CodeBlock className="max-h-40">{stage.receives}</CodeBlock>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-success">
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  Known (from the shell&apos;s documented rules)
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                  {stage.known.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-primary">
                  <CircleHelp className="size-3" aria-hidden="true" />
                  Still needs to be measured
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                  {stage.measure.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <ArrowDown className="mx-auto my-1 size-4 text-muted-foreground" aria-hidden="true" />
        </li>
      ))}
      <li className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-primary/20 font-mono text-[11px] text-primary">
            {plan.stages.length + 1}
          </span>
          <h4 className="text-sm font-medium">{plan.targetLabel}</h4>
        </div>
        {result ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Measured: received {result.argc} argument{result.argc === 1 ? '' : 's'} ({result.runtime.name} {result.runtime.version} on{' '}
            {result.platform.os}).
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Unknown until you run the command locally and import the probe&apos;s JSON output. ArgTrail never executes commands itself.
          </p>
        )}
      </li>
    </ol>
  )
}
