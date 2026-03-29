import { describe, expect, it } from 'vitest'

import {
  buildDashboardPanelFlux,
  createDashboardConnection,
  createDashboardDefinition,
  createDashboardPanel,
  exportDashboardYaml,
  maskDashboardDefinitionSecrets,
  parseDashboardYaml,
  serializeDashboardToDisplayYaml,
  serializeDashboardToYaml,
} from '@/services/influx/dashboard'

describe('dashboard helpers', () => {
  it('serializes and parses dashboard YAML', () => {
    const dashboard = createDashboardDefinition({
      name: 'Operations overview',
      columns: 3,
      panels: [
        createDashboardPanel({
          title: 'CPU usage',
          visualization: 'chart',
          queryMode: 'builder',
          rawFlux: '',
          query: {
            bucket: 'demo-metrics',
            measurement: 'system',
            measurements: ['memory', 'system'],
            fields: ['usage_user'],
            rangePreset: 'last_24h',
            customStart: '',
            customStop: '',
            aggregateWindow: '15m',
            aggregateFunction: 'mean',
            limit: 2000,
            tagFilters: [{ tagKey: 'host', values: ['alpha'] }],
          },
        }),
      ],
    })

    const yaml = serializeDashboardToYaml(dashboard)
    const parsed = parseDashboardYaml(yaml)

    expect(yaml).toContain('measurements:')
    expect(yaml).not.toContain('\n      measurement:')
    expect(parsed.name).toBe('Operations overview')
    expect(parsed.columns).toBe(3)
    expect(parsed.panels).toHaveLength(1)
    expect(parsed.panels[0]?.query.measurements).toEqual(['memory', 'system'])
    expect(parsed.panels[0]?.query.measurement).toBe('memory')
    expect(parsed.panels[0]?.query.fields).toEqual(['usage_user'])
    expect(parsed.panels[0]?.query.tagFilters).toEqual([
      { tagKey: 'host', values: ['alpha'] },
    ])
  })

  it('builds flux from builder and raw panel definitions', () => {
    const builderPanel = createDashboardPanel({
      title: 'Builder panel',
      visualization: 'chart',
      queryMode: 'builder',
      rawFlux: '',
      query: {
        bucket: 'demo-metrics',
        measurement: 'system',
        measurements: ['system'],
        fields: ['usage_user'],
        rangePreset: 'last_24h',
        customStart: '',
        customStop: '',
        aggregateWindow: '15m',
        aggregateFunction: 'mean',
        limit: 2000,
        tagFilters: [],
      },
    })

    const rawPanel = createDashboardPanel({
      title: 'Raw panel',
      visualization: 'table',
      queryMode: 'raw',
      rawFlux: 'from(bucket: "demo-metrics") |> range(start: -1h)',
      query: builderPanel.query,
    })

    expect(buildDashboardPanelFlux(builderPanel)).toContain(
      'from(bucket: "demo-metrics")',
    )
    expect(buildDashboardPanelFlux(rawPanel)).toBe(
      'from(bucket: "demo-metrics") |> range(start: -1h)',
    )
  })

  it('accepts aggregate function none from dashboard yaml', () => {
    const parsed = parseDashboardYaml(`
name: No aggregation
panels:
  - id: raw-points
    title: Raw points
    visualization: chart
    queryMode: builder
    query:
      bucket: demo-metrics
      measurement: system
      fields:
        - usage_user
      rangePreset: last_1h
      customStart: ""
      customStop: ""
      aggregateWindow: 1s
      aggregateFunction: none
      limit: 5000
      tagFilters: []
`)

    expect(parsed.panels[0]?.query.aggregateFunction).toBe('none')
    expect(buildDashboardPanelFlux(parsed.panels[0]!)).not.toContain(
      'aggregateWindow',
    )
  })

  it('normalizes legacy single-measurement yaml into the multi-measurement model', () => {
    const parsed = parseDashboardYaml(`
name: Legacy dashboard
panels:
  - id: legacy-panel
    title: Legacy panel
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
      tagFilters: []
`)

    expect(parsed.panels[0]?.query.measurement).toBe('system')
    expect(parsed.panels[0]?.query.measurements).toEqual(['system'])
  })

  it('serializes and parses dashboard with connection', () => {
    const dashboard = createDashboardDefinition({
      name: 'Dashboard with connection',
      columns: 2,
      connection: {
        url: 'http://localhost:8086',
        org: 'influx-vue',
        bucket: 'demo-metrics',
        authMethod: 'token',
        token: 'test-token',
      },
      panels: [],
    })

    const yaml = serializeDashboardToYaml(dashboard)
    const parsed = parseDashboardYaml(yaml)

    expect(parsed.name).toBe('Dashboard with connection')
    expect(parsed.connection).toBeDefined()
    expect(parsed.connection?.url).toBe('http://localhost:8086')
    expect(parsed.connection?.org).toBe('influx-vue')
    expect(parsed.connection?.bucket).toBe('demo-metrics')
    expect(parsed.connection?.authMethod).toBe('token')
    expect(parsed.connection?.token).toBe('test-token')
  })

  it('creates a normalized dashboard connection from Influx config', () => {
    const connection = createDashboardConnection({
      url: 'http://localhost:8086',
      org: 'influx-vue',
      bucket: 'demo-metrics',
      authMethod: 'token',
      token: 'secret-token',
      password: 'should-not-be-exported',
    })

    expect(connection).toEqual({
      url: 'http://localhost:8086',
      org: 'influx-vue',
      bucket: 'demo-metrics',
      authMethod: 'token',
      token: 'secret-token',
      username: undefined,
    })
  })

  it('masks tokens in display yaml but keeps raw export intact', () => {
    const dashboard = createDashboardDefinition({
      name: 'Masked dashboard',
      connection: {
        url: 'http://localhost:8086',
        org: 'influx-vue',
        authMethod: 'token',
        token: 'secret-token',
      },
      panels: [],
    })

    const masked = maskDashboardDefinitionSecrets(dashboard)
    const displayYaml = serializeDashboardToDisplayYaml(dashboard)
    const exportYaml = exportDashboardYaml(dashboard)

    expect(masked.connection?.token).toBe('****')
    expect(displayYaml).toContain('token: "****"')
    expect(exportYaml).toContain('token: secret-token')
  })

  it('parses dashboard with connection from YAML', () => {
    const parsed = parseDashboardYaml(`
version: 1
name: Dashboard with connection
columns: 2
connection:
  url: http://localhost:8086
  org: influx-vue
  bucket: demo-metrics
  authMethod: password
  username: influx
panels: []
`)

    expect(parsed.name).toBe('Dashboard with connection')
    expect(parsed.connection).toBeDefined()
    expect(parsed.connection?.url).toBe('http://localhost:8086')
    expect(parsed.connection?.org).toBe('influx-vue')
    expect(parsed.connection?.bucket).toBe('demo-metrics')
    expect(parsed.connection?.authMethod).toBe('password')
    expect(parsed.connection?.username).toBe('influx')
  })

  it('handles missing connection gracefully', () => {
    const parsed = parseDashboardYaml(`
version: 1
name: Dashboard without connection
columns: 2
panels: []
`)

    expect(parsed.name).toBe('Dashboard without connection')
    expect(parsed.connection).toBeUndefined()
  })
})
