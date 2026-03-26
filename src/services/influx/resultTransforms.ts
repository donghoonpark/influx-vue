import type {
  ChartSeries,
  InfluxRow,
  InfluxScalar,
  QuerySummary,
} from '@/services/influx/types'

const RESERVED_ROW_KEYS = new Set([
  'result',
  'table',
  '_start',
  '_stop',
  '_time',
  '_measurement',
  '_field',
  '_value',
])

function toComparableString(value: InfluxScalar | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return String(value)
}

export function extractValueList(rows: InfluxRow[]): string[] {
  const values = rows
    .map((row) => toComparableString(row._value))
    .filter((value): value is string => Boolean(value))

  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function buildSeriesLabel(row: InfluxRow): { key: string; name: string } {
  const base = row._field ?? 'value'
  const tagEntries = Object.entries(row)
    .filter(
      ([key, value]) =>
        !RESERVED_ROW_KEYS.has(key) && value !== null && value !== undefined,
    )
    .sort(([left], [right]) => left.localeCompare(right))

  if (tagEntries.length === 0) {
    return { key: base, name: base }
  }

  const suffix = tagEntries.map(([key, value]) => `${key}=${value}`).join(', ')
  return {
    key: `${base}|${suffix}`,
    name: `${base} · ${suffix}`,
  }
}

export function rowsToChartSeries(rows: InfluxRow[]): ChartSeries[] {
  const seriesMap = new Map<string, ChartSeries>()

  rows.forEach((row) => {
    if (typeof row._value !== 'number' || !row._time) {
      return
    }

    const label = buildSeriesLabel(row)
    const series = seriesMap.get(label.key) ?? {
      key: label.key,
      name: label.name,
      points: [],
    }

    series.points.push({
      time: row._time,
      value: row._value,
    })

    seriesMap.set(label.key, series)
  })

  return [...seriesMap.values()].map((series) => ({
    ...series,
    points: [...series.points].sort((left, right) =>
      left.time.localeCompare(right.time),
    ),
  }))
}

export function summarizeRows(rows: InfluxRow[]): QuerySummary {
  const timestamps = rows
    .map((row) => row._time)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right))

  const chartSeries = rowsToChartSeries(rows)

  return {
    rowCount: rows.length,
    numericRowCount: rows.filter((row) => typeof row._value === 'number')
      .length,
    seriesCount: chartSeries.length,
    firstTimestamp: timestamps[0],
    lastTimestamp: timestamps[timestamps.length - 1],
  }
}

export function collectColumnKeys(rows: InfluxRow[]): string[] {
  const keys = new Set<string>()

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key))
  })

  return [...keys].sort((left, right) => {
    const leftReserved = left.startsWith('_')
    const rightReserved = right.startsWith('_')
    if (leftReserved && !rightReserved) {
      return -1
    }
    if (!leftReserved && rightReserved) {
      return 1
    }

    return left.localeCompare(right)
  })
}

export function formatScalarValue(value: InfluxScalar | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }

  return String(value)
}
