'use client'

import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { randomId } from './format'
import { DEFAULT_VERSIONS } from './shells'
import { BUILT_IN_CASES, DEFAULT_ARGS, DEFAULT_PATHS, DEFAULT_SUITES } from './test-cases'
import type {
  ArgRow,
  EnvironmentConfig,
  LaunchConfig,
  LaunchPath,
  ProbeResult,
  ProbeRun,
  TestCase,
  TestSuite,
} from './types'

export type TabId = 'workspace' | 'paths' | 'lab' | 'probes'

export interface State {
  args: ArgRow[]
  env: EnvironmentConfig
  paths: LaunchPath[]
  cases: TestCase[]
  suites: TestSuite[]
  runs: ProbeRun[]
  selectedRunId: string | null
  tab: TabId
}

let rowCounter = 0
export const newRowId = () => `row-${Date.now().toString(36)}-${(rowCounter++).toString(36)}`

const initialState: State = {
  args: DEFAULT_ARGS.map((value, i) => ({ id: `init-${i}`, value })),
  env: {
    os: 'windows',
    shell: 'pwsh7',
    versions: { ...DEFAULT_VERSIONS },
    target: 'node',
    executable: '',
    cwd: '',
    psStrategy: 'idiomatic',
    copyToClipboard: false,
  },
  paths: DEFAULT_PATHS,
  cases: BUILT_IN_CASES,
  suites: DEFAULT_SUITES,
  runs: [],
  selectedRunId: null,
  tab: 'workspace',
}

type Action =
  | { type: 'setTab'; tab: TabId }
  | { type: 'addArg'; value?: string; index?: number }
  | { type: 'updateArg'; id: string; value: string }
  | { type: 'removeArg'; id: string }
  | { type: 'moveArg'; id: string; offset: number }
  | { type: 'replaceArgs'; values: string[] }
  | { type: 'setEnv'; patch: Partial<EnvironmentConfig> }
  | { type: 'setVersion'; shell: keyof EnvironmentConfig['versions']; version: string }
  | { type: 'addPath'; path: LaunchPath }
  | { type: 'updatePath'; path: LaunchPath }
  | { type: 'removePath'; id: string }
  | { type: 'addCase'; testCase: TestCase }
  | { type: 'removeCase'; id: string }
  | { type: 'addSuite'; suite: TestSuite }
  | { type: 'updateSuite'; suite: TestSuite }
  | { type: 'removeSuite'; id: string }
  | { type: 'addRuns'; runs: ProbeRun[]; select?: boolean }
  | { type: 'attachResult'; runId: string; result: ProbeResult; matchedBy: 'run-id' | 'manual' }
  | { type: 'removeRun'; id: string }
  | { type: 'selectRun'; id: string | null; openWorkspace?: boolean }
  | { type: 'loadWorkspace'; state: Omit<State, 'tab'> }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab }
    case 'addArg': {
      const row = { id: newRowId(), value: action.value ?? '' }
      const args = [...state.args]
      args.splice(action.index ?? args.length, 0, row)
      return { ...state, args }
    }
    case 'updateArg':
      return { ...state, args: state.args.map((row) => (row.id === action.id ? { ...row, value: action.value } : row)) }
    case 'removeArg':
      return { ...state, args: state.args.filter((row) => row.id !== action.id) }
    case 'moveArg': {
      const from = state.args.findIndex((row) => row.id === action.id)
      const to = from + action.offset
      if (from === -1 || to < 0 || to >= state.args.length) return state
      const args = [...state.args]
      const [row] = args.splice(from, 1)
      args.splice(to, 0, row)
      return { ...state, args }
    }
    case 'replaceArgs':
      return { ...state, args: action.values.map((value) => ({ id: newRowId(), value })) }
    case 'setEnv':
      return { ...state, env: { ...state.env, ...action.patch } }
    case 'setVersion':
      return { ...state, env: { ...state.env, versions: { ...state.env.versions, [action.shell]: action.version } } }
    case 'addPath':
      return { ...state, paths: [...state.paths, action.path] }
    case 'updatePath':
      return { ...state, paths: state.paths.map((path) => (path.id === action.path.id ? action.path : path)) }
    case 'removePath':
      return { ...state, paths: state.paths.filter((path) => path.id !== action.id) }
    case 'addCase':
      return { ...state, cases: [...state.cases, action.testCase] }
    case 'removeCase':
      return {
        ...state,
        cases: state.cases.filter((testCase) => testCase.id !== action.id),
        suites: state.suites.map((suite) => ({ ...suite, caseIds: suite.caseIds.filter((id) => id !== action.id) })),
      }
    case 'addSuite':
      return { ...state, suites: [...state.suites, action.suite] }
    case 'updateSuite':
      return { ...state, suites: state.suites.map((suite) => (suite.id === action.suite.id ? action.suite : suite)) }
    case 'removeSuite':
      return { ...state, suites: state.suites.filter((suite) => suite.id !== action.id) }
    case 'addRuns':
      return {
        ...state,
        runs: [...action.runs, ...state.runs],
        selectedRunId: action.select && action.runs[0] ? action.runs[0].id : state.selectedRunId,
      }
    case 'attachResult':
      return {
        ...state,
        runs: state.runs.map((run) =>
          run.id === action.runId ? { ...run, result: action.result, importedAt: Date.now(), matchedBy: action.matchedBy } : run,
        ),
        selectedRunId: action.runId,
      }
    case 'removeRun':
      return {
        ...state,
        runs: state.runs.filter((run) => run.id !== action.id),
        selectedRunId: state.selectedRunId === action.id ? null : state.selectedRunId,
      }
    case 'selectRun':
      return { ...state, selectedRunId: action.id, tab: action.openWorkspace ? 'workspace' : state.tab }
    case 'loadWorkspace':
      return { ...action.state, tab: state.tab }
  }
}

