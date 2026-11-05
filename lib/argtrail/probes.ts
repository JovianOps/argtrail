import type { ProbeResult } from './types'

export const PROBE_VERSION = '1.0.0'

export const NODE_PROBE = String.raw`#!/usr/bin/env node
// ArgTrail argument probe (Node.js) v1.0.0
// Prints the exact arguments this process received as one line of JSON.
// It does not read environment variables, files, or the network.
'use strict';
const os = require('os');

const PROBE_VERSION = '1.0.0';
const SENTINEL = 'argtrail-run=';

let args = process.argv.slice(2);
let runId = null;
if (args.length > 0 && args[0].startsWith(SENTINEL)) {
  runId = args[0].slice(SENTINEL.length);
  args = args.slice(1);
}

let cwd = null;
try {
  cwd = process.cwd();
} catch (_) {
  cwd = null;
}

const result = {
  probe: 'argtrail',
  probeVersion: PROBE_VERSION,
  runId,
  runtime: { name: 'node', version: process.version },
  executable: process.execPath,
  script: __filename,
  platform: { os: process.platform, release: os.release(), arch: process.arch },
  cwd,
  argc: args.length,
  argv: args,
};

// Escape every non-ASCII code unit so console code pages and output
// redirection cannot alter the result on its way back to ArgTrail.
const json = JSON.stringify(result).replace(/[\u007f-\uffff]/g, (c) =>
  '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
);
process.stdout.write(json + '\n');
`

export const PYTHON_PROBE = String.raw`#!/usr/bin/env python3
"""ArgTrail argument probe (Python) v1.0.0

Prints the exact arguments this process received as one line of JSON.
It does not read environment variables, files, or the network.
"""
import json
import os
import platform
import sys

PROBE_VERSION = "1.0.0"
SENTINEL = "argtrail-run="


def main():
    args = list(sys.argv[1:])
    run_id = None
    if args and args[0].startswith(SENTINEL):
        run_id = args[0][len(SENTINEL):]
        args = args[1:]

    try:
        cwd = os.getcwd()
    except OSError:
        cwd = None

    result = {
        "probe": "argtrail",
        "probeVersion": PROBE_VERSION,
        "runId": run_id,
        "runtime": {"name": "python", "version": platform.python_version()},
        "executable": sys.executable or None,
        "script": os.path.abspath(__file__),
        "platform": {
            "os": sys.platform,
            "release": platform.release() or None,
            "arch": platform.machine() or None,
        },
        "cwd": cwd,
        "argc": len(args),
        "argv": args,
    }
    # ensure_ascii keeps the output pure ASCII, so console encodings cannot alter it.
    sys.stdout.write(json.dumps(result, ensure_ascii=True) + "\n")


if __name__ == "__main__":
    main()
`

export interface ParsedProbeOutput {
  results: ProbeResult[]
  errors: string[]
}

function isStringOrNull(value: unknown) {
  return value === null || value === undefined || typeof value === 'string'
}

function validate(candidate: unknown): { result?: ProbeResult; error?: string } {
  if (!candidate || typeof candidate !== 'object') return { error: 'Not a JSON object.' }
  const data = candidate as Record<string, unknown>
  if (data.probe !== 'argtrail') return { error: 'Missing "probe": "argtrail" marker — this does not look like ArgTrail probe output.' }
  if (!Array.isArray(data.argv) || !data.argv.every((value) => typeof value === 'string')) {
    return { error: '"argv" must be an array of strings.' }
  }
  if (!isStringOrNull(data.runId)) return { error: '"runId" must be a string or null.' }
  const runtime = (data.runtime ?? {}) as Record<string, unknown>
  const platform = (data.platform ?? {}) as Record<string, unknown>
  const argv = data.argv as string[]
  if (typeof data.argc === 'number' && data.argc !== argv.length) {
    return { error: `"argc" (${data.argc}) does not match argv length (${argv.length}). The output may have been edited or truncated.` }
  }
  return {
    result: {
      probe: 'argtrail',
      probeVersion: typeof data.probeVersion === 'string' ? data.probeVersion : 'unknown',
      runId: typeof data.runId === 'string' ? data.runId : null,
      runtime: {
        name: typeof runtime.name === 'string' ? runtime.name : 'unknown',
        version: typeof runtime.version === 'string' ? runtime.version : 'unknown',
      },
      executable: typeof data.executable === 'string' ? data.executable : null,
      script: typeof data.script === 'string' ? data.script : null,
      platform: {
        os: typeof platform.os === 'string' ? platform.os : 'unknown',
        release: typeof platform.release === 'string' ? platform.release : null,
        arch: typeof platform.arch === 'string' ? platform.arch : null,
      },
      cwd: typeof data.cwd === 'string' ? data.cwd : null,
      argc: argv.length,
      argv,
    },
  }
}

/** Accepts one or more probe JSON lines, tolerating surrounding console noise. */
export function parseProbeOutput(text: string): ParsedProbeOutput {
  const results: ProbeResult[] = []
  const errors: string[] = []
  const trimmed = text.trim()
  if (!trimmed) return { results, errors: ['Paste the JSON line printed by the probe.'] }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('{'))
  const candidates = lines.length > 0 ? lines : [trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)]

  candidates.forEach((candidate, i) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(candidate)
    } catch {
      errors.push(`Line ${i + 1}: invalid JSON. Make sure the whole line was copied.`)
      return
    }
    const { result, error } = validate(parsed)
    if (result) results.push(result)
    else errors.push(`Line ${i + 1}: ${error}`)
  })
  return { results, errors }
}
