'use client'

import { Download, FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { downloadText } from '@/lib/argtrail/format'
import { ArgTrailProvider, parseWorkspace, serializeWorkspace, useArgTrail, type TabId } from '@/lib/argtrail/store'
import { cn } from '@/lib/utils'
import { EnvironmentPanel } from './environment-panel'
import { ExpectedArgsPanel } from './expected-args-panel'
import { ImportPanel } from './import-panel'
import { LaunchPathsView } from './launch-paths-view'
import { ProbesView } from './probes-view'
import { ResultsPanel } from './results-panel'
import { TestLabView } from './test-lab-view'

const TABS: { id: TabId; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'paths', label: 'Launch paths' },
  { id: 'lab', label: 'Test lab' },
  { id: 'probes', label: 'Probes' },
]

export function ArgTrailApp() {
  return (
    <ArgTrailProvider>
      <Shell />
    </ArgTrailProvider>
  )
}

function Shell() {
  const { state, dispatch } = useArgTrail()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const measured = state.runs.filter((run) => run.result).length

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <img src="/icon.ico" alt="" width="24" height="24" className="rounded-md" />
            <span className="font-mono text-base font-semibold">
              arg<span className="text-primary">trail</span>
            </span>
            <span className="hidden text-xs text-muted-foreground md:inline">What you typed isn&apos;t always what your program received.</span>
          </div>
          <nav aria-label="Sections" className="order-3 w-full md:order-none md:w-auto">
            <div role="tablist" className="flex gap-0.5 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={state.tab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => dispatch({ type: 'setTab', tab: tab.id })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm whitespace-nowrap',
                    state.tab === tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              {state.runs.length} runs · {measured} measured
            </span>
            <Button type="button" variant="outline" size="xs" onClick={() => downloadText('argtrail-workspace.json', `${serializeWorkspace(state)}\n`)}>
              <Download aria-hidden="true" />
              Save
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden="true" />
              Open
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                try {
                  dispatch({ type: 'loadWorkspace', state: parseWorkspace(await file.text()) })
                  setError(null)
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Could not open workspace file.')
                }
              }}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="border-t bg-destructive/10 px-4 py-1.5 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </header>

      <main id={`tabpanel-${state.tab}`} role="tabpanel" aria-labelledby={`tab-${state.tab}`} className="mx-auto w-full max-w-[1600px] flex-1 p-4">
        {state.tab === 'workspace' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ExpectedArgsPanel />
            <EnvironmentPanel />
            <ImportPanel />
            <ResultsPanel />
          </div>
        )}
        {state.tab === 'paths' && <LaunchPathsView />}
        {state.tab === 'lab' && <TestLabView />}
        {state.tab === 'probes' && <ProbesView />}
      </main>
    </div>
  )
}
