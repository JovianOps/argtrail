import { psArgMode } from './shells'
import type { LaunchConfig } from './types'

export interface Explanation {
  title: string
  detail: string
  fix: string
}

interface ExplainInput {
  type: 'changed' | 'missing' | 'unexpected'
  expected?: string
  actual?: string
  actualAll: string[]
  actualIndex?: number
  launch: LaunchConfig
}

const has = (launch: LaunchConfig, shell: LaunchConfig['stages'][number]) => launch.stages.includes(shell)
const usesLegacyPs = (launch: LaunchConfig) =>
  launch.stages.some(
    (shell) => (shell === 'pwsh51' || shell === 'pwsh7') && psArgMode(shell, launch.versions[shell]) === 'legacy',
  )

/** Heuristic, rule-based hints. They describe likely causes; only the probe output is evidence. */
export function explainMismatch(input: ExplainInput): Explanation[] {
  const { type, expected, actual, launch, actualAll, actualIndex } = input
  const hints: Explanation[] = []
  const legacy = usesLegacyPs(launch)
  const windows = launch.os === 'windows'

  if (type === 'missing' && expected === '') {
    hints.push({
      title: 'Empty argument dropped',
      detail: legacy
        ? 'Legacy native argument passing (Windows PowerShell 5.1 and PowerShell 7.0–7.2) silently omits empty-string arguments.'
        : 'An empty argument disappears when a shell sees an unquoted empty expansion or when a wrapper joins arguments with spaces.',
      fix: legacy
        ? "Use PowerShell 7.3+, set $PSNativeCommandArgumentPassing = 'Standard', or pass '\"\"' (or use the hardened Start-Process strategy)."
        : 'Quote the value at every stage ("$var" in POSIX shells) so an empty word is preserved.',
    })
  }

  if (expected !== undefined && actual !== undefined && actualIndex !== undefined && /[ \t]/.test(expected)) {
    const pieces = expected.split(/[ \t]+/).filter(Boolean)
    const window = actualAll.slice(actualIndex, actualIndex + pieces.length)
    if (pieces.length > 1 && window.length === pieces.length && window.every((piece, i) => piece === pieces[i])) {
      hints.push({
        title: 'Split on whitespace',
        detail: 'The value arrived as several arguments, so one stage passed it without quotes (or its quotes were consumed by an earlier stage).',
        fix: 'Find the stage where quoting is lost — usually a nested shell or a wrapper that joins arguments into a single string.',
      })
    }
  }

  if (expected !== undefined && expected.includes('"') && (actual === undefined || !actual.includes('"') || actual !== expected)) {
    hints.push({
      title: 'Embedded double quotes re-parsed',
      detail: windows
        ? 'Windows programs receive one command-line string and split it with MSVC/CommandLineToArgvW rules. Unescaped " characters toggle quoting instead of being kept.'
        : 'A shell layer interpreted the double quotes as quoting syntax instead of literal characters.',
      fix: legacy
        ? 'Legacy PowerShell does not escape embedded quotes. Use PowerShell 7.3+, escape as \\" manually, or use the hardened strategy.'
        : 'Escape embedded quotes as \\" for MSVC-parsed targets, or use single quotes in POSIX shells.',
    })
  }

  if (expected !== undefined && /\\$/.test(expected) && actual !== undefined && (actual.endsWith('"') || actual.length > expected.length)) {
    hints.push({
      title: 'Trailing backslash escaped the closing quote',
      detail: 'Under MSVC parsing, a backslash run before " is halved and an odd run escapes the quote, so the argument runs into the next one.',
      fix: 'Double the trailing backslashes when the value is wrapped in quotes, or let a correct quoter (PowerShell 7.3+) build the command line.',
    })
  }

  if (expected !== undefined && actual !== undefined && expected.includes('%') && actual !== expected) {
    hints.push({
      title: 'Percent expansion',
      detail: has(launch, 'cmd')
        ? 'cmd.exe expands %NAME% when NAME is defined (and in .bat files also consumes single % signs).'
        : 'A stage that expands %NAME% (cmd.exe or PowerShell --%) replaced part of the value.',
      fix: 'At the interactive cmd prompt insert ^ after % (%^NAME%); in batch files use %%.',
    })
  }

  if (expected !== undefined && actual !== undefined && expected.includes('$') && !actual.includes('$')) {
    hints.push({
      title: 'Variable expansion ($)',
      detail: 'A shell expanded $NAME. Bash/sh do this inside double quotes; PowerShell does it inside "…" strings.',
      fix: "Use single quotes ('$HOME') at the stage that expanded it.",
    })
  }

  if (expected !== undefined && actual !== undefined && expected.includes('!') && !actual.includes('!')) {
    hints.push({
      title: 'Exclamation mark consumed',
      detail: has(launch, 'cmd')
        ? 'cmd.exe removes ! when delayed expansion is enabled.'
        : 'Interactive Bash performs history expansion on ! outside single quotes.',
      fix: has(launch, 'cmd') ? 'Disable delayed expansion (setlocal DisableDelayedExpansion) or escape as ^^!.' : "Use single quotes or 'set +H'.",
    })
  }

  if (expected !== undefined && actual !== undefined && expected.includes('\n')) {
    if (actual === expected.replace(/\n/g, '\r\n')) {
      hints.push({
        title: 'Newlines converted to CRLF',
        detail: 'A Windows layer converted LF to CRLF while building or reading the command.',
        fix: 'Compare with CRLF in mind or pass multiline data via a file or stdin instead of argv.',
      })
    } else if (!actual.includes('\n')) {
      hints.push({
        title: 'Line break lost',
        detail: 'The value was truncated or joined at the newline, typically by a stage that reads one line per command.',
        fix: 'Pass multiline data through a file, stdin or an encoded argument instead of argv.',
      })
    }
  }

  if (expected !== undefined && actual !== undefined && /[^\x00-\x7f]/.test(expected)) {
    if (actual.includes('\ufffd') || /\?/.test(actual) && !expected.includes('?')) {
      hints.push({
        title: 'Character encoding loss',
        detail: 'Non-ASCII characters were replaced (U+FFFD or ?), which happens when text passes through an ANSI/OEM code page.',
        fix: windows
          ? 'Save .ps1 files as UTF-8 with BOM, use chcp 65001, or set [Console]::InputEncoding/OutputEncoding to UTF-8.'
          : 'Make sure the terminal and locale (LANG/LC_ALL) use UTF-8.',
      })
    } else if (actual.normalize('NFC') === expected.normalize('NFC')) {
      hints.push({
        title: 'Unicode normalization differs',
        detail: 'The text is canonically equivalent but uses a different composed/decomposed form (NFC vs NFD). ArgTrail does not normalize, so this counts as a mismatch.',
        fix: 'Normalize explicitly in your program if equivalent forms should be accepted.',
      })
    }
  }

  if (expected !== undefined && actual !== undefined && expected !== actual) {
    if (expected.replace(/\\/g, '') === actual.replace(/\\/g, '')) {
      hints.push({
        title: 'Backslashes altered',
        detail: 'Only the backslashes differ. A layer treated \\ as an escape character (POSIX double quotes, ANSI-C strings or MSVC quote escaping).',
        fix: 'Use single quotes in POSIX shells; on Windows remember that backslashes only escape when they precede a double quote.',
      })
    } else if (expected.trim() === actual.trim()) {
      hints.push({
        title: 'Edge whitespace changed',
        detail: 'Leading or trailing whitespace was trimmed or added, usually by unquoted word splitting.',
        fix: 'Quote the value at every stage.',
      })
    } else if (expected.toLowerCase() === actual.toLowerCase()) {
      hints.push({
        title: 'Letter case changed',
        detail: 'Only letter case differs, which shells do not normally do — check for a wrapper script or path canonicalization.',
        fix: 'Inspect any wrapper between the shell and the target.',
      })
    }
  }

  if (type === 'unexpected' && hints.length === 0) {
    hints.push({
      title: 'Extra argument',
      detail: 'The target received an argument you did not define. It is usually a fragment of a value that was split, or a value injected by a wrapper or alias.',
      fix: 'Look at the neighbouring changed arguments; the extra value is often their missing half.',
    })
  }

  if (hints.length === 0) {
    hints.push({
      title: 'Unclassified difference',
      detail: 'None of the built-in heuristics match. Compare the code points below to locate the exact change.',
      fix: 'Re-run the probe one stage at a time to isolate the stage that changes the value.',
    })
  }
  return hints
}
