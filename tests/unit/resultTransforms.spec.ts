import { describe, expect, it } from 'vitest'

import {
  collectColumnKeys,
  extractValueList,
  rowsToChartSeries,
  summarizeRows,
} from '@/services/influx/resultTransforms'
import type { InfluxRow } from '@/services/influx/types'

const sampleRows: InfluxRow[] = [
  {
    _time: '2026-03-26T00:00:00Z',
    _field: 'usage_user',
    _value: 42,
    host: 'alpha',
  },
  {
    _time: '2026-03-26T00:05:00Z',
    _field: 'usage_user',
    _value: 48,
    host: 'alpha',
  },
  {
    _time: '2026-03-26T00:00:00Z',
    _field: 'usage_user',
    _value: 35,
    host: 'beta',
  },
  {
    _time: '2026-03-26T00:00:00Z',
    _field: 'region',
    _value: 'ap-northeast-2',
  },
]

describe('resultTransforms', () => {
  it('extracts unique string values for schema responses', () => {
    expect(extractValueList(sampleRows)).toEqual([
      '35',
      '42',
      '48',
      'ap-northeast-2',
    ])
  })

  it('groups numeric rows into chart series by field and tags', () => {
    const series = rowsToChartSeries(sampleRows)

    expect(series).toHaveLength(2)
    expect(series[0].name).toContain('usage_user')
    expect(series[0].points.length + series[1].points.length).toBe(3)
  })

  it('summarizes row and series counts', () => {
    expect(summarizeRows(sampleRows)).toMatchObject({
      rowCount: 4,
      numericRowCount: 3,
      seriesCount: 2,
      firstTimestamp: '2026-03-26T00:00:00Z',
      lastTimestamp: '2026-03-26T00:05:00Z',
    })
  })

  it('collects display columns across rows', () => {
    expect(collectColumnKeys(sampleRows)).toEqual([
      '_field',
      '_time',
      '_value',
      'host',
    ])
  })
})
