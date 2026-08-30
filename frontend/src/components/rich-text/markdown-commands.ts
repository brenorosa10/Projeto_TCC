export type EditResult = { value: string; selectionStart: number; selectionEnd: number }

type Range = { start: number; end: number }

function lineBounds(value: string, range: Range): Range {
  const start = value.lastIndexOf("\n", range.start - 1) + 1
  const lineEnd = value.indexOf("\n", range.end)
  return { start, end: lineEnd === -1 ? value.length : lineEnd }
}

/** Wraps (or unwraps) the selection with the given marker, e.g. `**`. */
export function toggleWrap(
  value: string,
  range: Range,
  marker: string,
  placeholder: string
): EditResult {
  const before = value.slice(0, range.start)
  const selected = value.slice(range.start, range.end)
  const after = value.slice(range.end)

  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const stripped = selected.slice(marker.length, selected.length - marker.length)
    return {
      value: before + stripped + after,
      selectionStart: range.start,
      selectionEnd: range.start + stripped.length,
    }
  }

  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, -marker.length) + selected + after.slice(marker.length),
      selectionStart: range.start - marker.length,
      selectionEnd: range.end - marker.length,
    }
  }

  const inner = selected || placeholder
  return {
    value: `${before}${marker}${inner}${marker}${after}`,
    selectionStart: range.start + marker.length,
    selectionEnd: range.start + marker.length + inner.length,
  }
}

/** Adds or removes a line prefix (`- `, `> `, `## `) on every selected line. */
export function toggleLinePrefix(
  value: string,
  range: Range,
  prefix: string,
  options: { ordered?: boolean } = {}
): EditResult {
  const bounds = lineBounds(value, range)
  const block = value.slice(bounds.start, bounds.end)
  const lines = block.split("\n")
  const matcher = options.ordered ? /^\d+\.\s/ : new RegExp(`^${escapeRegex(prefix)}`)
  const allPrefixed = lines.every((line) => matcher.test(line) || !line.trim())

  const next = lines
    .map((line, index) => {
      if (allPrefixed) return line.replace(matcher, "")
      if (!line.trim() && lines.length > 1) return line
      return options.ordered ? `${index + 1}. ${line}` : `${prefix}${line}`
    })
    .join("\n")

  const result = value.slice(0, bounds.start) + next + value.slice(bounds.end)
  return {
    value: result,
    selectionStart: bounds.start,
    selectionEnd: bounds.start + next.length,
  }
}

/** Inserts a fenced code block around the selection. */
export function insertCodeBlock(value: string, range: Range, language = ""): EditResult {
  const selected = value.slice(range.start, range.end)
  const body = selected || "// escreva seu código aqui"
  const needsLeadingBreak = range.start > 0 && !value.slice(0, range.start).endsWith("\n\n")
  const lead = range.start === 0 ? "" : needsLeadingBreak ? "\n\n" : ""
  const trail = value.slice(range.end).startsWith("\n") ? "\n" : "\n\n"
  const opening = `${lead}\`\`\`${language}\n`
  const snippet = `${opening}${body}\n\`\`\`${trail}`

  return {
    value: value.slice(0, range.start) + snippet + value.slice(range.end),
    selectionStart: range.start + opening.length,
    selectionEnd: range.start + opening.length + body.length,
  }
}

export function insertLink(value: string, range: Range): EditResult {
  const selected = value.slice(range.start, range.end)
  const label = selected || "texto do link"
  const snippet = `[${label}](https://)`
  return {
    value: value.slice(0, range.start) + snippet + value.slice(range.end),
    selectionStart: range.start + label.length + 3,
    selectionEnd: range.start + snippet.length - 1,
  }
}

export function insertTable(value: string, range: Range): EditResult {
  const table = "| Coluna A | Coluna B |\n| --- | --- |\n| valor 1 | valor 2 |\n"
  const lead = range.start === 0 || value.slice(0, range.start).endsWith("\n\n") ? "" : "\n\n"
  const snippet = `${lead}${table}`
  return {
    value: value.slice(0, range.start) + snippet + value.slice(range.end),
    selectionStart: range.start + snippet.length,
    selectionEnd: range.start + snippet.length,
  }
}

export function insertDivider(value: string, range: Range): EditResult {
  const lead = range.start === 0 || value.slice(0, range.start).endsWith("\n\n") ? "" : "\n\n"
  const snippet = `${lead}---\n\n`
  return {
    value: value.slice(0, range.start) + snippet + value.slice(range.end),
    selectionStart: range.start + snippet.length,
    selectionEnd: range.start + snippet.length,
  }
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
