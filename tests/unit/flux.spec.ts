import { describe, expect, it } from 'vitest'

import { buildFluxQuery } from '@/services/influx/flux'

describe('buildFluxQuery', () => {
  it('builds an explorer-driven Flux query from guided selections', () => {
    const flux = buildFluxQuery({
      bucket: 'demo-metrics',
      measurement: 'system',
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
})
