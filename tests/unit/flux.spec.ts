import { describe, expect, it } from 'vitest'

import { buildFieldKindsFlux, buildFluxQuery } from '@/services/influx/flux'

describe('buildFluxQuery', () => {
  it('builds an explorer-driven Flux query from guided selections', () => {
    const flux = buildFluxQuery({
      bucket: 'demo-metrics',
      measurement: 'system',
      measurements: ['system'],
      fields: ['usage_user', 'usage_system'],
      rangePreset: 'last_24h',
      customStart: '',
      customStop: '',
      aggregateWindow: '15m',
      aggregateFunction: 'mean',
      limit: 2000,
      tagFilters: [{ tagKey: 'host', values: ['alpha', 'beta'] }],
    })

    expect(flux).toContain('from(bucket: "demo-metrics")')
    expect(flux).toContain('|> range(start: -24h)')
    expect(flux).toContain('r._measurement == "system"')
    expect(flux).toContain(
      'r._field == "usage_user" or r._field == "usage_system"',
    )
    expect(flux).toContain('r["host"] == "alpha" or r["host"] == "beta"')
    expect(flux).toContain(
      '|> aggregateWindow(every: 15m, fn: mean, createEmpty: false)',
    )
    expect(flux).toContain('|> limit(n: 2000)')
  })

  it('supports custom datetime ranges and optional aggregation', () => {
    const expectedStartIso = new Date('2026-03-26T10:15').toISOString()
    const expectedStopIso = new Date('2026-03-26T12:15').toISOString()
    const flux = buildFluxQuery({
      bucket: 'demo-metrics',
      measurement: 'memory',
      measurements: ['memory'],
      fields: ['used_percent'],
      rangePreset: 'custom',
      customStart: '2026-03-26T10:15',
      customStop: '2026-03-26T12:15',
      aggregateWindow: '',
      aggregateFunction: 'last',
      limit: 100,
      tagFilters: [],
    })

    expect(flux).toContain(
      `|> range(start: time(v: "${expectedStartIso}"), stop: time(v: "${expectedStopIso}"))`,
    )
    expect(flux).not.toContain('aggregateWindow')
    expect(flux).toContain('|> filter(fn: (r) => r._field == "used_percent")')
  })

  it('skips aggregateWindow when aggregate function is set to none', () => {
    const flux = buildFluxQuery({
      bucket: 'demo-metrics',
      measurement: 'system',
      measurements: ['system'],
      fields: ['usage_user'],
      rangePreset: 'last_1h',
      customStart: '',
      customStop: '',
      aggregateWindow: '1s',
      aggregateFunction: 'none',
      limit: 5000,
      tagFilters: [],
    })

    expect(flux).not.toContain('aggregateWindow')
    expect(flux).toContain('|> sort(columns: ["_time"])')
  })

  it('builds a measurement union filter when multiple measurements are selected', () => {
    const flux = buildFluxQuery({
      bucket: 'demo-metrics',
      measurement: 'memory',
      measurements: ['system', 'memory'],
      fields: ['usage_user', 'used_percent'],
      rangePreset: 'last_6h',
      customStart: '',
      customStop: '',
      aggregateWindow: '1m',
      aggregateFunction: 'mean',
      limit: 1000,
      tagFilters: [],
    })

    expect(flux).toContain(
      'r._measurement == "system" or r._measurement == "memory"',
    )
  })

  it('splits numeric and string fields when aggregation is enabled', () => {
    const flux = buildFluxQuery(
      {
        bucket: 'demo-metrics',
        measurement: 'system',
        measurements: ['system'],
        fields: ['usage_user', 'message'],
        rangePreset: 'last_1h',
        customStart: '',
        customStop: '',
        aggregateWindow: '1m',
        aggregateFunction: 'mean',
        limit: 5000,
        tagFilters: [],
      },
      {
        fieldKinds: {
          usage_user: 'number',
          message: 'string',
        },
      },
    )

    expect(flux).toContain('aggregated = from(bucket: "demo-metrics")')
    expect(flux).toContain('passthrough = from(bucket: "demo-metrics")')
    expect(flux).toContain(
      '|> aggregateWindow(every: 1m, fn: mean, createEmpty: false)',
    )
    expect(flux).toContain('union(tables: [aggregated, passthrough])')
    expect(flux).toContain('r._field == "message"')
  })

  it('drops aggregateWindow entirely when all selected fields are non-numeric', () => {
    const flux = buildFluxQuery(
      {
        bucket: 'demo-metrics',
        measurement: 'system_event',
        measurements: ['system_event'],
        fields: ['message'],
        rangePreset: 'last_1h',
        customStart: '',
        customStop: '',
        aggregateWindow: '1m',
        aggregateFunction: 'mean',
        limit: 5000,
        tagFilters: [],
      },
      {
        fieldKinds: {
          message: 'string',
        },
      },
    )

    expect(flux).not.toContain('aggregateWindow')
    expect(flux).not.toContain('union(tables:')
    expect(flux).toContain('r._field == "message"')
  })

  it('builds a field-kind sampling flux query for schema inference', () => {
    const flux = buildFieldKindsFlux('demo-metrics', 'system', '-30d')

    expect(flux).toContain('group(columns: ["_field"])')
    expect(flux).toContain('sort(columns: ["_time"], desc: true)')
    expect(flux).toContain('|> limit(n: 1)')
  })
})
