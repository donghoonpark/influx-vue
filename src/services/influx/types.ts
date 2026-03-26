export type InfluxScalar = string | number | boolean | null

export interface InfluxConnectionConfig {
  url: string
  org: string
  token: string
  bucket?: string
}

export type InfluxConnectPhase = 'validation' | 'ping' | 'schema'

export interface InfluxConnectionFailure {
  error: Error
  connection: InfluxConnectionConfig
  phase: InfluxConnectPhase
}

export interface InfluxPingResult {
  name?: string
  message?: string
  status?: string
  version?: string
}

export interface InfluxBucket {
  id: string
  name: string
  description?: string
  retentionSeconds: number | null
}

export interface InfluxRow {
  result?: string
  table?: number
  _time?: string
  _measurement?: string
  _field?: string
  _value?: InfluxScalar
  [key: string]: InfluxScalar | undefined
}

export interface InfluxSchemaRequest {
  bucket: string
  start: string
}

export interface InfluxMeasurementRequest extends InfluxSchemaRequest {
  measurement: string
}

export interface InfluxTagValuesRequest extends InfluxMeasurementRequest {
  tagKey: string
}

export interface InfluxExplorerDataSource {
  ping(): Promise<InfluxPingResult>
  listBuckets(): Promise<InfluxBucket[]>
  listMeasurements(request: InfluxSchemaRequest): Promise<string[]>
  listFieldKeys(request: InfluxMeasurementRequest): Promise<string[]>
  listTagKeys(request: InfluxMeasurementRequest): Promise<string[]>
  listTagValues(request: InfluxTagValuesRequest): Promise<string[]>
  queryRows(flux: string): Promise<InfluxRow[]>
}

export interface TagFilter {
  tagKey: string
  values: string[]
}

export type AggregateFunction =
  | 'none'
  | 'mean'
  | 'sum'
  | 'max'
  | 'min'
  | 'last'
  | 'count'

export type QueryMode = 'builder' | 'raw'

export type RangePresetKey =
  | 'last_1h'
  | 'last_6h'
  | 'last_24h'
  | 'last_7d'
  | 'last_30d'
  | 'custom'

export interface QueryBuilderState {
  bucket: string
  measurement: string
  fields: string[]
  rangePreset: RangePresetKey
  customStart: string
  customStop: string
  aggregateWindow: string
  aggregateFunction: AggregateFunction
  limit: number
  tagFilters: TagFilter[]
}

export interface ChartSeriesPoint {
  time: string
  value: number
}

export interface ChartSeries {
  key: string
  name: string
  points: ChartSeriesPoint[]
}

export interface QuerySummary {
  rowCount: number
  numericRowCount: number
  seriesCount: number
  firstTimestamp?: string
  lastTimestamp?: string
}

export interface StatusMessage {
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
}
