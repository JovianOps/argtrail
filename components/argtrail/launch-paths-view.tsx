'use client'

import { ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { OS_LABELS, SHELL_IDS, SHELLS, TARGETS } from '@/lib/argtrail/shells'
import { launchFromEnv, useArgTrail } from '@/lib/argtrail/store'
import { randomId } from '@/lib/argtrail/format'
import type { LaunchPath, OsId, ShellId } from '@/lib/argtrail/types'
import { cn } from '@/lib/utils'
import { CommandPlan } from './command-plan'
import { inputClass, NativeSelect, Panel } from './primitives'
import { StageChips } from './stage-sequence'

export function LaunchPathsView() {
  const { state, dispatch } = useArgTrail()
  const expected = useMemo(() => state.args.map((row) => row.value), [state.args])

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Launch paths"
        description={
          <>
            Each path is a chain of shells ending in the {TARGETS[state.env.target].name} probe. Every path uses the{' '}
            {expected.length} expected argument{expected.length === 1 ? '' : 's'} from the workspace, so results are directly comparable.
          </>
        }
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() =>
              dispatch({ type: 'addPath', path: { id: `path-${randomId(6)}`, name: 'New path', os: state.env.os, stages: [state.env.os === 'windows' ? 'pwsh7' : 'bash'] } })
            }
          >
            <Plus aria-hidden="true" />
            Add path
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {state.paths.map((path) => (
            <PathCard key={path.id} path={path} expected={expected} />
          ))}
        </ul>
      </Panel>
    </div>
  )
}

function PathCard({ path, expected }: { path: LaunchPath; expected: string[] }) {
  const { state, dispatch } = useArgTrail()
  const [open, setOpen] = useState(false)
  const launch = useMemo(() => launchFromEnv(state.env, { os: path.os, stages: path.stages }), [state.env, path.os, path.stages])
  const update = (patch: Partial<LaunchPath>) => dispatch({ type: 'updatePath', path: { ...path, ...patch } })
  const shellOptions = SHELL_IDS.filter((id) => SHELLS[id].os.includes(path.os))

  return (
    <li className="rounded-lg border bg-background/40">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left"
        >
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
          <span className="text-sm font-medium">{path.name}</span>
          <span className="text-[11px] text-muted-foreground">{OS_LABELS[path.os]}</span>
          <StageChips labels={path.stages.map((id) => SHELLS[id].short)} target={TARGETS[state.env.target].name} />
        </button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${path.name}`} onClick={() => dispatch({ type: 'removePath', id: path.id })}>
          <Trash2 />
        </Button>
      </div>
      {open && (
        <div className="flex flex-col gap-4 border-t p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${path.id}-name`} className="text-xs text-muted-foreground">Name</label>
              <input id={`${path.id}-name`} className={inputClass} value={path.name} onChange={(event) => update({ name: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${path.id}-os`} className="text-xs text-muted-foreground">OS</label>
              <NativeSelect
                id={`${path.id}-os`}
                value={path.os}
                onChange={(event) => {
                  const os = event.target.value as OsId
                  const stages = path.stages.filter((id) => SHELLS[id].os.includes(os))
                  update({ os, stages: stages.length ? stages : [os === 'windows' ? 'pwsh7' : 'bash'] })
                }}
              >
                {(Object.keys(OS_LABELS) as OsId[]).map((os) => (
                  <option key={os} value={os}>{OS_LABELS[os]}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Stages (outermost first)</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {path.stages.map((stage, i) => (
                <span key={`${stage}-${i}`} className="inline-flex items-center gap-1 rounded border bg-card py-0.5 pr-0.5 pl-2 font-mono text-xs">
                  {SHELLS[stage].short}
                  <button
                    type="button"
                    aria-label={`Remove stage ${i + 1} (${SHELLS[stage].name})`}
                    disabled={path.stages.length === 1}
                    onClick={() => update({ stages: path.stages.filter((_, index) => index !== i) })}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <label htmlFor={`${path.id}-add-stage`} className="sr-only">Add a nested shell stage</label>
              <NativeSelect
                id={`${path.id}-add-stage`}
                className="h-7 w-auto text-xs"
                value=""
                disabled={path.stages.length >= 4}
                onChange={(event) => event.target.value && update({ stages: [...path.stages, event.target.value as ShellId] })}
              >
                <option value="">+ nested shell…</option>
                {shellOptions.map((id) => (
                  <option key={id} value={id}>{SHELLS[id].name}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <CommandPlan launch={launch} expected={expected} source={{ kind: 'path', pathId: path.id }} label={path.name} showStages />
        </div>
      )}
    </li>
  )
}
