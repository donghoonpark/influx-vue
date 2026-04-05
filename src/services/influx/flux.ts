import type {
  AggregateFunction,
  InfluxFieldValueKind,
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

export interface BuildFluxQueryOptions {
  fieldKinds?: Partial<Record<string, InfluxFieldValueKind>>
}

const RANGE_PRESET_LOOKUP = Object.fromEntries(
  RANGE_PRESETS.map((preset) => [preset.key, preset]),
)

function uniqueStringsInOrder(values: string[]): string[] {
  const result: string[] = []

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      if (!result.includes(value)) {
        result.push(value)
      }
    })

  return result
}

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

export function buildFieldKindsFlux(
  bucket: string,
  measurement: string,
  start: string,
): string {
  return [
    `from(bucket: ${quoteFluxString(bucket)})`,
    `  |> range(start: ${start})`,
    `  |> filter(fn: (r) => r._measurement == ${quoteFluxString(measurement)})`,
    '  |> keep(columns: ["_time", "_field", "_value"])',
    '  |> group(columns: ["_field"])',
    '  |> sort(columns: ["_time"], desc: true)',
    '  |> limit(n: 1)',
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

export function resolveMeasurementSelection(
  state: QueryBuilderState,
): string[] {
  const selectedMeasurements = uniqueStringsInOrder([
    ...(state.measurements ?? []),
    state.measurement,
  ])

  return selectedMeasurements
}

function buildMeasurementFilter(measurements: string[]): string {
  if (measurements.length === 1) {
    return `  |> filter(fn: (r) => r._measurement == ${quoteFluxString(measurements[0])})`
  }

  const conditions = measurements
    .map((measurement) => `r._measurement == ${quoteFluxString(measurement)}`)
    .join(' or ')

  return `  |> filter(fn: (r) => ${conditions})`
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

function buildBasePipelineLines(
  state: QueryBuilderState,
  measurements: string[],
  fields: string[],
): string[] {
  const start = resolveRangeStart(state.rangePreset, state.customStart)
  const stop = resolveRangeStop(state.rangePreset, state.customStop)
  const lines = [
    `from(bucket: ${quoteFluxString(state.bucket)})`,
    stop
      ? `  |> range(start: ${start}, stop: ${stop})`
      : `  |> range(start: ${start})`,
    buildMeasurementFilter(measurements),
    buildFieldFilter(fields),
  ]

  state.tagFilters
    .map(buildTagFilterLine)
    .filter((line): line is string => Boolean(line))
    .forEach((line) => lines.push(line))

  return lines
}

function buildAggregateLine(
  aggregateWindow: string,
  aggregateFunction: AggregateFunction,
): string {
  return `  |> aggregateWindow(every: ${aggregateWindow.trim()}, fn: ${aggregateFunction}, createEmpty: false)`
}

function buildFinalQueryLines(lines: string[], limit: number): string[] {
  const nextLines = [...lines, '  |> sort(columns: ["_time"])']

  if (limit > 0) {
    nextLines.push(`  |> limit(n: ${limit})`)
  }

  return nextLines
}

function buildStreamAssignment(name: string, lines: string[]): string[] {
  return lines.map((line, index) => {
    if (index === 0) {
      return `${name} = ${line}`
    }

    return line
  })
}

function splitFieldsForAggregation(
  fields: string[],
  fieldKinds?: Partial<Record<string, InfluxFieldValueKind>>,
): {
  numericFields: string[]
  passthroughFields: string[]
} {
  if (!fieldKinds || Object.keys(fieldKinds).length === 0) {
    return {
      numericFields: [...fields],
      passthroughFields: [],
    }
  }

  return fields.reduce(
    (result, field) => {
      if (fieldKinds[field] === 'number') {
        result.numericFields.push(field)
      } else {
        result.passthroughFields.push(field)
      }

      return result
    },
    {
      numericFields: [] as string[],
      passthroughFields: [] as string[],
    },
  )
}

export function resolveAggregationPassthroughFields(
  state: QueryBuilderState,
  options: BuildFluxQueryOptions = {},
): string[] {
  const shouldAggregate =
    state.aggregateFunction !== 'none' && state.aggregateWindow.trim().length > 0

  if (!shouldAggregate) {
    return []
  }

  return splitFieldsForAggregation(state.fields, options.fieldKinds)
    .passthroughFields
}

export function buildFluxQuery(
  state: QueryBuilderState,
  options: BuildFluxQueryOptions = {},
): string {
  if (!state.bucket.trim()) {
    throw new Error('A bucket must be selected before building a query.')
  }
  const measurements = resolveMeasurementSelection(state)
  if (measurements.length === 0) {
    throw new Error(
      'At least one measurement must be selected before building a query.',
    )
  }
  if (state.fields.length === 0) {
    throw new Error('Select at least one field before running a query.')
  }

  const shouldAggregate =
    state.aggregateFunction !== 'none' && state.aggregateWindow.trim().length > 0

  if (!shouldAggregate) {
    return buildFinalQueryLines(
      buildBasePipelineLines(state, measurements, state.fields),
      state.limit,
    ).join('\n')
  }

  const { numericFields, passthroughFields } = splitFieldsForAggregation(
    state.fields,
    options.fieldKinds,
  )

  if (passthroughFields.length === 0) {
    return buildFinalQueryLines(
      [
        ...buildBasePipelineLines(state, measurements, numericFields),
        buildAggregateLine(state.aggregateWindow, state.aggregateFunction),
      ],
      state.limit,
    ).join('\n')
  }

  if (numericFields.length === 0) {
    return buildFinalQueryLines(
      buildBasePipelineLines(state, measurements, passthroughFields),
      state.limit,
    ).join('\n')
  }

  const lines = [
    ...buildStreamAssignment(
      'aggregated',
      [
        ...buildBasePipelineLines(state, measurements, numericFields),
        buildAggregateLine(state.aggregateWindow, state.aggregateFunction),
      ],
    ),
    '',
    ...buildStreamAssignment(
      'passthrough',
      buildBasePipelineLines(state, measurements, passthroughFields),
    ),
    '',
    ...buildFinalQueryLines(
      ['union(tables: [aggregated, passthrough])'],
      state.limit,
    ),
  ]

  return lines.join('\n')
}