interface StoreValue {
  state: State
  dispatch: React.Dispatch<Action>
  /** Random per-tab prefix (null until mounted) so run ids from an earlier session never attach to new runs. */
  sessionPrefix: string | null
}

const StoreContext = createContext<StoreValue | null>(null)

export function ArgTrailProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [sessionPrefix, setSessionPrefix] = useState<string | null>(null)
  useEffect(() => {
    setSessionPrefix(randomId(4))
  }, [])
  const value = useMemo(() => ({ state, dispatch, sessionPrefix }), [state, sessionPrefix])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function fnv1a(text: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** Identical inputs map to the same run id within a session, so re-copying a command never duplicates a run. */
export function runIdFor(prefix: string, signature: unknown) {
  return `${prefix}${fnv1a(JSON.stringify(signature))}`
}

export function useArgTrail() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useArgTrail must be used inside ArgTrailProvider')
  return value
}

export function launchFromEnv(env: EnvironmentConfig, overrides?: Partial<LaunchConfig>): LaunchConfig {
  return {
    os: env.os,
    stages: [env.shell],
    versions: { ...env.versions },
    target: env.target,
    executable: env.executable,
    cwd: env.cwd,
    psStrategy: env.psStrategy,
    copyToClipboard: env.copyToClipboard,
    ...overrides,
  }
}

export function runStatus(run: ProbeRun): 'awaiting' | 'match' | 'mismatch' {
  if (!run.result) return 'awaiting'
  const actual = run.result.argv
  if (actual.length !== run.expected.length) return 'mismatch'
  return run.expected.every((value, i) => value === actual[i]) ? 'match' : 'mismatch'
}

export const WORKSPACE_FILE_VERSION = 1

export function serializeWorkspace(state: State) {
  const { tab: _tab, ...rest } = state
  return JSON.stringify({ argtrailWorkspace: WORKSPACE_FILE_VERSION, ...rest }, null, 2)
}

export function parseWorkspace(text: string): Omit<State, 'tab'> {
  const data = JSON.parse(text)
  if (!data || data.argtrailWorkspace !== WORKSPACE_FILE_VERSION) throw new Error('Not an ArgTrail workspace file.')
  const required = ['args', 'env', 'paths', 'cases', 'suites', 'runs'] as const
  for (const key of required) if (!(key in data)) throw new Error(`Workspace file is missing "${key}".`)
  if (!Array.isArray(data.args) || !data.args.every((row: ArgRow) => typeof row?.value === 'string')) {
    throw new Error('Workspace "args" is malformed.')
  }
  return {
    args: data.args,
    env: data.env,
    paths: data.paths,
    cases: data.cases,
    suites: data.suites,
    runs: data.runs,
    selectedRunId: data.selectedRunId ?? null,
  }
}
