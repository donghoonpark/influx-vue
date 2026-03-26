import { describe, expect, it } from 'vitest'

import {
  buildDashboardPanelFlux,
  createDashboardDefinition,
  createDashboardPanel,
  parseDashboardYaml,
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

    expect(parsed.name).toBe('Operations overview')
    expect(parsed.columns).toBe(3)
    expect(parsed.panels).toHaveLength(1)
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
})
