import type {
  AggregateFunction,
  QueryBuilderState,
  RangePresetKey,
  TagFilter,
} from '@/services/influx/types'

export interface RangePresetDefinition {
  key: RangePresetKey
  label: string
  start: string
}

export const RANGE_PRESETS: RangePresetDefinition[] = [
  { key: 'last_1h', label: 'Last 1 hour', start: '-1h' },
  { key: 'last_6h', label: 'Last 6 hours', start: '-6h' },
  { key: 'last_24h', label: 'Last 24 hours', start: '-24h' },
  { key: 'last_7d', label: 'Last 7 days', start: '-7d' },
  { key: 'last_30d', label: 'Last 30 days', start: '-30d' },
  { key: 'custom', label: 'Custom', start: '' },
]

export const AGGREGATE_FUNCTIONS: AggregateFunction[] = [
  'none',
  'mean',
  'sum',
  'max',
  'min',
  'last',
  'count',
]

export const SCHEMA_LOOKBACK = '-30d'

const RANGE_PRESET_LOOKUP = Object.fromEntries(
  RANGE_PRESETS.map((preset) => [preset.key, preset]),
)

export function quoteFluxString(value: string): string {
  return JSON.stringify(value)
}

export function toFluxTimeExpression(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`)
  }

  return `time(v: ${quoteFluxString(date.toISOString())})`
}

export function resolveRangeStart(
  rangePreset: RangePresetKey,
  customStart: string,
): string {
  if (rangePreset === 'custom') {
    if (!customStart.trim()) {
      throw new Error('A custom start time is required.')
    }

    return toFluxTimeExpression(customStart)
  }

  return RANGE_PRESET_LOOKUP[rangePreset].start
}

export function resolveRangeStop(
  rangePreset: RangePresetKey,
  customStop: string,
): string | undefined {
  if (rangePreset !== 'custom' || !customStop.trim()) {
    return undefined
  }

  return toFluxTimeExpression(customStop)
}

export function buildMeasurementsFlux(bucket: string, start: string): string {
  return [
    'import "influxdata/influxdb/schema"',
    '',
    `schema.measurements(bucket: ${quoteFluxString(bucket)}, start: ${start})`,
    '  |> sort()',
  ].join('\n')
}

export function buildFieldKeysFlux(
  bucket: string,
  measurement: string,
  start: string,
): string {
  return [
    'import "influxdata/influxdb/schema"',
    '',
    'schema.fieldKeys(',
    `  bucket: ${quoteFluxString(bucket)},`,
    `  start: ${start},`,
    `  predicate: (r) => r._measurement == ${quoteFluxString(measurement)},`,
    ')',
    '  |> sort()',
  ].join('\n')
}

export function buildTagKeysFlux(
  bucket: string,
  measurement: string,
  start: string,
): string {
  return [
    'import "influxdata/influxdb/schema"',
    '',
    'schema.tagKeys(',
    `  bucket: ${quoteFluxString(bucket)},`,
    `  start: ${start},`,
    `  predicate: (r) => r._measurement == ${quoteFluxString(measurement)},`,
    ')',
    '  |> filter(fn: (r) => r._value !~ /^_/)',
    '  |> sort()',
  ].join('\n')
}

export function buildTagValuesFlux(
  bucket: string,
  measurement: string,
  tagKey: string,
  start: string,
): string {
  return [
    'import "influxdata/influxdb/schema"',
    '',
    'schema.tagValues(',
    `  bucket: ${quoteFluxString(bucket)},`,
    `  tag: ${quoteFluxString(tagKey)},`,
    `  start: ${start},`,
    `  predicate: (r) => r._measurement == ${quoteFluxString(measurement)},`,
    ')',
    '  |> sort()',
  ].join('\n')
}

function buildFieldFilter(fields: string[]): string {
  if (fields.length === 1) {
    return `  |> filter(fn: (r) => r._field == ${quoteFluxString(fields[0])})`
  }

  const conditions = fields
    .map((field) => `r._field == ${quoteFluxString(field)}`)
    .join(' or ')
  return `  |> filter(fn: (r) => ${conditions})`
}

function buildTagFilterLine(tagFilter: TagFilter): string | null {
  if (!tagFilter.tagKey || tagFilter.values.length === 0) {
    return null
  }

  const conditions = tagFilter.values
    .map(
      (value) =>
        `r[${quoteFluxString(tagFilter.tagKey)}] == ${quoteFluxString(value)}`,
    )
    .join(' or ')

  return `  |> filter(fn: (r) => ${conditions})`
}

export function buildFluxQuery(state: QueryBuilderState): string {
  if (!state.bucket.trim()) {
    throw new Error('A bucket must be selected before building a query.')
  }
  if (!state.measurement.trim()) {
    throw new Error('A measurement must be selected before building a query.')
  }
  if (state.fields.length === 0) {
    throw new Error('Select at least one field before running a query.')
  }

  const start = resolveRangeStart(state.rangePreset, state.customStart)
  const stop = resolveRangeStop(state.rangePreset, state.customStop)

  const lines = [
    `from(bucket: ${quoteFluxString(state.bucket)})`,
    stop
      ? `  |> range(start: ${start}, stop: ${stop})`
      : `  |> range(start: ${start})`,
    `  |> filter(fn: (r) => r._measurement == ${quoteFluxString(state.measurement)})`,
    buildFieldFilter(state.fields),
  ]

  state.tagFilters
    .map(buildTagFilterLine)
    .filter((line): line is string => Boolean(line))
    .forEach((line) => lines.push(line))

  if (state.aggregateFunction !== 'none' && state.aggregateWindow.trim()) {
    lines.push(
      `  |> aggregateWindow(every: ${state.aggregateWindow.trim()}, fn: ${state.aggregateFunction}, createEmpty: false)`,
    )
  }

  lines.push('  |> sort(columns: ["_time"])')

  if (state.limit > 0) {
    lines.push(`  |> limit(n: ${state.limit})`)
  }

  return lines.join('\n')
}
