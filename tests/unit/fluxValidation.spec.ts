import { describe, expect, it } from 'vitest'

import {
  hasBlockingFluxValidationIssues,
  summarizeFluxValidationIssues,
  validateFluxQuery,
} from '@/services/influx/fluxValidation'

describe('fluxValidation', () => {
  it('accepts a basic valid flux query', () => {
    const issues = validateFluxQuery(
      'from(bucket: "demo-metrics") |> range(start: -1h) |> limit(n: 10)',
    )

    expect(issues).toEqual([])
  })

  it('flags unterminated strings and unclosed delimiters', () => {
    const issues = validateFluxQuery(
      'from(bucket: "demo-metrics) |> range(start: -1h)',
    )

    expect(
      issues.some((issue) => issue.message === 'Unterminated string literal.'),
    ).toBe(true)
    expect(
      issues.some((issue) => issue.message === 'Unclosed delimiter "(".'),
    ).toBe(true)
    expect(hasBlockingFluxValidationIssues(issues)).toBe(true)
  })

  it('flags incomplete aggregateWindow calls', () => {
    const issues = validateFluxQuery(
      'from(bucket: "demo-metrics") |> range(start: -1h) |> aggregateWindow(every: 1m, fn: )',
    )

    expect(
      issues.some(
        (issue) =>
          issue.message === '`aggregateWindow(fn:)` needs a function name.',
      ),
    ).toBe(true)
  })

  it('flags an unfinished pipe operator', () => {
    const issues = validateFluxQuery(
      'from(bucket: "demo-metrics") |> range(start: -1h) |>',
    )

    expect(
      issues.some(
        (issue) => issue.message === 'The query ends with a pipe operator.',
      ),
    ).toBe(true)
    expect(summarizeFluxValidationIssues(issues)).toBe(
      'The query ends with a pipe operator.',
    )
  })
})
