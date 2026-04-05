import { parse, stringify } from 'yaml'

import { buildFluxQuery } from '@/services/influx/flux'
import type {
  AggregateFunction,
  InfluxAuthMethod,
  InfluxConnectionConfig,
  QueryBuilderState,
  QueryMode,
  RangePresetKey,
  TagFilter,
} from '@/services/influx/types'

export const DASHBOARD_VERSION = 1 as const
export const DASHBOARD_COLUMN_OPTIONS = [1, 2, 3] as const
export const PANEL_VISUALIZATIONS = ['chart', 'scatter', 'table', 'split'] as const

export type InfluxDashboardColumns = (typeof DASHBOARD_COLUMN_OPTIONS)[number]

export type InfluxPanelVisualization = (typeof PANEL_VISUALIZATIONS)[number]

export interface InfluxDashboardConnection {
  url: string
  org: string
  bucket?: string
  authMethod: InfluxAuthMethod
  token?: string
  username?: string
}

export interface InfluxDashboardPanelDefinition {
  id: string
  title: string
  description: string
  visualization: InfluxPanelVisualization
  queryMode: QueryMode
  query: QueryBuilderState
  rawFlux: string
}

export interface InfluxDashboardDefinition {
  version: typeof DASHBOARD_VERSION
  name: string
  description: string
  columns: InfluxDashboardColumns
  panels: InfluxDashboardPanelDefinition[]
  connection?: InfluxDashboardConnection
}

export interface InfluxDashboardTimeRangeOverride {
  rangePreset: RangePresetKey
  customStart: string
  customStop: string
}

export interface CreateDashboardPanelInput {
  id?: string
  title?: string
  description?: string
  visualization?: InfluxPanelVisualization
  queryMode: QueryMode
  query: QueryBuilderState
  rawFlux?: string
}

interface SerializableQueryBuilderState {
  bucket: string
  measurements: string[]
  fields: string[]
  rangePreset: RangePresetKey
  customStart: string
  customStop: string
  aggregateWindow: string
  aggregateFunction: AggregateFunction
  limit: number
  tagFilters: TagFilter[]
}

interface SerializableDashboardPanelDefinition
  extends Omit<InfluxDashboardPanelDefinition, 'query'> {
  query: SerializableQueryBuilderState
}

