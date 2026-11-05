/**
 * Quoting primitives. Each function targets exactly one parser; none of them
 * attempt to be "universal", because no such quoting exists.
 */

/** PowerShell treats the ASCII apostrophe and the typographic single quotes as interchangeable quote characters. */
const PS_SINGLE_QUOTES = /['\u2018\u2019\u201A\u201B]/g

export function psQuote(value: string) {
  return `'${value.replace(PS_SINGLE_QUOTES, (quote) => quote + quote)}'`
}

export function hasPsTypographicQuote(value: string) {
  return /[\u2018\u2019\u201A\u201B]/.test(value)
}

const POSIX_BARE = /^[A-Za-z0-9_\-.,/:=@+%]+$/

export function posixQuote(value: string) {
  if (value !== '' && POSIX_BARE.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Bash ANSI-C quoting ($'...'). Produces output free of double quotes, raw control characters and '!' */
export function ansiCQuote(value: string) {
  let out = "$'"
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (char === '\\') out += '\\\\'
    else if (char === "'") out += "\\'"
    else if (char === '"') out += '\\x22'
    else if (char === '!') out += '\\x21'
    else if (char === '\n') out += '\\n'
    else if (char === '\r') out += '\\r'
    else if (char === '\t') out += '\\t'
    else if (code < 0x20 || code === 0x7f) out += `\\x${code.toString(16).padStart(2, '0')}`
    else out += char
  }
  return `${out}'`
}

const CONTROL_CHARS = /[\x00-\x1f\x7f]/

export function bashQuote(value: string, avoidDoubleQuotes: boolean) {
  if (CONTROL_CHARS.test(value)) return ansiCQuote(value)
  if (avoidDoubleQuotes && value.includes('"')) return ansiCQuote(value)
  return posixQuote(value)
}

/**
 * Quote one argument so the Microsoft C runtime / CommandLineToArgvW parser
 * reconstructs it exactly (used by node.exe and python.exe on Windows).
 */
export function msvcQuote(value: string) {
  if (value !== '' && !/[ \t\n\v"]/.test(value)) return value
  let out = '"'
  let backslashes = 0
  for (const char of value) {
    if (char === '\\') {
      backslashes++
    } else if (char === '"') {
      out += '\\'.repeat(backslashes * 2 + 1) + '"'
      backslashes = 0
    } else {
      out += '\\'.repeat(backslashes) + char
      backslashes = 0
    }
  }
  out += '\\'.repeat(backslashes * 2)
  return `${out}"`
}

const CMD_META = new Set(['(', ')', '!', '^', '"', '<', '>', '&', '|'])

/**
 * Escape text for the interactive cmd.exe prompt.
 * Every metacharacter, including every double quote, is caret-escaped so cmd
 * never enters quote mode. Each '%' is followed by a caret so that no %NAME%
 * sequence can match a defined variable during percent expansion.
 */
export function cmdEscape(text: string) {
  const tokens: string[] = []
  for (const char of text) tokens.push(CMD_META.has(char) ? `^${char}` : char)
  let out = ''
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '%') {
      out += '%'
      const next = tokens[i + 1]
      if (next !== undefined && !next.startsWith('^')) out += '^'
    } else {
      out += token
    }
  }
  return out
}

/** Base64 of the UTF-16LE encoding, as expected by -EncodedCommand. */
export function utf16leBase64(value: string) {
  let binary = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    binary += String.fromCharCode(code & 0xff, code >> 8)
  }
  return btoa(binary)
}
