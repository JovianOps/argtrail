import type { LaunchPath, TestCase, TestSuite } from './types'

export const BUILT_IN_CASES: TestCase[] = [
  { id: 'space', label: 'Space', value: 'hello world', note: 'Splits into two arguments when quoting is lost.', builtIn: true },
  { id: 'winpath', label: 'Windows path', value: 'C:\\Program Files\\App', note: 'Spaces plus backslashes that must not be treated as escapes.', builtIn: true },
  { id: 'percent', label: 'Percent', value: '100%', note: 'cmd.exe and PowerShell --% treat % as a variable delimiter.', builtIn: true },
  { id: 'percent-var', label: '%PATH%', value: '%PATH%', note: 'Expands in cmd.exe when unescaped.', builtIn: true },
  { id: 'dollar', label: '$HOME', value: '$HOME', note: 'Expands in Bash/sh double quotes and PowerShell double-quoted strings.', builtIn: true },
  { id: 'bang', label: 'Exclamation', value: '!important', note: 'Bash history expansion (interactive) and cmd delayed expansion.', builtIn: true },
  { id: 'apostrophe', label: 'Apostrophe', value: "it's working", note: 'Terminates single-quoted strings unless escaped.', builtIn: true },
  { id: 'typographic', label: 'Curly apostrophe', value: 'it\u2019s curly', note: 'PowerShell treats \u2019 as a single-quote character.', builtIn: true },
  { id: 'dquote', label: 'Embedded quotes', value: 'quote "inside"', note: 'Legacy PowerShell passes these unescaped to native programs.', builtIn: true },
  { id: 'trail-bs', label: 'Trailing backslash', value: 'C:\\temp\\', note: 'Fine on its own; dangerous once wrapped in quotes.', builtIn: true },
  { id: 'trail-bs-space', label: 'Spaced trailing \\', value: 'C:\\My Dir\\', note: 'The trailing backslash can escape the closing quote.', builtIn: true },
  { id: 'double-bs', label: 'Double trailing \\\\', value: 'ends\\\\', note: 'Backslash runs are halved before a quote by MSVC parsing.', builtIn: true },
  { id: 'empty', label: 'Empty string', value: '', note: 'Dropped by legacy PowerShell and by unquoted shell expansion.', builtIn: true },
  { id: 'unicode', label: 'Unicode', value: 'na\u00efve caf\u00e9 \u2014 \u65e5\u672c\u8a9e \ud83d\ude80', note: 'Code pages and console encodings can corrupt non-ASCII text.', builtIn: true },
  { id: 'multiline', label: 'Multiline', value: 'line one\nline two', note: 'cmd.exe cannot represent a newline inside an argument.', builtIn: true },
  { id: 'padded', label: 'Edge spaces', value: '  padded  ', note: 'Leading and trailing whitespace must survive exactly.', builtIn: true },
  { id: 'dash-dot', label: '-foo.bar', value: '-foo.bar', note: 'Older PowerShell versions split unquoted -name.ext tokens.', builtIn: true },
  { id: 'meta', label: 'Pipes & ampersands', value: 'a&b|c<d>', note: 'cmd.exe operators outside quotes.', builtIn: true },
  { id: 'backtick', label: 'Backtick', value: 'tick`n', note: 'PowerShell escape character in double-quoted strings.', builtIn: true },
  { id: 'caret', label: 'Caret', value: 'x^y', note: 'cmd.exe escape character.', builtIn: true },
]

export const DEFAULT_SUITES: TestSuite[] = [
  {
    id: 'core',
    name: 'Core tricky inputs',
    caseIds: ['space', 'winpath', 'percent', 'dollar', 'bang', 'apostrophe', 'dquote', 'trail-bs', 'empty', 'unicode', 'multiline'],
  },
  {
    id: 'windows-quoting',
    name: 'Windows quoting edge cases',
    caseIds: ['dquote', 'trail-bs-space', 'double-bs', 'empty', 'percent-var', 'meta', 'caret', 'typographic'],
  },
]

export const DEFAULT_PATHS: LaunchPath[] = [
  { id: 'ps7-node', name: 'PowerShell 7 → Node.js', os: 'windows', stages: ['pwsh7'] },
  { id: 'ps51-node', name: 'PowerShell 5.1 → Node.js', os: 'windows', stages: ['pwsh51'] },
  { id: 'cmd-node', name: 'CMD → Node.js', os: 'windows', stages: ['cmd'] },
  { id: 'bash-node', name: 'Bash → Node.js', os: 'linux', stages: ['bash'] },
  { id: 'ps7-cmd-node', name: 'PowerShell 7 → CMD → Node.js', os: 'windows', stages: ['pwsh7', 'cmd'] },
  { id: 'ps7-bash-node', name: 'PowerShell 7 → Bash → Node.js', os: 'windows', stages: ['pwsh7', 'bash'] },
]

export const DEFAULT_ARGS = ['hello world', 'C:\\Program Files\\App', '100%', '', 'quote "inside"']
