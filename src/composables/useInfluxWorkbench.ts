import { computed, reactive, ref, shallowRef } from 'vue'

import {
  AGGREGATE_FUNCTIONS,
  buildFluxQuery,
  RANGE_PRESETS,
  SCHEMA_LOOKBACK,
} from '@/services/influx/flux'
import { summarizeRows } from '@/services/influx/resultTransforms'
import { createBrowserInfluxDataSource } from '@/services/influx/browserDataSource'
import type {
  AggregateFunction,
  InfluxBucket,
  InfluxConnectionConfig,
  InfluxExplorerDataSource,
  InfluxPingResult,
  InfluxRow,
  QueryMode,
  RangePresetKey,
  StatusMessage,
  TagFilter,
} from '@/services/influx/types'

const LOCAL_DEMO_CONFIG: InfluxConnectionConfig = {
  url: 'http://127.0.0.1:8086',
  org: 'influx-vue',
  token: 'influx-vue-admin-token',
  bucket: 'demo-metrics',
}

const STORAGE_KEY = 'influx-vue/workbench/connection'

function supportsLocalStorage(storage: unknown): storage is Storage {
  return Boolean(
    storage &&
    typeof storage === 'object' &&
    'getItem' in storage &&
    typeof storage.getItem === 'function' &&
    'setItem' in storage &&
    typeof storage.setItem === 'function',
  )
}

function readStoredConnection(): InfluxConnectionConfig | null {
  if (
    typeof window === 'undefined' ||
    !supportsLocalStorage(window.localStorage)
  ) {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as InfluxConnectionConfig
  } catch {
    return null
  }
}

