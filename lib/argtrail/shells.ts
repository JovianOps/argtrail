import type { OsId, ShellId, TargetId } from './types'

export type ShellFamily = 'powershell' | 'cmd' | 'posix'

export interface ShellInfo {
  id: ShellId
  name: string
  short: string
  family: ShellFamily
  os: OsId[]
  versions: string[]
  defaultVersion: string
  invocation: string
}

export const SHELLS: Record<ShellId, ShellInfo> = {
  pwsh51: {
    id: 'pwsh51',
    name: 'Windows PowerShell 5.1',
    short: 'PS 5.1',
    family: 'powershell',
    os: ['windows'],
    versions: ['5.1'],
    defaultVersion: '5.1',
    invocation: 'powershell.exe',
  },
  pwsh7: {
    id: 'pwsh7',
    name: 'PowerShell 7+',
    short: 'PS 7',
    family: 'powershell',
    os: ['windows', 'linux', 'macos'],
    versions: ['7.5', '7.4', '7.3', '7.2', '7.1', '7.0'],
    defaultVersion: '7.5',
    invocation: 'pwsh',
  },
  cmd: {
    id: 'cmd',
    name: 'Windows CMD',
    short: 'CMD',
    family: 'cmd',
    os: ['windows'],
    versions: ['Windows 11', 'Windows 10'],
    defaultVersion: 'Windows 11',
    invocation: 'cmd.exe',
  },
  bash: {
    id: 'bash',
    name: 'Bash',
    short: 'Bash',
    family: 'posix',
    os: ['windows', 'linux', 'macos'],
    versions: ['5.2', '5.1', '5.0', '4.4', '3.2'],
    defaultVersion: '5.2',
    invocation: 'bash',
  },
  sh: {
    id: 'sh',
    name: 'POSIX sh',
    short: 'sh',
    family: 'posix',
    os: ['linux', 'macos'],
    versions: ['dash', 'bash --posix', 'busybox ash', 'zsh (sh emulation)'],
    defaultVersion: 'dash',
    invocation: 'sh',
  },
}

export const SHELL_IDS: ShellId[] = ['pwsh51', 'pwsh7', 'cmd', 'bash', 'sh']

export const OS_LABELS: Record<OsId, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
}

export const TARGETS: Record<TargetId, { name: string; probeFile: string }> = {
  node: { name: 'Node.js', probeFile: 'argtrail-probe.js' },
  python: { name: 'Python', probeFile: 'argtrail_probe.py' },
}

export const DEFAULT_VERSIONS: Record<ShellId, string> = {
  pwsh51: SHELLS.pwsh51.defaultVersion,
  pwsh7: SHELLS.pwsh7.defaultVersion,
  cmd: SHELLS.cmd.defaultVersion,
  bash: SHELLS.bash.defaultVersion,
  sh: SHELLS.sh.defaultVersion,
}

export type PsArgMode = 'legacy' | 'standard'

/** PowerShell's $PSNativeCommandArgumentPassing behaviour for native executables such as node.exe / python.exe. */
export function psArgMode(shell: ShellId, version: string): PsArgMode {
  if (shell === 'pwsh51') return 'legacy'
  const [major, minor] = version.split('.').map((part) => Number.parseInt(part, 10))
  if (major === 7 && (Number.isNaN(minor) || minor < 3)) return 'legacy'
  return 'standard'
}

export function defaultExecutable(target: TargetId, os: OsId) {
  if (target === 'node') return 'node'
  return os === 'windows' ? 'python' : 'python3'
}

export function shellLabel(shell: ShellId, version?: string) {
  const info = SHELLS[shell]
  if (!version || shell === 'pwsh51') return info.name
  if (shell === 'cmd') return `${info.name} (${version})`
  if (shell === 'sh') return `${info.name} (${version})`
  return `${info.name.replace('7+', '')} ${version}`.replace(/\s+/g, ' ').trim()
}
