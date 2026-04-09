import { describe, expect, it } from 'vitest'

import {
  buildParquetColumns,
  serializeRowsToCsv,
} from '@/services/influx/resultExport'
import type { InfluxRow } from '@/services/influx/types'

describe('result export helpers', () => {
  const rows: InfluxRow[] = [
    {
      _time: '2026-04-09T00:00:00Z',
      _measurement: 'system',
      _field: 'usage_user',
      _value: 42,
      host: 'alpha',
      region: 'ap-northeast-2',
      acknowledged: true,
    },
    {
      _time: '2026-04-09T00:01:00Z',
      _measurement: 'system_event',
      _field: 'message',
      _value: 'warn "cpu", threshold\ncrossed',
      host: 'alpha',
      region: 'ap-northeast-2',
      acknowledged: false,
    },
  ]

  it('serializes rows to CSV with escaping for special characters', () => {
    const csv = serializeRowsToCsv(rows)

    expect(csv).toContain(
      '_field,_measurement,_time,_value,acknowledged,host,region',
    )
    expect(csv).toContain(
      '"warn ""cpu"", threshold\ncrossed"',
    )
  })

  it('normalizes mixed parquet columns to a stable primitive schema', () => {
    const columns = buildParquetColumns(rows)

    expect(columns._time).toEqual([
      '2026-04-09T00:00:00Z',
      '2026-04-09T00:01:00Z',
    ])
    expect(columns._value).toEqual([
      '42',
      'warn "cpu", threshold\ncrossed',
    ])
    expect(columns.acknowledged).toEqual([true, false])
  })
})
