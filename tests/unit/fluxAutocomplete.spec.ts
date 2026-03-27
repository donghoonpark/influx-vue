import { describe, expect, it } from 'vitest'

import {
  resolveFluxCompletionReferences,
  resolveFluxCompletionContext,
  resolveFluxCompletionResult,
} from '@/services/influx/fluxAutocomplete'
import type { FluxAutocompleteSchema } from '@/services/influx/fluxAutocomplete'

const schema: FluxAutocompleteSchema = {
  buckets: ['demo-metrics', 'edge-sensors'],
  measurements: ['system', 'memory'],
  fields: ['usage_user', 'usage_system'],
  tagKeys: ['host', 'region'],
  tagValuesByKey: {
    host: ['alpha', 'beta'],
    region: ['apac', 'emea'],
  },
  aggregateFunctions: ['none', 'mean', 'sum', 'max', 'min', 'last', 'count'],
}

describe('fluxAutocomplete', () => {
  it('offers bucket names inside from(bucket: ...)', () => {
    const query = 'from(bucket: "de'
    const result = resolveFluxCompletionResult(
      query,
      query.length,
      schema,
      false,
    )

    expect(result?.from).toBe(query.length - 2)
    expect(result?.options.map((option) => option.label)).toEqual([
      'demo-metrics',
      'edge-sensors',
    ])
  })

  it('offers measurement names inside measurement filters', () => {
    const query = '  |> filter(fn: (r) => r._measurement == "sy'
    const result = resolveFluxCompletionResult(
      query,
      query.length,
      schema,
      false,
    )

    expect(result?.options.some((option) => option.label === 'system')).toBe(
      true,
    )
  })

  it('offers tag values for the active tag key context', () => {
    const query = '  |> filter(fn: (r) => r["host"] == "al'
    const result = resolveFluxCompletionResult(
      query,
      query.length,
      schema,
      false,
    )

    expect(result?.options.map((option) => option.label)).toEqual([
      'alpha',
      'beta',
    ])
  })

  it('offers aggregate functions inside aggregateWindow', () => {
    const query = '  |> aggregateWindow(every: 1m, fn: m'
    const result = resolveFluxCompletionResult(
      query,
      query.length,
      schema,
      false,
    )

    expect(result?.options.some((option) => option.label === 'mean')).toBe(true)
    expect(result?.options.some((option) => option.label === 'none')).toBe(true)
  })

  it('falls back to global snippets when completion is explicitly requested', () => {
    const result = resolveFluxCompletionResult('', 0, schema, true)

    expect(
      result?.options.some(
        (option) => option.label === 'from |> range |> filter',
      ),
    ).toBe(true)
  })

  it('tracks replacement ranges for bare bucket values', () => {
    const query = 'from(bucket: de'
    const match = resolveFluxCompletionContext(query, query.length, false)
    const result = resolveFluxCompletionResult(
      query,
      query.length,
      schema,
      false,
    )

    expect(match?.kind).toBe('bucket')
    expect(result?.from).toBe(query.length - 2)
    expect(result?.options[0]?.apply).toBe('"demo-metrics"')
  })

  it('extracts bucket and measurement references from the active query', () => {
    const query = `
from(bucket: "edge-sensors")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r["sensor"] == "sensor-a")
`

    expect(resolveFluxCompletionReferences(query, query.length)).toEqual({
      bucket: 'edge-sensors',
      measurement: 'temperature',
      tagKey: 'sensor',
    })
  })
})
