import {
  bashQuote,
  cmdEscape,
  hasPsTypographicQuote,
  msvcQuote,
  posixQuote,
  psQuote,
  utf16leBase64,
} from './quoting'
import { OS_LABELS, SHELLS, TARGETS, defaultExecutable, psArgMode, shellLabel } from './shells'
import type { LaunchConfig, ShellId } from './types'

export const SENTINEL_PREFIX = 'argtrail-run='

export type RiskLevel = 'high' | 'medium' | 'info'

export interface ArgRisk {
  stageIndex: number
  argIndex: number | null
  level: RiskLevel
  message: string
}

export interface StagePlan {
  index: number
  shell: ShellId
  label: string
  transport: string
  receives: string
  known: string[]
  measure: string[]
}

export interface ScriptFile {
  name: string
  content: string
  mime: string
  runHint: string
}

export interface LaunchPlan {
  ok: boolean
  errors: string[]
  command: string | null
  script: ScriptFile | null
  stages: StagePlan[]
  targetLabel: string
  targetArgv: string[]
  risks: ArgRisk[]
  notes: string[]
}

type Payload =
  | { kind: 'argv'; argv: string[]; userStart: number; userIsExpected: boolean }
  | { kind: 'cmd-raw'; raw: string }

interface RenderContext {
  config: LaunchConfig
  stageIndex: number
  isOutermost: boolean
  nested: boolean
}

interface Rendered {
  text: string
  transport?: string
  known: string[]
  measure: string[]
  risks: ArgRisk[]
  notes: string[]
}

type RenderResult = Rendered | { error: string }

const PS_BARE = /^[A-Za-z0-9_.=-]+$/
const NON_ASCII = /[^\x00-\x7f]/

function psExe(exe: string) {
  return PS_BARE.test(exe) && !exe.startsWith('-') ? exe : `& ${psQuote(exe)}`
}

function legacyRisks(
  values: string[],
  stageIndex: number,
  mapIndex: (i: number) => number | null,
): ArgRisk[] {
  const risks: ArgRisk[] = []
  values.forEach((value, i) => {
    const argIndex = mapIndex(i)
    const subject = argIndex === null ? 'The nested command' : `Argument ${argIndex}`
    if (value === '') {
      risks.push({
        stageIndex,
        argIndex,
        level: 'high',
        message: `${subject} is an empty string. Legacy native argument passing omits empty arguments entirely.`,
      })
    }
    if (value.includes('"')) {
      risks.push({
        stageIndex,
        argIndex,
        level: 'high',
        message: `${subject} contains double quotes. Legacy native argument passing does not escape them, so the target's command-line parser will consume or re-pair them.`,
      })
    }
    if (/[ \t]/.test(value) && value.endsWith('\\')) {
      risks.push({
        stageIndex,
        argIndex,
        level: 'high',
        message: `${subject} contains whitespace and ends with a backslash. PowerShell wraps it in quotes, and the trailing backslash then escapes the closing quote.`,
      })
    }
  })
  return risks
}