interface SerializableDashboardDefinition
  extends Omit<InfluxDashboardDefinition, 'panels'> {
  panels: SerializableDashboardPanelDefinition[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map(String).filter((item) => item.trim().length > 0)
}

function toTagFilters(value: unknown): TagFilter[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((filter) => ({
      tagKey: String(filter.tagKey ?? '').trim(),
      values: toStringArray(filter.values),
    }))
    .filter((filter) => filter.tagKey.length > 0)
}

function toRangePreset(value: unknown): RangePresetKey {
  const normalized = String(value ?? 'last_24h')
  const allowedPresets: RangePresetKey[] = [
    'last_1h',
    'last_6h',
    'last_24h',
    'last_7d',
    'last_30d',
    'custom',
  ]

  return allowedPresets.includes(normalized as RangePresetKey)
    ? (normalized as RangePresetKey)
    : 'last_24h'
}

function toAggregateFunction(value: unknown): AggregateFunction {
  const normalized = String(value ?? 'mean')
  const allowed: AggregateFunction[] = [
    'none',
    'mean',
    'sum',
    'max',
    'min',
    'last',
    'count',
  ]

  return allowed.includes(normalized as AggregateFunction)
    ? (normalized as AggregateFunction)
    : 'mean'
}

function toColumns(value: unknown): InfluxDashboardColumns {
  const normalized = Number(value)
  return DASHBOARD_COLUMN_OPTIONS.includes(normalized as InfluxDashboardColumns)
    ? (normalized as InfluxDashboardColumns)
    : 2
}

function createPanelId(title: string): string {
  const prefix =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'panel'

  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`
}

function resolveQueryMeasurements(state: QueryBuilderState): string[] {
  const measurements: string[] = []

  ;[...(state.measurements ?? []), state.measurement]
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      if (!measurements.includes(value)) {
        measurements.push(value)
      }
    })

  return measurements
}

function primaryMeasurementLabel(state: QueryBuilderState): string {
  return resolveQueryMeasurements(state)[0] ?? ''
}

function measurementTitleLabel(state: QueryBuilderState): string {
  const measurements = resolveQueryMeasurements(state)

  if (measurements.length === 0) {
    return 'measurement'
  }

  if (measurements.length === 1) {
    return measurements[0]
  }

  return `${measurements[0]} +${measurements.length - 1}`
}

export function cloneQueryBuilderState(
  state: QueryBuilderState,
): QueryBuilderState {
  return {
    bucket: state.bucket,
    measurement: primaryMeasurementLabel(state),
    measurements: resolveQueryMeasurements(state),
    fields: [...state.fields],
    rangePreset: state.rangePreset,
    customStart: state.customStart,
    customStop: state.customStop,
    aggregateWindow: state.aggregateWindow,
    aggregateFunction: state.aggregateFunction,
    limit: state.limit,
    tagFilters: state.tagFilters.map((filter) => ({
      tagKey: filter.tagKey,
      values: [...filter.values],
    })),
  }
}

function serializeQueryBuilderState(
  state: QueryBuilderState,
): SerializableQueryBuilderState {
  const normalizedState = cloneQueryBuilderState(state)

  return {
    bucket: normalizedState.bucket,
    measurements: resolveQueryMeasurements(normalizedState),
    fields: [...normalizedState.fields],
    rangePreset: normalizedState.rangePreset,
    customStart: normalizedState.customStart,
    customStop: normalizedState.customStop,
    aggregateWindow: normalizedState.aggregateWindow,
    aggregateFunction: normalizedState.aggregateFunction,
    limit: normalizedState.limit,
    tagFilters: normalizedState.tagFilters.map((filter) => ({
      tagKey: filter.tagKey,
      values: [...filter.values],
    })),
  }
}

function normalizeQueryBuilderState(value: unknown): QueryBuilderState {
  const record = isRecord(value) ? value : {}
  const measurements = toStringArray(record.measurements)
  const measurement =
    String(record.measurement ?? '').trim() || measurements[0] || ''

  return {
    bucket: String(record.bucket ?? '').trim(),
    measurement,
    measurements:
      measurements.length > 0
        ? [measurement, ...measurements].filter(
            (value, index, items) =>
              Boolean(value) && items.indexOf(value) === index,
          )
        : measurement
          ? [measurement]
          : [],
    fields: toStringArray(record.fields),
    rangePreset: toRangePreset(record.rangePreset),
    customStart: String(record.customStart ?? ''),
    customStop: String(record.customStop ?? ''),
    aggregateWindow: String(record.aggregateWindow ?? ''),
    aggregateFunction: toAggregateFunction(record.aggregateFunction),
    limit: Number(record.limit ?? 2000) || 2000,
    tagFilters: toTagFilters(record.tagFilters),
  }
}

export function createDashboardPanel(
  input: CreateDashboardPanelInput,
): InfluxDashboardPanelDefinition {
  const query = cloneQueryBuilderState(input.query)
  const title =
    input.title?.trim() ||
    `${measurementTitleLabel(query)} · ${query.fields.join(', ') || 'field'}`

  return {
    id: input.id?.trim() || createPanelId(title),
    title,
    description: input.description?.trim() ?? '',
    visualization: input.visualization ?? 'chart',
    queryMode: input.queryMode,
    query,
    rawFlux: input.rawFlux?.trim() ?? '',
  }
}

function normalizeDashboardPanel(
  value: unknown,
): InfluxDashboardPanelDefinition {
  const record = isRecord(value) ? value : {}
  const query = normalizeQueryBuilderState(record.query)

  return createDashboardPanel({
    id: String(record.id ?? ''),
    title: String(record.title ?? ''),
    description: String(record.description ?? ''),
    visualization: PANEL_VISUALIZATIONS.includes(
      String(record.visualization ?? 'chart') as InfluxPanelVisualization,
    )
      ? (String(record.visualization ?? 'chart') as InfluxPanelVisualization)
      : 'chart',
    queryMode:
      String(record.queryMode ?? 'builder') === 'raw' ? 'raw' : 'builder',
    query,
    rawFlux: String(record.rawFlux ?? ''),
  })
}

export function createDashboardDefinition(
  overrides: Partial<InfluxDashboardDefinition> = {},
): InfluxDashboardDefinition {
  return {
    version: DASHBOARD_VERSION,
    name: overrides.name?.trim() || 'Influx explorer dashboard',
    description: overrides.description?.trim() ?? '',
    columns: toColumns(overrides.columns),
    panels: (overrides.panels ?? []).map((panel) =>
      normalizeDashboardPanel(panel),
    ),
    connection: normalizeConnection(overrides.connection),
  }
}

function normalizeAuthMethod(value: unknown): InfluxAuthMethod {
  const normalized = String(value ?? 'token')
  return normalized === 'password' ? 'password' : 'token'
}

function normalizeConnection(
  value: unknown,
): InfluxDashboardConnection | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const url = String(value.url ?? '').trim()
  const org = String(value.org ?? '').trim()

  if (!url || !org) {
    return undefined
  }

  return {
    url,
    org,
    bucket: value.bucket ? String(value.bucket).trim() : undefined,
    authMethod: normalizeAuthMethod(value.authMethod),
    token: value.token ? String(value.token).trim() : undefined,
    username: value.username ? String(value.username).trim() : undefined,
  }
}

export function normalizeDashboardDefinition(
  value: unknown,
): InfluxDashboardDefinition {
  const record = isRecord(value) ? value : {}

  return createDashboardDefinition({
    name: String(record.name ?? ''),
    description: String(record.description ?? ''),
    columns: record.columns as InfluxDashboardColumns,
    panels: Array.isArray(record.panels) ? record.panels : [],
    connection: normalizeConnection(record.connection),
  })
}

function serializeDashboardDefinition(
  dashboard: InfluxDashboardDefinition,
): SerializableDashboardDefinition {
  const normalized = normalizeDashboardDefinition(dashboard)

  return {
    ...normalized,
    panels: normalized.panels.map((panel) => ({
      ...panel,
      query: serializeQueryBuilderState(panel.query),
    })),
  }
}

export function serializeDashboardToYaml(
  dashboard: InfluxDashboardDefinition,
): string {
  return stringify(serializeDashboardDefinition(dashboard))
}

export function exportDashboardYaml(
  dashboard: InfluxDashboardDefinition,
): string {
  return serializeDashboardToYaml(dashboard)
}

export function createDashboardConnection(
  config: Partial<InfluxConnectionConfig>,
): InfluxDashboardConnection | undefined {
  const url = String(config.url ?? '').trim()
  const org = String(config.org ?? '').trim()

  if (!url || !org) {
    return undefined
  }

  return normalizeConnection({
    url,
    org,
    bucket: config.bucket,
    authMethod: config.authMethod,
    token: config.token,
    username: config.username,
  })
}

function maskToken(token?: string): string | undefined {
  return token?.trim() ? '****' : undefined
}

export function maskDashboardDefinitionSecrets(
  dashboard: InfluxDashboardDefinition,
): InfluxDashboardDefinition {
  const normalized = normalizeDashboardDefinition(dashboard)

  return {
    ...normalized,
    connection: normalized.connection
      ? {
          ...normalized.connection,
          token: maskToken(normalized.connection.token),
        }
      : undefined,
  }
}

export function serializeDashboardToDisplayYaml(
  dashboard: InfluxDashboardDefinition,
): string {
  return stringify(serializeDashboardDefinition(maskDashboardDefinitionSecrets(dashboard)))
}

export function parseDashboardYaml(source: string): InfluxDashboardDefinition {
  const trimmed = source.trim()
  if (!trimmed) {
    return createDashboardDefinition()
  }

  return normalizeDashboardDefinition(parse(trimmed))
}

export function buildDashboardPanelFlux(
  panel: InfluxDashboardPanelDefinition,
  options: {
    timeRangeOverride?: InfluxDashboardTimeRangeOverride
  } = {},
): string {
  if (panel.queryMode === 'raw') {
    return panel.rawFlux.trim() || buildFluxQuery(panel.query)
  }

  const nextQuery = options.timeRangeOverride
    ? {
        ...panel.query,
        rangePreset: options.timeRangeOverride.rangePreset,
        customStart: options.timeRangeOverride.customStart,
        customStop: options.timeRangeOverride.customStop,
      }
    : panel.query

  return buildFluxQuery(nextQuery)
}
