import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import InfluxDashboard from '@/components/InfluxDashboard.vue'
import {
  createDashboardDefinition,
  createDashboardPanel,
  exportDashboardYaml,
} from '@/services/influx/dashboard'
import type {
  InfluxExplorerDataSource,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'

function createMockDataSource(rows: InfluxRow[]): InfluxExplorerDataSource {
  return {
    ping: vi.fn<() => Promise<InfluxPingResult>>().mockResolvedValue({
      status: 'pass',
      name: 'influxdb',
      version: '2.7.0',
    }),
    listBuckets: vi.fn(),
    listMeasurements: vi.fn(),
    listFieldKeys: vi.fn(),
    listTagKeys: vi.fn(),
    listTagValues: vi.fn(),
    queryRows: vi.fn<() => Promise<InfluxRow[]>>().mockResolvedValue(rows),
  }
}

describe('InfluxDashboard', () => {
  it('loads dashboard yaml and runs panels through the provided data source', async () => {
    const rows: InfluxRow[] = [
      {
        _time: '2026-03-28T00:00:00Z',
        _measurement: 'system',
        _field: 'usage_user',
        _value: 42,
        host: 'alpha',
      },
    ]
    const dataSource = createMockDataSource(rows)
    const yaml = exportDashboardYaml(
      createDashboardDefinition({
        name: 'CPU dashboard',
        columns: 1,
        connection: {
          url: 'http://localhost:8086',
          org: 'influx-vue',
          authMethod: 'token',
          token: 'secret-token',
        },
        panels: [
          createDashboardPanel({
            id: 'cpu-panel',
            title: 'CPU usage',
            visualization: 'table',
            queryMode: 'builder',
            rawFlux: '',
            query: {
              bucket: 'demo-metrics',
              measurement: 'system',
              fields: ['usage_user'],
              rangePreset: 'last_24h',
              customStart: '',
              customStop: '',
              aggregateWindow: '15m',
              aggregateFunction: 'mean',
              limit: 2000,
              tagFilters: [],
            },
          }),
        ],
      }),
    )

    const wrapper = mount(InfluxDashboard, {
      props: {
        yaml,
        createDataSource: () => dataSource,
        authenticateConnection: async (config) => config,
      },
    })

    await flushPromises()

    expect(dataSource.ping).toHaveBeenCalledTimes(1)
    expect(dataSource.queryRows).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('CPU usage')
    expect(wrapper.text()).toContain('1 rows')
  })

  it('reports invalid yaml', async () => {
    const wrapper = mount(InfluxDashboard, {
      props: {
        yaml: 'name: [unterminated',
        autoRun: false,
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Dashboard YAML is invalid')
  })
})