function renderPowerShell(shell: ShellId, payload: Payload, ctx: RenderContext): RenderResult {
  const { config, stageIndex, isOutermost } = ctx
  const mode = psArgMode(shell, config.versions[shell])
  const known: string[] = []
  const measure: string[] = []
  const notes: string[] = []
  const risks: ArgRisk[] = []
  const isWindows = config.os === 'windows'

  if (payload.kind === 'cmd-raw') {
    if (/[\r\n]/.test(payload.raw)) {
      return {
        error:
          'The stop-parsing token (--%) ends at the first line break, and cmd.exe cannot accept a line break inside a command, so a multiline argument cannot be passed through PowerShell → CMD.',
      }
    }
    const raw = isOutermost && config.copyToClipboard ? `${payload.raw} | clip` : payload.raw
    known.push(
      'Uses the stop-parsing token --%: PowerShell passes the remainder of the line to cmd.exe verbatim and does not interpret quotes, $ or `.',
      'Inside --%, PowerShell still replaces %NAME% when NAME is a defined environment variable. Every % in the payload is followed by ^, so no such sequence can match.',
      'cmd /s /c strips exactly the first and last double quote, leaving the payload intact.',
    )
    measure.push('Whether this PowerShell build handles --% identically when the command is pasted vs. run from a .ps1 file.')
    return {
      text: `cmd.exe --% /d /s /c "${raw}"`,
      known,
      measure,
      risks,
      notes,
    }
  }

  const [exe, ...rest] = payload.argv
  const userValues = rest.slice(payload.userStart - 1)
  const mapIndex = (i: number) => (payload.userIsExpected ? i : null)

  if (rest.some((value) => value.includes('\0'))) {
    return { error: 'An argument contains a NUL character, which cannot exist in a process argument on any OS.' }
  }

  if (mode === 'legacy' && config.psStrategy === 'hardened') {
    const line = rest.map(msvcQuote).join(' ')
    known.push(
      'Hardened: Start-Process receives one pre-built command line (MSVC/CommandLineToArgvW quoting), so PowerShell does not rebuild or re-quote individual arguments.',
      'Every argument is a single-quoted literal inside PowerShell; no $ or ` expansion occurs.',
    )
    measure.push(
      isWindows
        ? `How ${TARGETS[config.target].name} splits the command line (expected to follow MSVC rules).`
        : `How .NET on ${OS_LABELS[config.os]} splits ProcessStartInfo.Arguments into argv.`,
    )
    if (isOutermost && config.copyToClipboard) {
      notes.push('Start-Process -NoNewWindow writes straight to the console, so the output cannot be piped to Set-Clipboard. Copy it manually.')
    }
    return {
      text: `Start-Process -FilePath ${psQuote(exe)} -ArgumentList ${psQuote(line)} -NoNewWindow -Wait`,
      known,
      measure,
      risks,
      notes,
    }
  }

  const parts = [psExe(exe)]
  rest.forEach((value, i) => {
    const isUser = i + 1 >= payload.userStart
    parts.push(!isUser && PS_BARE.test(value) ? value : psQuote(value))
  })

  known.push('Arguments are single-quoted literals: PowerShell performs no $variable, `escape or subexpression expansion inside them.')
  if (userValues.some(hasPsTypographicQuote)) {
    known.push('Typographic single quotes (‘ ’ ‚ ‛) also terminate PowerShell single-quoted strings, so they are doubled like apostrophes.')
  }
  if (mode === 'legacy') {
    known.push(
      `Native argument passing is Legacy in ${shellLabel(shell, config.versions[shell])}: PowerShell rebuilds a command line, wraps arguments containing whitespace in double quotes, and does not escape embedded quotes.`,
    )
    risks.push(...legacyRisks(userValues, stageIndex, mapIndex))
    measure.push('Whether the legacy re-quoting changes these particular arguments.')
  } else {
    known.push(
      `Native argument passing is Standard/Windows in ${shellLabel(shell, config.versions[shell])}: empty strings and embedded double quotes are escaped for the target.`,
    )
    if (rest.some((value) => value === '')) {
      known.push('Empty strings are passed as "" (Standard mode).')
    }
  }
  if (isWindows) {
    measure.push(`How ${ctx.nested ? 'the next process' : TARGETS[config.target].name} parses the Windows command line PowerShell builds.`)
  } else {
    measure.push(`The exact argv PowerShell hands to execve on ${OS_LABELS[config.os]}.`)
  }
  if (userValues.some((value) => NON_ASCII.test(value))) {
    measure.push('Whether non-ASCII characters survive console input (OutputEncoding / code page) before PowerShell parses them.')
  }
  if (userValues.some((value) => /[\r\n]/.test(value))) {
    notes.push('The command spans multiple lines. Paste it in one piece, or download the generated .ps1 script.')
  }

  let text = parts.join(' ')
  if (isOutermost && config.copyToClipboard) {
    text += ' | Set-Clipboard'
    if (!isWindows) notes.push('Set-Clipboard on Linux/macOS requires xclip, wl-clipboard or pbcopy to be available.')
  }
  return { text, known, measure, risks, notes }
}

