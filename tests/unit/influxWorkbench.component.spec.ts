import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'

import InfluxWorkbench from '@/components/InfluxWorkbench.vue'
import type { InfluxWorkbenchExposed } from '@/components/workbench/types'
import type {
  InfluxBucket,
  InfluxExplorerDataSource,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'

function createSuccessfulDataSource() {
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
      .mockResolvedValue(['system']),
    listFieldKeys: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue(['usage_user']),
    listFieldKinds: vi
      .fn<() => Promise<Record<string, 'number' | 'string' | 'boolean' | 'unknown'>>>()
      .mockResolvedValue({ usage_user: 'number' }),
    listTagKeys: vi.fn<() => Promise<string[]>>().mockResolvedValue(['host']),
    listTagValues: vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValue(['alpha']),
    queryRows: vi.fn<() => Promise<InfluxRow[]>>().mockResolvedValue(rows),
  }

  return dataSource
}

function createFailingDataSource() {
  const dataSource: InfluxExplorerDataSource = {
    ping: vi
      .fn<() => Promise<InfluxPingResult>>()
      .mockRejectedValue(new Error('Connection refused')),
    listBuckets: vi.fn<() => Promise<InfluxBucket[]>>(),
    listMeasurements: vi.fn<() => Promise<string[]>>(),
    listFieldKeys: vi.fn<() => Promise<string[]>>(),
    listFieldKinds:
      vi.fn<
        () => Promise<Record<string, 'number' | 'string' | 'boolean' | 'unknown'>>
      >(),
    listTagKeys: vi.fn<() => Promise<string[]>>(),
    listTagValues: vi.fn<() => Promise<string[]>>(),
    queryRows: vi.fn<() => Promise<InfluxRow[]>>(),
  }

  return dataSource
}

describe('InfluxWorkbench component API', () => {
  beforeEach(() => {
    if (
      window.localStorage &&
      typeof window.localStorage.removeItem === 'function'
    ) {
      window.localStorage.removeItem('influx-vue/workbench/connection')
    }
  })

  it('exposes connection controls and emits connect/disconnect events', async () => {
    const dataSource = createSuccessfulDataSource()
    const wrapper = shallowMount(InfluxWorkbench, {
      props: {
        createDataSource: () => dataSource,
      },
    })
    const api = wrapper.vm as unknown as InfluxWorkbenchExposed

    api.applyConnection({
      url: 'http://127.0.0.1:8086',
      org: 'influx-vue',
      token: 'demo-token',
      bucket: 'demo-metrics',
    })

    const connected = await api.connect()

    expect(connected).toBe(true)
    expect(wrapper.emitted('connect')).toHaveLength(1)
    expect(
      (
        wrapper.emitted('connect')?.[0]?.[0] as {
          connection: { bucket?: string }
          bucketCount: number
        }
      ).connection.bucket,
    ).toBe('demo-metrics')
    expect(
      (
        wrapper.emitted('connect')?.[0]?.[0] as {
          connection: { bucket?: string }
          bucketCount: number
        }
      ).bucketCount,
    ).toBe(1)

    api.disconnect()

    expect(wrapper.emitted('disconnect')).toHaveLength(1)
  })

  it('emits connect-error when auto connect fails', async () => {
    const dataSource = createFailingDataSource()
    const wrapper = shallowMount(InfluxWorkbench, {
      props: {
        autoConnect: true,
        initialConnection: {
          url: 'http://127.0.0.1:8086',
          org: 'influx-vue',
          token: 'bad-token',
        },
        createDataSource: () => dataSource,
      },
    })

    await flushPromises()

    expect(wrapper.emitted('connect-error')).toHaveLength(1)
    expect(
      (wrapper.emitted('connect-error')?.[0]?.[0] as { phase: string }).phase,
    ).toBe('ping')
  })

  it('accepts username/password initialization through initialConnection', async () => {
    const dataSource = createSuccessfulDataSource()
    const authenticateConnection = vi.fn(async (config) => ({
      ...config,
      token: 'issued-token',
      authMethod: 'password' as const,
    }))
    const wrapper = shallowMount(InfluxWorkbench, {
      props: {
        autoConnect: true,
        initialConnection: {
          url: 'http://127.0.0.1:4173',
          org: 'influx-vue',
          bucket: 'demo-metrics',
          authMethod: 'password',
          username: 'influx',
          password: 'influx-password-123',
        },
        authenticateConnection,
        createDataSource: () => dataSource,
      },
    })

    await flushPromises()

    expect(authenticateConnection).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('connect')).toHaveLength(1)
    expect(
      (
        wrapper.emitted('connect')?.[0]?.[0] as {
          connection: { authMethod?: string; username?: string; token?: string }
        }
      ).connection,
    ).toMatchObject({
      authMethod: 'password',
      username: 'influx',
      token: '',
    })
  })
})
