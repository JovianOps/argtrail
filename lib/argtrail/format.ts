/** Render a string as a JSON string literal so every character is unambiguous. */
export function literal(value: string) {
  return JSON.stringify(value)
}

export function codePoints(value: string) {
  return Array.from(value).map((char) => {
    const code = char.codePointAt(0) ?? 0
    return { char, hex: `U+${code.toString(16).toUpperCase().padStart(4, '0')}` }
  })
}

export function firstDifference(a: string, b: string) {
  const left = Array.from(a)
  const right = Array.from(b)
  const length = Math.min(left.length, right.length)
  for (let i = 0; i < length; i++) if (left[i] !== right[i]) return i
  return left.length === right.length ? -1 : length
}

export function describeTraits(value: string): string[] {
  const traits: string[] = []
  if (value === '') return ['empty']
  if (/^\s|\s$/.test(value)) traits.push('edge whitespace')
  if (/[\r\n]/.test(value)) traits.push('newline')
  if (/[^\x00-\x7f]/.test(value)) traits.push('non-ASCII')
  if (/["'\u2018\u2019]/.test(value)) traits.push('quotes')
  if (/\\$/.test(value)) traits.push('trailing \\')
  if (/[%$!`^&|<>]/.test(value)) traits.push('metachar')
  return traits
}

export function downloadText(name: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function randomId(length = 8) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
