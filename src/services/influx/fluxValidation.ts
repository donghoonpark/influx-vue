export type FluxValidationSeverity = 'warning' | 'error'

export interface FluxValidationIssue {
  from: number
  to: number
  severity: FluxValidationSeverity
  message: string
  source: 'influx-vue'
}

interface DelimiterMatch {
  char: '(' | '[' | '{'
  index: number
}

interface FluxFunctionCallMatch {
  from: number
  to: number
  args: string
  argsFrom: number
}

const OPENING_DELIMITERS = new Set(['(', '[', '{'])
const MATCHING_DELIMITERS: Record<string, '(' | '[' | '{'> = {
  ')': '(',
  ']': '[',
  '}': '{',
}

function createIssue(
  from: number,
  to: number,
  message: string,
  severity: FluxValidationSeverity = 'error',
): FluxValidationIssue {
  return {
    from,
    to: Math.max(from + 1, to),
    severity,
    message,
    source: 'influx-vue',
  }
}

function scanToMatchingParen(source: string, openIndex: number): number {
  let depth = 0
  let inString = false
  let isEscaped = false

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (isEscaped) {
        isEscaped = false
        continue
      }

      if (char === '\\') {
        isEscaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function findFunctionCalls(
  source: string,
  functionName: string,
): FluxFunctionCallMatch[] {
  const matches: FluxFunctionCallMatch[] = []
  const pattern = new RegExp(`\\b${functionName}\\s*\\(`, 'g')

  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) {
    const openIndex = source.indexOf('(', match.index)
    if (openIndex === -1) {
      continue
    }

    const closeIndex = scanToMatchingParen(source, openIndex)
    if (closeIndex === -1) {
      continue
    }

    matches.push({
      from: match.index,
      to: closeIndex + 1,
      argsFrom: openIndex + 1,
      args: source.slice(openIndex + 1, closeIndex),
    })

    pattern.lastIndex = closeIndex + 1
  }

  return matches
}

function collectDelimiterIssues(source: string): FluxValidationIssue[] {
  const issues: FluxValidationIssue[] = []
  const stack: DelimiterMatch[] = []

  let inString = false
  let isEscaped = false
  let stringStart = -1

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (isEscaped) {
        isEscaped = false
        continue
      }

      if (char === '\\') {
        isEscaped = true
        continue
      }

      if (char === '"') {
        inString = false
        stringStart = -1
      }

      continue
    }

    if (char === '"') {
      inString = true
      stringStart = index
      continue
    }

    if (OPENING_DELIMITERS.has(char)) {
      stack.push({
        char: char as '(' | '[' | '{',
        index,
      })
      continue
    }

    if (char in MATCHING_DELIMITERS) {
      const expected = MATCHING_DELIMITERS[char]
      const active = stack.at(-1)

      if (!active || active.char !== expected) {
        issues.push(
          createIssue(
            index,
            index + 1,
            `Unexpected closing delimiter "${char}".`,
          ),
        )
        continue
      }

      stack.pop()
    }
  }

  if (inString && stringStart >= 0) {
    issues.push(
      createIssue(stringStart, source.length, 'Unterminated string literal.'),
    )
  }

  for (const delimiter of stack.reverse()) {
    issues.push(
      createIssue(
        delimiter.index,
        delimiter.index + 1,
        `Unclosed delimiter "${delimiter.char}".`,
      ),
    )
  }

  return issues
}

function collectFunctionArgumentIssues(source: string): FluxValidationIssue[] {
  const issues: FluxValidationIssue[] = []

  for (const match of findFunctionCalls(source, 'from')) {
    if (!/\bbucket\s*:/.test(match.args)) {
      issues.push(
        createIssue(
          match.from,
          match.to,
          '`from()` is missing a `bucket:` argument.',
        ),
      )
      continue
    }

    const emptyBucket = /\bbucket\s*:\s*""/.exec(match.args)
    if (emptyBucket) {
      const start = match.argsFrom + emptyBucket.index
      issues.push(
        createIssue(
          start,
          start + emptyBucket[0].length,
          '`bucket:` cannot be empty.',
        ),
      )
    }
  }

  for (const match of findFunctionCalls(source, 'range')) {
    if (!/\bstart\s*:/.test(match.args)) {
      issues.push(
        createIssue(
          match.from,
          match.to,
          '`range()` must include a `start:` value.',
        ),
      )
      continue
    }

    const missingStartValue = /\bstart\s*:\s*(?=,|$)/.exec(match.args)
    if (missingStartValue) {
      const start = match.argsFrom + missingStartValue.index
      issues.push(
        createIssue(
          start,
          start + missingStartValue[0].length,
          '`range(start:)` needs a value.',
        ),
      )
    }
  }

  for (const match of findFunctionCalls(source, 'aggregateWindow')) {
    if (!/\bevery\s*:/.test(match.args)) {
      issues.push(
        createIssue(
          match.from,
          match.to,
          '`aggregateWindow()` is missing an `every:` argument.',
        ),
      )
    }

    if (!/\bfn\s*:/.test(match.args)) {
      issues.push(
        createIssue(
          match.from,
          match.to,
          '`aggregateWindow()` is missing an `fn:` argument.',
        ),
      )
      continue
    }

    const missingFnValue = /\bfn\s*:\s*(?=,|$)/.exec(match.args)
    if (missingFnValue) {
      const start = match.argsFrom + missingFnValue.index
      issues.push(
        createIssue(
          start,
          start + missingFnValue[0].length,
          '`aggregateWindow(fn:)` needs a function name.',
        ),
      )
    }
  }

  return issues
}

function collectCommonPatternIssues(source: string): FluxValidationIssue[] {
  const issues: FluxValidationIssue[] = []
  const patternChecks = [
    {
      regex: /\|>\s*$/g,
      message: 'The query ends with a pipe operator.',
    },
    {
      regex: /_measurement\s*==\s*""/g,
      message: 'Measurement filters cannot compare against an empty string.',
    },
    {
      regex: /_field\s*==\s*""/g,
      message: 'Field filters cannot compare against an empty string.',
    },
    {
      regex: /r\[""\]/g,
      message: 'Tag key access cannot use an empty string.',
    },
  ]

  for (const check of patternChecks) {
    for (const match of source.matchAll(check.regex)) {
      const start = match.index ?? 0
      issues.push(createIssue(start, start + match[0].length, check.message))
    }
  }

  return issues
}

export function validateFluxQuery(source: string): FluxValidationIssue[] {
  if (!source.trim()) {
    return []
  }

  const issues = [
    ...collectDelimiterIssues(source),
    ...collectFunctionArgumentIssues(source),
    ...collectCommonPatternIssues(source),
  ]

  return issues.sort(
    (left, right) => left.from - right.from || left.to - right.to,
  )
}

export function hasBlockingFluxValidationIssues(
  issues: readonly FluxValidationIssue[],
): boolean {
  return issues.some((issue) => issue.severity === 'error')
}

export function summarizeFluxValidationIssues(
  issues: readonly FluxValidationIssue[],
): string {
  if (issues.length === 0) {
    return 'The query passed validation.'
  }

  const [firstIssue] = issues
  if (issues.length === 1) {
    return firstIssue.message
  }

  return `${firstIssue.message} ${issues.length - 1} more issue(s) found.`
}
