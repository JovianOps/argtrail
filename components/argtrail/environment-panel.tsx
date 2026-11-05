'use client'

import { useMemo } from 'react'
import { defaultExecutable, OS_LABELS, psArgMode, SHELL_IDS, SHELLS, TARGETS } from '@/lib/argtrail/shells'
import { launchFromEnv, useArgTrail } from '@/lib/argtrail/store'
import type { OsId, PsStrategy, ShellId, TargetId } from '@/lib/argtrail/types'
import { CommandPlan } from './command-plan'
import { Field, inputClass, NativeSelect, Panel } from './primitives'

export function EnvironmentPanel() {
  const { state, dispatch } = useArgTrail()
  const { env } = state
  const shell = SHELLS[env.shell]
  const availableShells = SHELL_IDS.filter((id) => SHELLS[id].os.includes(env.os))
  const isPowerShell = shell.family === 'powershell'
  const mode = isPowerShell ? psArgMode(env.shell, env.versions[env.shell]) : null
  const expected = useMemo(() => state.args.map((row) => row.value), [state.args])
  const launch = useMemo(() => launchFromEnv(env), [env])

  return (
    <Panel
      label="B"
      title="Environment & launch command"
      description="Describe how you will start the program. ArgTrail generates the command; you run it on your machine."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Operating system" htmlFor="env-os">
          <NativeSelect
            id="env-os"
            value={env.os}
            onChange={(event) => {
              const os = event.target.value as OsId
              const nextShell = SHELLS[env.shell].os.includes(os) ? env.shell : os === 'windows' ? 'pwsh7' : 'bash'
              dispatch({ type: 'setEnv', patch: { os, shell: nextShell } })
            }}
          >
            {(Object.keys(OS_LABELS) as OsId[]).map((os) => (
              <option key={os} value={os}>
                {OS_LABELS[os]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Shell" htmlFor="env-shell">
          <NativeSelect
            id="env-shell"
            value={env.shell}
            onChange={(event) => dispatch({ type: 'setEnv', patch: { shell: event.target.value as ShellId } })}
          >
            {availableShells.map((id) => (
              <option key={id} value={id}>
                {SHELLS[id].name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Shell version"
          htmlFor="env-version"
          hint={
            mode
              ? mode === 'legacy'
                ? 'Legacy native argument passing (empty args dropped, embedded quotes unescaped).'
                : 'Standard native argument passing ($PSNativeCommandArgumentPassing).'
              : undefined
          }
        >
          <NativeSelect
            id="env-version"
            value={env.versions[env.shell]}
            disabled={shell.versions.length < 2}
            onChange={(event) => dispatch({ type: 'setVersion', shell: env.shell, version: event.target.value })}
          >
            {shell.versions.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Target program" htmlFor="env-target">
          <NativeSelect
            id="env-target"
            value={env.target}
            onChange={(event) => dispatch({ type: 'setEnv', patch: { target: event.target.value as TargetId } })}
          >
            {(Object.keys(TARGETS) as TargetId[]).map((target) => (
              <option key={target} value={target}>
                {TARGETS[target].name} probe
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Executable" htmlFor="env-exe" hint="Leave empty to use the default from PATH.">
          <input
            id="env-exe"
            className={`${inputClass} font-mono text-xs`}
            value={env.executable}
            placeholder={defaultExecutable(env.target, env.os)}
            spellCheck={false}
            onChange={(event) => dispatch({ type: 'setEnv', patch: { executable: event.target.value } })}
          />
        </Field>
        <Field label="Working directory" htmlFor="env-cwd" hint="Optional. The probe file must be in this directory.">
          <input
            id="env-cwd"
            className={`${inputClass} font-mono text-xs`}
            value={env.cwd}
            placeholder={env.os === 'windows' ? 'C:\\argtrail' : '~/argtrail'}
            spellCheck={false}
            onChange={(event) => dispatch({ type: 'setEnv', patch: { cwd: event.target.value } })}
          />
        </Field>
        {isPowerShell && (
          <Field
            label="PowerShell strategy"
            htmlFor="env-strategy"
            hint="Idiomatic shows what a typical call does. Hardened bypasses native argument passing quirks."
          >
            <NativeSelect
              id="env-strategy"
              value={env.psStrategy}
              onChange={(event) => dispatch({ type: 'setEnv', patch: { psStrategy: event.target.value as PsStrategy } })}
            >
              <option value="idiomatic">Idiomatic call (&amp; exe args)</option>
              <option value="hardened">Hardened (explicit command line)</option>
            </NativeSelect>
          </Field>
        )}
        <label className="flex items-center gap-2 self-end pb-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={env.copyToClipboard}
            onChange={(event) => dispatch({ type: 'setEnv', patch: { copyToClipboard: event.target.checked } })}
            className="size-3.5 accent-primary"
          />
          Pipe probe output to the clipboard
        </label>
      </div>

      <div className="border-t pt-4">
        <CommandPlan launch={launch} expected={expected} source={{ kind: 'workspace' }} label={`${shell.short} → ${TARGETS[env.target].name}`} showStages />
      </div>
    </Panel>
  )
}
