export type OsId = 'windows' | 'linux' | 'macos'
export type ShellId = 'pwsh51' | 'pwsh7' | 'cmd' | 'bash' | 'sh'
export type TargetId = 'node' | 'python'
export type PsStrategy = 'idiomatic' | 'hardened'

export interface ArgRow {
  id: string
  value: string
}

export interface EnvironmentConfig {
  os: OsId
  shell: ShellId
  versions: Record<ShellId, string>
  target: TargetId
  executable: string
  cwd: string
  psStrategy: PsStrategy
  copyToClipboard: boolean
}

export interface LaunchConfig {
  os: OsId
  stages: ShellId[]
  versions: Record<ShellId, string>
  target: TargetId
  executable: string
  cwd: string
  psStrategy: PsStrategy
  copyToClipboard: boolean
}

export interface LaunchPath {
  id: string
  name: string
  os: OsId
  stages: ShellId[]
}

export interface ProbeResult {
  probe: 'argtrail'
  probeVersion: string
  runId: string | null
  runtime: { name: string; version: string }
  executable: string | null
  script: string | null
  platform: { os: string; release: string | null; arch: string | null }
  cwd: string | null
  argc: number
  argv: string[]
}

export type RunSource =
  | { kind: 'workspace' }
  | { kind: 'path'; pathId: string }
  | { kind: 'suite'; suiteId: string; pathId: string }

export interface ProbeRun {
  id: string
  label: string
  createdAt: number
  source: RunSource
  launch: LaunchConfig
  expected: string[]
  caseIds?: string[]
  command: string
  result?: ProbeResult
  importedAt?: number
  matchedBy?: 'run-id' | 'manual'
}

export interface TestCase {
  id: string
  label: string
  value: string
  note: string
  builtIn: boolean
}

export interface TestSuite {
  id: string
  name: string
  caseIds: string[]
}