function writeStoredConnection(config: InfluxConnectionConfig) {
  if (
    typeof window === 'undefined' ||
    !supportsLocalStorage(window.localStorage)
  ) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function createStatusMessage(
  type: StatusMessage['type'],
  title: string,
  message: string,
): StatusMessage {
  return { type, title, message }
}

function intersectSelections(values: string[], allowed: string[]): string[] {
  return values.filter((value) => allowed.includes(value))
}

export interface UseInfluxWorkbenchOptions {
  createDataSource?: (
    config: InfluxConnectionConfig,
  ) => InfluxExplorerDataSource
}

export function useInfluxWorkbench(options: UseInfluxWorkbenchOptions = {}) {
  const createDataSource =
    options.createDataSource ?? createBrowserInfluxDataSource
  const storedConnection = readStoredConnection()

  const connection = reactive<InfluxConnectionConfig>({
    ...LOCAL_DEMO_CONFIG,
    ...storedConnection,
  })

  const dataSource = shallowRef<InfluxExplorerDataSource | null>(null)
  const status = ref<StatusMessage>(
    createStatusMessage(
      'info',
      'Ready to connect',
      'Point the workbench at InfluxDB and load your buckets to begin exploring.',
    ),
  )
  const health = ref<InfluxPingResult | null>(null)

  const buckets = ref<InfluxBucket[]>([])
  const measurements = ref<string[]>([])
  const fieldKeys = ref<string[]>([])
  const tagKeys = ref<string[]>([])
  const tagValueOptions = ref<Record<string, string[]>>({})

  const selectedBucket = ref(connection.bucket ?? '')
  const selectedMeasurement = ref('')
  const selectedFields = ref<string[]>([])
  const tagFilters = ref<TagFilter[]>([])

  const queryMode = ref<QueryMode>('builder')
  const rangePreset = ref<RangePresetKey>('last_24h')
  const customStart = ref('')
  const customStop = ref('')
  const aggregateWindow = ref('15m')
  const aggregateFunction = ref<AggregateFunction>('mean')
  const limit = ref(2000)
  const rawFlux = ref('')

  const rows = ref<InfluxRow[]>([])
  const hasExecutedQuery = ref(false)
  const isConnecting = ref(false)
  const isSchemaLoading = ref(false)
  const isQueryRunning = ref(false)

  const hasConnection = computed(() => dataSource.value !== null)
  const summary = computed(() => summarizeRows(rows.value))

  const generatedFlux = computed(() => {
    if (
      !selectedBucket.value ||
      !selectedMeasurement.value ||
      selectedFields.value.length === 0
    ) {
      return ''
    }

    try {
      return buildFluxQuery({
        bucket: selectedBucket.value,
        measurement: selectedMeasurement.value,
        fields: selectedFields.value,
        rangePreset: rangePreset.value,
        customStart: customStart.value,
        customStop: customStop.value,
        aggregateWindow: aggregateWindow.value,
        aggregateFunction: aggregateFunction.value,
        limit: limit.value,
        tagFilters: tagFilters.value,
      })
    } catch {
      return ''
    }
  })

  const currentFlux = computed(() => {
    if (queryMode.value === 'raw') {
      return rawFlux.value.trim() || generatedFlux.value
    }

    return generatedFlux.value
  })

  const canRunQuery = computed(
    () =>
      Boolean(dataSource.value) &&
      Boolean(selectedBucket.value) &&
      Boolean(selectedMeasurement.value) &&
      selectedFields.value.length > 0 &&
      Boolean(currentFlux.value),
  )

  const aggregateFunctionOptions = AGGREGATE_FUNCTIONS.map((value) => ({
    label: value,
    value,
  }))

  const rangePresetOptions = RANGE_PRESETS.map((preset) => ({
    label: preset.label,
    value: preset.key,
  }))

  function loadLocalDemoPreset() {
    Object.assign(connection, LOCAL_DEMO_CONFIG)
    selectedBucket.value = LOCAL_DEMO_CONFIG.bucket ?? ''
    status.value = createStatusMessage(
      'info',
      'Loaded local preset',
      'Use docker compose and the seed script to start a local demo InfluxDB instance.',
    )
  }

  function clearMeasurementState() {
    measurements.value = []
    fieldKeys.value = []
    tagKeys.value = []
    tagValueOptions.value = {}
    selectedMeasurement.value = ''
    selectedFields.value = []
    tagFilters.value = []
  }

  function clearResults() {
    rows.value = []
    hasExecutedQuery.value = false
  }

  async function loadTagValues(tagKey: string) {
    if (
      !dataSource.value ||
      !selectedBucket.value ||
      !selectedMeasurement.value ||
      !tagKey
    ) {
      return
    }

    if (tagValueOptions.value[tagKey]) {
      return
    }

    const values = await dataSource.value.listTagValues({
      bucket: selectedBucket.value,
      measurement: selectedMeasurement.value,
      tagKey,
      start: SCHEMA_LOOKBACK,
    })

    tagValueOptions.value = {
      ...tagValueOptions.value,
      [tagKey]: values,
    }
  }

  async function hydrateMeasurement(measurement: string) {
    if (!dataSource.value || !selectedBucket.value || !measurement) {
      return
    }

    isSchemaLoading.value = true
    clearResults()

    try {
      const [fields, tags] = await Promise.all([
        dataSource.value.listFieldKeys({
          bucket: selectedBucket.value,
          measurement,
          start: SCHEMA_LOOKBACK,
        }),
        dataSource.value.listTagKeys({
          bucket: selectedBucket.value,
          measurement,
          start: SCHEMA_LOOKBACK,
        }),
      ])

      fieldKeys.value = fields
      selectedFields.value = intersectSelections(selectedFields.value, fields)
      if (selectedFields.value.length === 0 && fields.length > 0) {
        selectedFields.value = [fields[0]]
      }

      tagKeys.value = tags
      tagFilters.value = tagFilters.value.filter((filter) =>
        tags.includes(filter.tagKey),
      )
      tagValueOptions.value = Object.fromEntries(
        Object.entries(tagValueOptions.value).filter(([key]) =>
          tags.includes(key),
        ),
      )

      if (!rawFlux.value.trim()) {
        rawFlux.value = generatedFlux.value
      }
    } finally {
      isSchemaLoading.value = false
    }
  }

  async function selectMeasurement(measurement: string) {
    selectedMeasurement.value = measurement
    await hydrateMeasurement(measurement)
  }

  async function hydrateBucket(bucketName: string) {
    if (!dataSource.value || !bucketName) {
      clearMeasurementState()
      return
    }

    isSchemaLoading.value = true
    clearMeasurementState()
    clearResults()

    try {
      const bucketMeasurements = await dataSource.value.listMeasurements({
        bucket: bucketName,
        start: SCHEMA_LOOKBACK,
      })

      measurements.value = bucketMeasurements
      const nextMeasurement = bucketMeasurements[0] ?? ''
      selectedMeasurement.value = nextMeasurement

      if (nextMeasurement) {
        await hydrateMeasurement(nextMeasurement)
      }
    } finally {
      isSchemaLoading.value = false
    }
  }

  async function connect() {
    if (
      !connection.url.trim() ||
      !connection.org.trim() ||
      !connection.token.trim()
    ) {
      status.value = createStatusMessage(
        'warning',
        'Missing connection details',
        'Provide the InfluxDB URL, organization, and token before connecting.',
      )
      return false
    }

    isConnecting.value = true

    try {
      const nextDataSource = createDataSource({ ...connection })
      const [nextHealth, nextBuckets] = await Promise.all([
        nextDataSource.ping(),
        nextDataSource.listBuckets(),
      ])

      dataSource.value = nextDataSource
      health.value = nextHealth
      buckets.value = nextBuckets

      if (nextBuckets.length === 0) {
        selectedBucket.value = ''
        clearMeasurementState()
        status.value = createStatusMessage(
          'warning',
          'Connected, but no buckets were found',
          'The token is valid, but it does not expose any buckets through the API.',
        )
        return false
      }

      const nextBucket =
        nextBuckets.find((bucket) => bucket.name === connection.bucket)?.name ??
        nextBuckets[0].name

      selectedBucket.value = nextBucket
      connection.bucket = nextBucket
      await hydrateBucket(nextBucket)
      writeStoredConnection({ ...connection })

      status.value = createStatusMessage(
        'success',
        'Connection established',
        `Connected to ${nextHealth.name ?? 'InfluxDB'} and loaded ${nextBuckets.length} bucket(s).`,
      )
      return true
    } catch (error) {
      dataSource.value = null
      health.value = null
      buckets.value = []
      clearMeasurementState()
      status.value = createStatusMessage(
        'error',
        'Connection failed',
        error instanceof Error ? error.message : 'Unknown connection error.',
      )
      return false
    } finally {
      isConnecting.value = false
    }
  }

  async function selectBucket(bucketName: string) {
    selectedBucket.value = bucketName
    connection.bucket = bucketName
    await hydrateBucket(bucketName)
  }

  async function refreshSchema() {
    if (!selectedBucket.value) {
      return
    }

    await hydrateBucket(selectedBucket.value)
  }

  async function addTagFilter() {
    const availableKey = tagKeys.value.find(
      (tagKey) => !tagFilters.value.some((filter) => filter.tagKey === tagKey),
    )

    if (!availableKey) {
      return
    }

    tagFilters.value = [
      ...tagFilters.value,
      { tagKey: availableKey, values: [] },
    ]
    await loadTagValues(availableKey)
  }

  async function updateTagFilterKey(index: number, tagKey: string) {
    const nextFilters = [...tagFilters.value]
    nextFilters[index] = {
      tagKey,
      values: [],
    }
    tagFilters.value = nextFilters
    await loadTagValues(tagKey)
  }

  function updateTagFilterValues(index: number, values: string[]) {
    const nextFilters = [...tagFilters.value]
    nextFilters[index] = {
      ...nextFilters[index],
      values,
    }
    tagFilters.value = nextFilters
  }

  function removeTagFilter(index: number) {
    const nextFilters = [...tagFilters.value]
    nextFilters.splice(index, 1)
    tagFilters.value = nextFilters
  }

  function syncRawFluxFromBuilder() {
    if (!rawFlux.value.trim()) {
      rawFlux.value = generatedFlux.value
    }
  }

  function setQueryMode(mode: QueryMode) {
    queryMode.value = mode

    if (mode === 'raw') {
      syncRawFluxFromBuilder()
    }
  }

  async function runQuery() {
    if (!dataSource.value || !currentFlux.value) {
      status.value = createStatusMessage(
        'warning',
        'Query is incomplete',
        'Select a bucket, measurement, and field before running a query.',
      )
      return false
    }

    isQueryRunning.value = true
    hasExecutedQuery.value = true

    try {
      rows.value = await dataSource.value.queryRows(currentFlux.value)
      status.value = createStatusMessage(
        rows.value.length > 0 ? 'success' : 'warning',
        rows.value.length > 0 ? 'Query completed' : 'No data returned',
        rows.value.length > 0
          ? `Fetched ${rows.value.length} row(s) from InfluxDB.`
          : 'The query ran successfully, but the selected range returned no rows.',
      )
      return true
    } catch (error) {
      status.value = createStatusMessage(
        'error',
        'Query failed',
        error instanceof Error ? error.message : 'Unknown query error.',
      )
      return false
    } finally {
      isQueryRunning.value = false
    }
  }

  return {
    connection,
    health,
    status,
    buckets,
    measurements,
    fieldKeys,
    tagKeys,
    tagValueOptions,
    selectedBucket,
    selectedMeasurement,
    selectedFields,
    tagFilters,
    queryMode,
    rangePreset,
    customStart,
    customStop,
    aggregateWindow,
    aggregateFunction,
    aggregateFunctionOptions,
    rangePresetOptions,
    limit,
    rawFlux,
    rows,
    hasExecutedQuery,
    summary,
    generatedFlux,
    currentFlux,
    hasConnection,
    canRunQuery,
    isConnecting,
    isSchemaLoading,
    isQueryRunning,
    loadLocalDemoPreset,
    connect,
    selectBucket,
    selectMeasurement,
    refreshSchema,
    addTagFilter,
    updateTagFilterKey,
    updateTagFilterValues,
    removeTagFilter,
    setQueryMode,
    runQuery,
  }
}

export type InfluxWorkbenchController = ReturnType<typeof useInfluxWorkbench>
