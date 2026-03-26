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

  it('syncs explorer state into the query text without syncing raw edits back', async () => {
    const dataSource = createMockDataSource()
    const workbench = useInfluxWorkbench({
      createDataSource: () => dataSource,
    })

    await workbench.connect()
    workbench.syncQueryFromExplorer()

    expect(workbench.rawFlux.value).toContain('from(bucket: "demo-metrics")')
    expect(workbench.queryMode.value).toBe('builder')

    workbench.updateQueryText(
      'from(bucket: "demo-metrics") |> range(start: -6h)',
    )

    expect(workbench.queryMode.value).toBe('raw')
    expect(workbench.rawFlux.value).toContain('range(start: -6h)')
    expect(workbench.selectedFields.value).toEqual(['usage_user'])
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

  it('saves the current query as a dashboard panel and reloads it into the editor', async () => {
    const dataSource = createMockDataSource()
    const workbench = useInfluxWorkbench({
      createDataSource: () => dataSource,
    })

    await workbench.connect()
    await workbench.addTagFilter()
    workbench.updateTagFilterValues(0, ['alpha'])
    await workbench.runQuery()

    const panel = workbench.addCurrentSelectionToDashboard({
      title: 'CPU usage by host',
      visualization: 'chart',
    })

    expect(panel).not.toBeNull()
    expect(workbench.dashboardPanels.value).toHaveLength(1)
    expect(workbench.dashboardPanelRows.value[panel!.id]).toHaveLength(1)

    workbench.selectedFields.value = ['usage_system']
    const loaded = await workbench.loadDashboardPanel(panel!.id)

    expect(loaded).toBe(true)
    expect(workbench.selectedFields.value).toEqual(['usage_user'])
    expect(workbench.tagFilters.value).toEqual([
      { tagKey: 'host', values: ['alpha'] },
    ])
  })

  it('imports dashboard yaml and runs saved panels', async () => {
    const dataSource = createMockDataSource()
    const workbench = useInfluxWorkbench({
      createDataSource: () => dataSource,
    })

    await workbench.connect()

    const loaded = workbench.importDashboardYaml(`
name: Imported dashboard
columns: 2
panels:
  - id: imported-panel
    title: Imported CPU
    visualization: chart
    queryMode: builder
    query:
      bucket: demo-metrics
      measurement: system
      fields:
        - usage_user
      rangePreset: last_24h
      customStart: ""
      customStop: ""
      aggregateWindow: 15m
      aggregateFunction: mean
      limit: 2000
      tagFilters:
        - tagKey: host
          values:
            - alpha
`)

    expect(loaded).toBe(true)
    expect(workbench.dashboardName.value).toBe('Imported dashboard')
    expect(workbench.dashboardPanels.value).toHaveLength(1)

    const ran = await workbench.runDashboardPanels()

    expect(ran).toBe(true)
    expect(dataSource.queryRows).toHaveBeenCalled()
    expect(workbench.dashboardPanelRows.value['imported-panel']).toHaveLength(1)
  })
})
