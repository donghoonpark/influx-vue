import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useInfluxWorkbench } from '@/composables/useInfluxWorkbench'
import type {
  InfluxBucket,
  InfluxExplorerDataSource,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'

function createMockDataSource() {
  const buckets: InfluxBucket[] = [
    {
      id: 'bucket-1',
      name: 'demo-metrics',
      retentionSeconds: null,
    },
  ]

  const rows: InfluxRow[] = [
    {
      _time: '2026-03-26T00:00:00Z',
      _measurement: 'system',
      _field: 'usage_user',
      _value: 42,
      host: 'alpha',
    },
  ]

  const dataSource: InfluxExplorerDataSource = {
    ping: vi.fn<() => Promise<InfluxPingResult>>().mockResolvedValue({
      status: 'pass',
      name: 'influxdb',
      version: '2.7.0',
    }),
    listBuckets: vi
      .fn<() => Promise<InfluxBucket[]>>()
      .mockResolvedValue(buckets),
    listMeasurements: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue(['system', 'memory']),
    listFieldKeys: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue(['usage_user', 'usage_system']),
    listTagKeys: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue(['host', 'region']),
    listTagValues: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue(['alpha', 'beta']),
    queryRows: vi.fn<() => Promise<InfluxRow[]>>().mockResolvedValue(rows),
  }

  return dataSource
}

describe('useInfluxWorkbench', () => {
  beforeEach(() => {
    if (
      window.localStorage &&
      typeof window.localStorage.removeItem === 'function'
    ) {
      window.localStorage.removeItem('influx-vue/workbench/connection')
    }
  })

  it('hydrates the explorer flow from bucket to measurement to fields', async () => {
    const dataSource = createMockDataSource()
    const workbench = useInfluxWorkbench({
      createDataSource: () => dataSource,
    })

    await workbench.connect()

    expect(workbench.selectedBucket.value).toBe('demo-metrics')
    expect(workbench.selectedMeasurement.value).toBe('system')
    expect(workbench.selectedFields.value).toEqual(['usage_user'])
    expect(workbench.tagKeys.value).toEqual(['host', 'region'])
    expect(workbench.generatedFlux.value).toContain(
      'from(bucket: "demo-metrics")',
    )
  })

  it('adds tag filters and runs a query against the active explorer selection', async () => {
    const dataSource = createMockDataSource()
    const workbench = useInfluxWorkbench({
      createDataSource: () => dataSource,
    })

    await workbench.connect()
    await workbench.addTagFilter()
    workbench.updateTagFilterValues(0, ['alpha'])
    await workbench.runQuery()

    expect(workbench.tagFilters.value).toEqual([
      { tagKey: 'host', values: ['alpha'] },
    ])
    expect(dataSource.queryRows).toHaveBeenCalledTimes(1)
    expect(workbench.summary.value.rowCount).toBe(1)
    expect(workbench.status.value.type).toBe('success')
  })
})
