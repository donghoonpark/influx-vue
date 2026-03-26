import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildFluxQuery, SCHEMA_LOOKBACK } from '@/services/influx/flux'

import { startInfluxHarness } from './helpers/influxHarness'

let harness: Awaited<ReturnType<typeof startInfluxHarness>>

describe('Influx explorer integration', () => {
  beforeAll(async () => {
    harness = await startInfluxHarness()
  })

  afterAll(async () => {
    await harness.container.stop()
  })

  it('discovers buckets, measurements, fields, tags, and tag values from a real container', async () => {
    const buckets = await harness.dataSource.listBuckets()
    const measurements = await harness.dataSource.listMeasurements({
      bucket: harness.config.bucket ?? 'demo-metrics',
      start: SCHEMA_LOOKBACK,
    })
    const fields = await harness.dataSource.listFieldKeys({
      bucket: harness.config.bucket ?? 'demo-metrics',
      measurement: 'system',
      start: SCHEMA_LOOKBACK,
    })
    const tags = await harness.dataSource.listTagKeys({
      bucket: harness.config.bucket ?? 'demo-metrics',
      measurement: 'system',
      start: SCHEMA_LOOKBACK,
    })
    const tagValues = await harness.dataSource.listTagValues({
      bucket: harness.config.bucket ?? 'demo-metrics',
      measurement: 'system',
      tagKey: 'host',
      start: SCHEMA_LOOKBACK,
    })

    expect(buckets.map((bucket) => bucket.name)).toContain('demo-metrics')
    expect(measurements).toEqual(expect.arrayContaining(['memory', 'system']))
    expect(fields).toEqual(
      expect.arrayContaining(['usage_system', 'usage_user']),
    )
    expect(tags).toEqual(expect.arrayContaining(['host', 'region']))
    expect(tagValues).toEqual(expect.arrayContaining(['alpha', 'beta']))
  })

  it('runs generated Flux against the container and returns filtered rows', async () => {
    const flux = buildFluxQuery({
      bucket: harness.config.bucket ?? 'demo-metrics',
      measurement: 'system',
      fields: ['usage_user', 'usage_system'],
      rangePreset: 'last_30d',
      customStart: '',
      customStop: '',
      aggregateWindow: '1h',
      aggregateFunction: 'mean',
      limit: 2000,
      tagFilters: [{ tagKey: 'host', values: ['alpha'] }],
    })

    const rows = await harness.dataSource.queryRows(flux)

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.host === 'alpha')).toBe(true)
    expect(rows.some((row) => row._field === 'usage_user')).toBe(true)
    expect(rows.some((row) => row._field === 'usage_system')).toBe(true)
  })
})
