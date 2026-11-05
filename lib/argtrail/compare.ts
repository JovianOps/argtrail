/**
 * Exact argument comparison. Strings are compared with ===; no trimming,
 * case folding, Unicode normalization or newline conversion is applied.
 */

export type DiffOp =
  | { type: 'match'; e: number; a: number }
  | { type: 'changed'; e: number; a: number }
  | { type: 'missing'; e: number }
  | { type: 'unexpected'; a: number }

export interface IndexRow {
  index: number
  expected: string | undefined
  actual: string | undefined
  equal: boolean
}

export interface Comparison {
  expectedCount: number
  actualCount: number
  ops: DiffOp[]
  indexRows: IndexRow[]
  matches: number
  changed: number
  missing: number
  unexpected: number
  indexEqual: number
  identical: boolean
}

const MAX_ALIGN = 1000

export function alignArgs(expected: string[], actual: string[]): DiffOp[] {
  const n = expected.length
  const m = actual.length
  if (n > MAX_ALIGN || m > MAX_ALIGN) {
    const ops: DiffOp[] = []
    for (let i = 0; i < Math.max(n, m); i++) {
      if (i < n && i < m) ops.push({ type: expected[i] === actual[i] ? 'match' : 'changed', e: i, a: i })
      else if (i < n) ops.push({ type: 'missing', e: i })
      else ops.push({ type: 'unexpected', a: i })
    }
    return ops
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = expected[i] === actual[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let pendingE: number[] = []
  let pendingA: number[] = []
  const flush = () => {
    const paired = Math.min(pendingE.length, pendingA.length)
    for (let k = 0; k < paired; k++) ops.push({ type: 'changed', e: pendingE[k], a: pendingA[k] })
    for (let k = paired; k < pendingE.length; k++) ops.push({ type: 'missing', e: pendingE[k] })
    for (let k = paired; k < pendingA.length; k++) ops.push({ type: 'unexpected', a: pendingA[k] })
    pendingE = []
    pendingA = []
  }

  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && expected[i] === actual[j] && dp[i][j] === dp[i + 1][j + 1] + 1) {
      flush()
      ops.push({ type: 'match', e: i, a: j })
      i++
      j++
    } else if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) {
      pendingE.push(i++)
    } else {
      pendingA.push(j++)
    }
  }
  flush()
  return ops
}

export function compareArgs(expected: string[], actual: string[]): Comparison {
  const ops = alignArgs(expected, actual)
  const indexRows: IndexRow[] = []
  let indexEqual = 0
  for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
    const e = expected[i]
    const a = actual[i]
    const equal = i < expected.length && i < actual.length && e === a
    if (equal) indexEqual++
    indexRows.push({ index: i, expected: e, actual: a, equal })
  }
  const count = (type: DiffOp['type']) => ops.filter((op) => op.type === type).length
  const matches = count('match')
  return {
    expectedCount: expected.length,
    actualCount: actual.length,
    ops,
    indexRows,
    matches,
    changed: count('changed'),
    missing: count('missing'),
    unexpected: count('unexpected'),
    indexEqual,
    identical: expected.length === actual.length && indexEqual === expected.length,
  }
}

export type CaseOutcome = 'pass' | 'changed' | 'missing' | 'awaiting'

/** Outcome for the expected argument at `index`, based on the alignment. */
export function outcomeForExpected(comparison: Comparison | null, index: number): CaseOutcome {
  if (!comparison) return 'awaiting'
  const op = comparison.ops.find((candidate) => 'e' in candidate && candidate.e === index)
  if (!op) return 'missing'
  if (op.type === 'match') return 'pass'
  return op.type === 'changed' ? 'changed' : 'missing'
}
