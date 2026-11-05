'use client'

import { Download, FileUp, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { downloadText } from '@/lib/argtrail/format'
import { useArgTrail } from '@/lib/argtrail/store'
import { ArgRowEditor } from './arg-row'
import { CopyButton, NativeSelect, Panel } from './primitives'

function parseArgArray(text: string): string[] {
  const data = JSON.parse(text)
  const values = Array.isArray(data) ? data : Array.isArray(data?.argv) ? data.argv : null
  if (!values) throw new Error('Expected a JSON array of strings (or an object with an "argv" array).')
  if (!values.every((value: unknown) => typeof value === 'string')) throw new Error('Every array item must be a string.')
  return values
}

export function ExpectedArgsPanel() {
  const { state, dispatch } = useArgTrail()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const values = state.args.map((row) => row.value)
  const json = JSON.stringify(values, null, 2)

  const applyImport = (text: string) => {
    try {
      dispatch({ type: 'replaceArgs', values: parseArgArray(text) })
      setImportError(null)
      setImportText('')
      setImportOpen(false)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not parse JSON.')
    }
  }

  return (
    <Panel
      label="A"
      title="Expected arguments"
      description="The exact argument vector your program should receive, one value per row. Nothing is trimmed or normalized."
      actions={
        <span className="rounded-md border px-2 py-0.5 font-mono text-xs" aria-live="polite">
          argc <span className="text-primary">{values.length}</span>
        </span>
      }
    >
      {state.args.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          No arguments. A run with zero arguments is valid — add rows to test specific values.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5" aria-label="Expected argument rows">
          {state.args.map((row, index) => (
            <ArgRowEditor
              key={row.id}
              row={row}
              index={index}
              total={state.args.length}
              onChange={(value) => dispatch({ type: 'updateArg', id: row.id, value })}
              onRemove={() => dispatch({ type: 'removeArg', id: row.id })}
              onMove={(offset) => dispatch({ type: 'moveArg', id: row.id, offset })}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => dispatch({ type: 'addArg' })}>
          <Plus aria-hidden="true" />
          Add argument
        </Button>
        <label htmlFor="insert-case" className="sr-only">
          Insert a value from the test library
        </label>
        <NativeSelect
          id="insert-case"
          className="h-7 w-auto flex-1 text-xs"
          value=""
          onChange={(event) => {
            const testCase = state.cases.find((candidate) => candidate.id === event.target.value)
            if (testCase) dispatch({ type: 'addArg', value: testCase.value })
          }}
        >
          <option value="">Insert from test library…</option>
          {state.cases.map((testCase) => (
            <option key={testCase.id} value={testCase.id}>
              {testCase.label} — {JSON.stringify(testCase.value)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-auto text-xs font-medium text-muted-foreground">JSON array</span>
          <CopyButton text={json} label="Copy" size="xs" />
          <Button type="button" variant="outline" size="xs" onClick={() => downloadText('argtrail-args.json', `${json}\n`)}>
            <Download aria-hidden="true" />
            Export
          </Button>
          <Button type="button" variant="outline" size="xs" aria-expanded={importOpen} onClick={() => setImportOpen((open) => !open)}>
            <FileUp aria-hidden="true" />
            Import
          </Button>
        </div>
        {importOpen && (
          <div className="flex flex-col gap-2">
            <label htmlFor="args-import" className="sr-only">
              Paste a JSON array of strings
            </label>
            <textarea
              id="args-import"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={'["hello world", "C:\\\\Program Files\\\\App", ""]'}
              spellCheck={false}
              rows={4}
              className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {importError && (
              <p role="alert" className="text-xs text-destructive">
                {importError}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="xs" onClick={() => applyImport(importText)} disabled={!importText.trim()}>
                Replace arguments
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={() => fileRef.current?.click()}>
                Choose file…
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (file) applyImport(await file.text())
                  event.target.value = ''
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
