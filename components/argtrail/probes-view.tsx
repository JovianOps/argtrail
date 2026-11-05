'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { downloadText } from '@/lib/argtrail/format'
import { NODE_PROBE, PROBE_VERSION, PYTHON_PROBE } from '@/lib/argtrail/probes'
import { TARGETS } from '@/lib/argtrail/shells'
import { CodeBlock, CopyButton, Panel } from './primitives'

const PROBES = [
  { id: 'node', source: NODE_PROBE, file: TARGETS.node.probeFile, mime: 'text/javascript', title: 'Node.js probe' },
  { id: 'python', source: PYTHON_PROBE, file: TARGETS.python.probeFile, mime: 'text/x-python', title: 'Python probe' },
] as const

export function ProbesView() {
  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="How measurement works"
        description="ArgTrail runs entirely in your browser and never executes anything. A tiny local probe reports what really arrived."
      >
        <ol className="grid gap-3 text-xs leading-relaxed text-muted-foreground md:grid-cols-4">
          {[
            ['Download a probe', 'Save it in your working directory. It has no dependencies and does not read env vars, files or the network.'],
            ['Copy the command', 'ArgTrail adds a hidden first argument argtrail-run=<id> so the output can be matched to the exact run.'],
            ['Run it locally', 'Use the shell you selected. The probe prints one ASCII-only JSON line, so console encodings cannot alter it.'],
            ['Paste the output', 'ArgTrail compares the received argv with what you expected — exactly, character by character.'],
          ].map(([title, text], i) => (
            <li key={title} className="rounded-lg border bg-background/60 p-3">
              <span className="font-mono text-primary">{i + 1}.</span> <span className="font-medium text-foreground">{title}</span>
              <p className="mt-1">{text}</p>
            </li>
          ))}
        </ol>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        {PROBES.map((probe) => (
          <Panel
            key={probe.id}
            title={probe.title}
            description={<span className="font-mono">{probe.file} · v{PROBE_VERSION}</span>}
            actions={
              <>
                <CopyButton text={probe.source} size="xs" />
                <Button type="button" size="xs" onClick={() => downloadText(probe.file, probe.source, probe.mime)}>
                  <Download aria-hidden="true" />
                  Download
                </Button>
              </>
            }
          >
            <CodeBlock className="max-h-[28rem]">{probe.source}</CodeBlock>
          </Panel>
        ))}
      </div>
    </div>
  )
}