function renderCmd(payload: Payload, ctx: RenderContext): RenderResult {
  const { config, isOutermost } = ctx
  if (payload.kind === 'cmd-raw') {
    return { error: 'Nesting cmd.exe inside cmd.exe is not generated: the inner /c command line would need two layers of caret escaping with different percent-expansion rules, which ArgTrail cannot express reliably.' }
  }
  const [exe, ...rest] = payload.argv
  const userValues = rest.slice(payload.userStart - 1)

  const multiline = rest.findIndex((value) => /[\r\n]/.test(value))
  if (multiline !== -1) {
    const argIndex = payload.userIsExpected ? multiline - (payload.userStart - 1) : null
    return {
      error: `${argIndex === null ? 'The nested command' : `Argument ${argIndex}`} contains a line break. cmd.exe reads one line per command and has no escape that produces a literal newline inside an argument, so this value cannot be passed through CMD.`,
    }
  }
  if (/["%]/.test(exe)) {
    return { error: 'The executable path contains " or %, which cannot be quoted safely for cmd.exe.' }
  }

  const exeText = /[\s&()^|<>!,;=]/.test(exe) ? `"${exe}"` : exe
  const argsText = cmdEscape(rest.map(msvcQuote).join(' '))
  let text = `${exeText} ${argsText}`
  if (isOutermost && config.copyToClipboard) text += ' | clip'

  if (text.length > 8191) {
    return { error: `The generated command is ${text.length} characters long. cmd.exe rejects command lines longer than 8191 characters.` }
  }

  const known = [
    'Each argument is quoted with MSVC rules, then every cmd metacharacter — including each double quote — is caret-escaped so cmd never enters quote mode.',
    'Each % is followed by ^ so %NAME% cannot match a variable (interactive prompt rules; .bat files use %% instead).',
    '! is literal unless delayed expansion is enabled; it is caret-escaped as a precaution.',
  ]
  const measure = [
    'Whether this cmd.exe has delayed expansion or AutoRun commands enabled (registry or /V:ON).',
    `How ${TARGETS[config.target].name} parses the resulting command line.`,
  ]
  const risks: ArgRisk[] = []
  if (userValues.some((value) => NON_ASCII.test(value))) {
    measure.push('Whether the console code page / font preserves the non-ASCII characters you paste.')
  }
  if (payload.userIsExpected) {
    userValues.forEach((value, i) => {
      if (value.includes('!')) {
        risks.push({ stageIndex: ctx.stageIndex, argIndex: i, level: 'medium', message: `Argument ${i} contains !, which is consumed if delayed expansion is enabled in this cmd.exe.` })
      }
    })
  }
  return { text, known, measure, risks, notes: [] }
}

function renderPosix(shell: ShellId, payload: Payload, ctx: RenderContext): RenderResult {
  const { config, isOutermost, nested } = ctx
  if (payload.kind === 'cmd-raw') {
    return {
      error: `ArgTrail does not generate ${SHELLS[shell].name} → CMD commands. MSYS2/Cygwin rewrites arguments that look like POSIX paths (including cmd's /c and /d switches) and builds the cmd.exe command line with its own quoting, so the result cannot be predicted reliably.`,
    }
  }
  const [exe, ...rest] = payload.argv
  const userValues = rest.slice(payload.userStart - 1)
  const quote = (value: string) =>
    shell === 'bash' ? bashQuote(value, nested) : posixQuote(value)

  const parts = [posixQuote(exe), ...rest.map(quote)]
  let text = parts.join(' ')
  const notes: string[] = []
  if (isOutermost && config.copyToClipboard) {
    if (config.os === 'windows') text += ' | clip'
    else if (config.os === 'macos') text += ' | pbcopy'
    else notes.push('No universal clipboard command exists on Linux. Copy the output manually or pipe it to xclip / wl-copy.')
  }

  const known = [
    "Arguments use single quotes; the shell performs no $ expansion, globbing, word splitting or history expansion inside '…'.",
  ]
  if (shell === 'bash' && rest.some((value) => /[\x00-\x1f\x7f]/.test(value) || (nested && value.includes('"')))) {
    known.push("Values with control characters (and double quotes, when nested) use ANSI-C $'…' quoting, which only Bash understands.")
  }
  if (shell === 'sh' && rest.some((value) => /[\r\n]/.test(value))) {
    known.push('Newlines are kept literally inside single quotes (POSIX).')
  }

  const measure: string[] = []
  const risks: ArgRisk[] = []
  if (config.os === 'windows') {
    measure.push(
      'Which bash this resolves to: Git Bash (MSYS2) and WSL’s bash.exe hand arguments to Windows programs differently.',
      `How MSYS2 converts argv into a Windows command line for ${TARGETS[config.target].name}.`,
    )
    if (payload.userIsExpected) {
      userValues.forEach((value, i) => {
        if (value.startsWith('/') || /(^|[=;])\/[A-Za-z]/.test(value)) {
          risks.push({
            stageIndex: ctx.stageIndex,
            argIndex: i,
            level: 'medium',
            message: `Argument ${i} looks like a POSIX path. Git Bash may convert it to a Windows path; set MSYS_NO_PATHCONV=1 to disable this.`,
          })
        }
      })
    }
  } else {
    known.push(`On ${OS_LABELS[config.os]}, execve passes the argument vector directly; the target does not re-parse a command line.`)
    measure.push(`Which shell implements ${SHELLS[shell].invocation} here (${SHELLS[shell].versions.join(', ')}).`)
  }
  return { text, known, measure, risks, notes }
}

function invocationFor(shell: ShellId, script: string): Payload {
  switch (shell) {
    case 'bash':
    case 'sh':
      return { kind: 'argv', argv: [SHELLS[shell].invocation, '-c', script], userStart: 2, userIsExpected: false }
    case 'pwsh51':
    case 'pwsh7':
      return {
        kind: 'argv',
        argv: [SHELLS[shell].invocation, '-NoProfile', '-NonInteractive', '-EncodedCommand', utf16leBase64(script)],
        userStart: 4,
        userIsExpected: false,
      }
    case 'cmd':
      return { kind: 'cmd-raw', raw: script }
  }
}

function transportFor(inner: ShellId, outer: ShellId | null) {
  if (outer === null) return 'Typed or pasted at the interactive prompt'
  switch (inner) {
    case 'bash':
    case 'sh':
      return `Passed as the single argument to ${SHELLS[inner].invocation} -c`
    case 'pwsh51':
    case 'pwsh7':
      return `Passed via -EncodedCommand (Base64 of UTF-16LE), so ${SHELLS[outer].short} quoting never touches the script`
    case 'cmd':
      return 'Passed as the raw remainder of cmd.exe /d /s /c "…"'
  }
}

function prefixCwd(shell: ShellId, cwd: string, command: string): { text: string; error?: string } {
  if (!cwd) return { text: command }
  const family = SHELLS[shell].family
  if (family === 'powershell') return { text: `Set-Location -LiteralPath ${psQuote(cwd)}; ${command}` }
  if (family === 'cmd') {
    if (/["\r\n]/.test(cwd)) return { text: command, error: 'The working directory contains a double quote or line break, which cmd.exe cannot express in cd.' }
    return { text: `cd /d "${cwd}" && ${command}` }
  }
  return { text: `cd ${posixQuote(cwd)} && ${command}` }
}

export function targetExecutable(config: LaunchConfig) {
  return config.executable.trim() || defaultExecutable(config.target, config.os)
}

export function buildLaunchPlan(config: LaunchConfig, expected: string[], runId: string): LaunchPlan {
  const errors: string[] = []
  const risks: ArgRisk[] = []
  const notes: string[] = []
  const target = TARGETS[config.target]
  const targetLabel = `${target.name} probe`
  const exe = targetExecutable(config)
  const targetArgv = [exe, target.probeFile, `${SENTINEL_PREFIX}${runId}`, ...expected]
  const stages: StagePlan[] = []

  const fail = (): LaunchPlan => ({
    ok: false,
    errors,
    command: null,
    script: null,
    stages,
    targetLabel,
    targetArgv,
    risks,
    notes,
  })

  if (config.stages.length === 0) {
    errors.push('Add at least one shell stage.')
    return fail()
  }
  for (const shell of config.stages) {
    if (!SHELLS[shell].os.includes(config.os)) {
      errors.push(
        shell === 'sh' && config.os === 'windows'
          ? 'POSIX sh is not a native Windows shell. Use the Bash profile (Git Bash / WSL) instead.'
          : `${SHELLS[shell].name} is not available on ${OS_LABELS[config.os]}.`,
      )
    }
  }
  expected.forEach((value, i) => {
    if (value.includes('\0')) {
      errors.push(`Argument ${i} contains a NUL character. Process arguments are NUL-terminated strings on every OS, so no shell can deliver it.`)
    }
  })
  if (errors.length > 0) return fail()

  let payload: Payload = { kind: 'argv', argv: targetArgv, userStart: 3, userIsExpected: true }

  for (let i = config.stages.length - 1; i >= 0; i--) {
    const shell = config.stages[i]
    const outer = i > 0 ? config.stages[i - 1] : null
    const ctx: RenderContext = { config, stageIndex: i, isOutermost: i === 0, nested: i > 0 }
    const family = SHELLS[shell].family
    const result =
      family === 'powershell'
        ? renderPowerShell(shell, payload, ctx)
        : family === 'cmd'
          ? renderCmd(payload, ctx)
          : renderPosix(shell, payload, ctx)

    if ('error' in result) {
      errors.push(result.error)
      return fail()
    }

    risks.push(...result.risks)
    notes.push(...result.notes)
    stages.unshift({
      index: i,
      shell,
      label: shellLabel(shell, config.versions[shell]),
      transport: transportFor(shell, outer),
      receives: result.text,
      known: result.known,
      measure: result.measure,
    })
    if (i > 0) payload = invocationFor(shell, result.text)
  }

  const outermost = config.stages[0]
  const withCwd = prefixCwd(outermost, config.cwd.trim(), stages[0].receives)
  if (withCwd.error) {
    errors.push(withCwd.error)
    return fail()
  }
  const command = withCwd.text

  if (config.os === 'windows' && command.length > 32767) {
    errors.push(`The command is ${command.length} characters long, beyond the Windows 32,767-character command-line limit.`)
    return fail()
  }

  let script: ScriptFile | null = null
  const family = SHELLS[outermost].family
  if (family === 'powershell') {
    script = {
      name: `argtrail-run-${runId}.ps1`,
      // Windows PowerShell 5.1 reads BOM-less scripts in the ANSI code page, which corrupts non-ASCII arguments.
      content: `\uFEFF${command}\r\n`,
      mime: 'text/plain;charset=utf-8',
      runHint:
        outermost === 'pwsh51'
          ? `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\argtrail-run-${runId}.ps1`
          : `pwsh -NoProfile -File ./argtrail-run-${runId}.ps1`,
    }
  } else if (family === 'posix') {
    script = {
      name: `argtrail-run-${runId}.sh`,
      content: `#!/usr/bin/env ${SHELLS[outermost].invocation}\n${command}\n`,
      mime: 'text/x-shellscript;charset=utf-8',
      runHint: `${SHELLS[outermost].invocation} ./argtrail-run-${runId}.sh`,
    }
  } else {
    notes.push('No .cmd script is offered: batch files expand % differently from the interactive prompt, so the escaping above is only valid when pasted at a cmd.exe prompt.')
  }

  return { ok: true, errors, command, script, stages, targetLabel, targetArgv, risks, notes }
}
