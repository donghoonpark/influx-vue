import { computed, reactive, ref, shallowRef } from 'vue'

import {
  AGGREGATE_FUNCTIONS,
  buildFluxQuery,
  RANGE_PRESETS,
  SCHEMA_LOOKBACK,
} from '@/services/influx/flux'
import {
  buildDashboardPanelFlux,
  createDashboardDefinition,
  createDashboardPanel,
  parseDashboardYaml,
  type InfluxDashboardColumns,
  type InfluxDashboardPanelDefinition,
  type InfluxPanelVisualization,
} from '@/services/influx/dashboard'
import { summarizeRows } from '@/services/influx/resultTransforms'
import { createBrowserInfluxDataSource } from '@/services/influx/browserDataSource'
import type {
  AggregateFunction,
  InfluxBucket,
  InfluxConnectionConfig,
  InfluxConnectionFailure,
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

function snapshotConnection(
  connection: InfluxConnectionConfig,
): InfluxConnectionConfig {
  return {
    url: connection.url,
    org: connection.org,
    token: connection.token,
    bucket: connection.bucket,
  }
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
  const lastConnectionFailure = ref<InfluxConnectionFailure | null>(null)

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
  const aggregateWindow = ref('1s')
  const aggregateFunction = ref<AggregateFunction>('mean')
  const limit = ref(2000)
  const rawFlux = ref('')

  const rows = ref<InfluxRow[]>([])
  const hasExecutedQuery = ref(false)
  const dashboardName = ref('Influx explorer dashboard')
  const dashboardDescription = ref('')
  const dashboardColumns = ref<InfluxDashboardColumns>(2)
  const dashboardPanels = ref<InfluxDashboardPanelDefinition[]>([])
  const dashboardPanelRows = ref<Record<string, InfluxRow[]>>({})
  const dashboardPanelErrors = ref<Record<string, string>>({})
  const dashboardPanelLoadingIds = ref<string[]>([])
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
  const dashboardDefinition = computed(() =>
    createDashboardDefinition({
      name: dashboardName.value,
      description: dashboardDescription.value,
      columns: dashboardColumns.value,
      panels: dashboardPanels.value,
    }),
  )
  const hasExplorerSelection = computed(
    () =>
      Boolean(selectedBucket.value) &&
      Boolean(selectedMeasurement.value) &&
      selectedFields.value.length > 0,
  )

  const canRunQuery = computed(
    () =>
      Boolean(dataSource.value) &&
      hasExplorerSelection.value &&
      Boolean(currentFlux.value),
  )

  const aggregateFunctionOptions = AGGREGATE_FUNCTIONS.map((value) => ({
    label: value === 'none' ? 'None' : value,
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

  function setConnectionFailure(
    phase: InfluxConnectionFailure['phase'],
    error: unknown,
    failedConnection: InfluxConnectionConfig,
  ) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error))

    lastConnectionFailure.value = {
      error: normalizedError,
      connection: failedConnection,
      phase,
    }

    dataSource.value = null
    health.value = null
    buckets.value = []
    clearMeasurementState()

    status.value = createStatusMessage(
      'error',
      'Connection failed',
      normalizedError.message || 'Unknown connection error.',
    )
  }

  function clearDashboardPanelArtifacts(panelId?: string) {
    if (!panelId) {
      dashboardPanelRows.value = {}
      dashboardPanelErrors.value = {}
      dashboardPanelLoadingIds.value = []
      return
    }

    const nextRows = { ...dashboardPanelRows.value }
    delete nextRows[panelId]
    dashboardPanelRows.value = nextRows

    const nextErrors = { ...dashboardPanelErrors.value }
    delete nextErrors[panelId]
    dashboardPanelErrors.value = nextErrors

    dashboardPanelLoadingIds.value = dashboardPanelLoadingIds.value.filter(
      (activeId) => activeId !== panelId,
    )
  }

  function buildCurrentQueryState() {
    return {
      bucket: selectedBucket.value,
      measurement: selectedMeasurement.value,
      fields: [...selectedFields.value],
      rangePreset: rangePreset.value,
      customStart: customStart.value,
      customStop: customStop.value,
      aggregateWindow: aggregateWindow.value,
      aggregateFunction: aggregateFunction.value,
      limit: limit.value,
      tagFilters: tagFilters.value.map((filter) => ({
        tagKey: filter.tagKey,
        values: [...filter.values],
      })),
    }
  }

  function isDashboardPanelRunning(panelId: string) {
    return dashboardPanelLoadingIds.value.includes(panelId)
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
    const requestedConnection = snapshotConnection(connection)
    lastConnectionFailure.value = null

    if (
      !connection.url.trim() ||
      !connection.org.trim() ||
      !connection.token.trim()
    ) {
      const error = new Error(
        'Provide the InfluxDB URL, organization, and token before connecting.',
      )
      lastConnectionFailure.value = {
        error,
        connection: requestedConnection,
        phase: 'validation',
      }
      status.value = createStatusMessage(
        'warning',
        'Missing connection details',
        error.message,
      )
      return false
    }

    isConnecting.value = true

    try {
      const nextDataSource = createDataSource(requestedConnection)
      let nextHealth: InfluxPingResult

      try {
        nextHealth = await nextDataSource.ping()
      } catch (error) {
        setConnectionFailure('ping', error, requestedConnection)
        return false
      }

      let nextBuckets: InfluxBucket[]

      try {
        nextBuckets = await nextDataSource.listBuckets()
      } catch (error) {
        setConnectionFailure('schema', error, requestedConnection)
        return false
      }

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
      try {
        await hydrateBucket(nextBucket)
      } catch (error) {
        setConnectionFailure('schema', error, {
          ...requestedConnection,
          bucket: nextBucket,
        })
        return false
      }
      writeStoredConnection({ ...connection })
      lastConnectionFailure.value = null

      status.value = createStatusMessage(
        'success',
        'Connection established',
        `Connected to ${nextHealth.name ?? 'InfluxDB'} and loaded ${nextBuckets.length} bucket(s).`,
      )
      return true
    } catch (error) {
      setConnectionFailure('schema', error, requestedConnection)
      return false
    } finally {
      isConnecting.value = false
    }
  }

  function disconnect() {
    dataSource.value = null
    health.value = null
    lastConnectionFailure.value = null
    status.value = createStatusMessage(
      'info',
      'Disconnected',
      'Disconnected from InfluxDB. Current explorer state remains visible.',
    )
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

  function syncQueryFromExplorer(force = true) {
    if (!generatedFlux.value) {
      return
    }

    if (force || !rawFlux.value.trim()) {
      rawFlux.value = generatedFlux.value
    }

    queryMode.value = 'builder'
  }

  function updateQueryText(value: string) {
    rawFlux.value = value
    queryMode.value = value.trim() ? 'raw' : 'builder'
  }

  function setQueryMode(mode: QueryMode) {
    queryMode.value = mode

    if (mode === 'raw' && !rawFlux.value.trim()) {
      rawFlux.value = generatedFlux.value
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

    try {
      rows.value = await dataSource.value.queryRows(currentFlux.value)
      hasExecutedQuery.value = true
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

  function createCurrentPanelSnapshot(input: {
    title?: string
    description?: string
    visualization?: InfluxPanelVisualization
  }) {
    if (!hasExplorerSelection.value) {
      return null
    }

    return createDashboardPanel({
      title: input.title,
      description: input.description,
      visualization: input.visualization,
      queryMode: queryMode.value,
      query: buildCurrentQueryState(),
      rawFlux: rawFlux.value,
    })
  }

  function addCurrentSelectionToDashboard(input: {
    title?: string
    description?: string
    visualization?: InfluxPanelVisualization
  }) {
    const panel = createCurrentPanelSnapshot(input)
    if (!panel) {
      status.value = createStatusMessage(
        'warning',
        'Panel is incomplete',
        'Pick a bucket, measurement, and at least one field before saving a panel.',
      )
      return null
    }

    dashboardPanels.value = [...dashboardPanels.value, panel]

    if (
      hasExecutedQuery.value &&
      currentFlux.value &&
      currentFlux.value === buildDashboardPanelFlux(panel)
    ) {
      dashboardPanelRows.value = {
        ...dashboardPanelRows.value,
        [panel.id]: [...rows.value],
      }
    }

    status.value = createStatusMessage(
      'success',
      'Panel saved',
      `Saved "${panel.title}" to the dashboard library.`,
    )

    return panel
  }

  function removeDashboardPanel(panelId: string) {
    dashboardPanels.value = dashboardPanels.value.filter(
      (panel) => panel.id !== panelId,
    )
    clearDashboardPanelArtifacts(panelId)
  }

  function updateDashboardMeta(input: {
    name?: string
    description?: string
    columns?: InfluxDashboardColumns
  }) {
    if (typeof input.name === 'string') {
      dashboardName.value = input.name
    }
    if (typeof input.description === 'string') {
      dashboardDescription.value = input.description
    }
    if (input.columns) {
      dashboardColumns.value = input.columns
    }
  }

  function replaceDashboardDefinition(
    nextDefinition: ReturnType<typeof createDashboardDefinition>,
  ) {
    dashboardName.value = nextDefinition.name
    dashboardDescription.value = nextDefinition.description
    dashboardColumns.value = nextDefinition.columns
    dashboardPanels.value = [...nextDefinition.panels]

    const allowedIds = new Set(nextDefinition.panels.map((panel) => panel.id))

    dashboardPanelRows.value = Object.fromEntries(
      Object.entries(dashboardPanelRows.value).filter(([panelId]) =>
        allowedIds.has(panelId),
      ),
    )
    dashboardPanelErrors.value = Object.fromEntries(
      Object.entries(dashboardPanelErrors.value).filter(([panelId]) =>
        allowedIds.has(panelId),
      ),
    )
    dashboardPanelLoadingIds.value = dashboardPanelLoadingIds.value.filter(
      (panelId) => allowedIds.has(panelId),
    )
  }

  function importDashboardYaml(source: string) {
    try {
      const parsed = parseDashboardYaml(source)
      replaceDashboardDefinition(parsed)
      status.value = createStatusMessage(
        'success',
        'Dashboard loaded',
        `Loaded ${parsed.panels.length} panel(s) from YAML.`,
      )
      return true
    } catch (error) {
      status.value = createStatusMessage(
        'error',
        'Dashboard YAML is invalid',
        error instanceof Error ? error.message : 'Unknown YAML parsing error.',
      )
      return false
    }
  }

  async function runDashboardPanel(panelId: string) {
    if (!dataSource.value) {
      status.value = createStatusMessage(
        'warning',
        'Connect first',
        'The dashboard can only run after the workbench connects to InfluxDB.',
      )
      return false
    }

    const panel = dashboardPanels.value.find((item) => item.id === panelId)
    if (!panel) {
      return false
    }

    dashboardPanelLoadingIds.value = [
      ...new Set([...dashboardPanelLoadingIds.value, panelId]),
    ]

    try {
      const nextRows = await dataSource.value.queryRows(
        buildDashboardPanelFlux(panel),
      )

      dashboardPanelRows.value = {
        ...dashboardPanelRows.value,
        [panelId]: nextRows,
      }

      const nextErrors = { ...dashboardPanelErrors.value }
      delete nextErrors[panelId]
      dashboardPanelErrors.value = nextErrors

      status.value = createStatusMessage(
        nextRows.length > 0 ? 'success' : 'warning',
        `Panel refreshed: ${panel.title}`,
        nextRows.length > 0
          ? `Fetched ${nextRows.length} row(s) for the panel.`
          : 'The panel query ran successfully, but it returned no rows.',
      )

      return true
    } catch (error) {
      dashboardPanelErrors.value = {
        ...dashboardPanelErrors.value,
        [panelId]:
          error instanceof Error ? error.message : 'Unknown panel query error.',
      }
      status.value = createStatusMessage(
        'error',
        `Panel failed: ${panel.title}`,
        error instanceof Error ? error.message : 'Unknown panel query error.',
      )
      return false
    } finally {
      dashboardPanelLoadingIds.value = dashboardPanelLoadingIds.value.filter(
        (activeId) => activeId !== panelId,
      )
    }
  }

  async function runDashboardPanels() {
    if (dashboardPanels.value.length === 0) {
      status.value = createStatusMessage(
        'warning',
        'No dashboard panels',
        'Save or import at least one panel before running the dashboard.',
      )
      return false
    }

    let hasSuccess = false
    for (const panel of dashboardPanels.value) {
      const panelSucceeded = await runDashboardPanel(panel.id)
      hasSuccess = panelSucceeded || hasSuccess
    }

    return hasSuccess
  }

  async function loadDashboardPanel(panelId: string) {
    const panel = dashboardPanels.value.find((item) => item.id === panelId)
    if (!panel) {
      return false
    }

    if (dataSource.value && panel.query.bucket) {
      await selectBucket(panel.query.bucket)
    } else {
      selectedBucket.value = panel.query.bucket
      connection.bucket = panel.query.bucket
    }

    if (dataSource.value && panel.query.measurement) {
      if (measurements.value.includes(panel.query.measurement)) {
        await selectMeasurement(panel.query.measurement)
      } else {
        selectedMeasurement.value = panel.query.measurement
      }
    } else {
      selectedMeasurement.value = panel.query.measurement
    }

    selectedFields.value = [...panel.query.fields]
    rangePreset.value = panel.query.rangePreset
    customStart.value = panel.query.customStart
    customStop.value = panel.query.customStop
    aggregateWindow.value = panel.query.aggregateWindow
    aggregateFunction.value = panel.query.aggregateFunction
    limit.value = panel.query.limit
    tagFilters.value = panel.query.tagFilters.map((filter) => ({
      tagKey: filter.tagKey,
      values: [...filter.values],
    }))
    queryMode.value = panel.queryMode
    rawFlux.value = panel.rawFlux
    clearResults()

    if (tagFilters.value.length > 0) {
      await Promise.all(
        tagFilters.value.map((filter) => loadTagValues(filter.tagKey)),
      )
    }

    status.value = createStatusMessage(
      'info',
      'Panel loaded into the editor',
      `Loaded "${panel.title}" back into the query builder.`,
    )

    return true
  }

  return {
    connection,
    health,
    lastConnectionFailure,
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
    dashboardName,
    dashboardDescription,
    dashboardColumns,
    dashboardPanels,
    dashboardPanelRows,
    dashboardPanelErrors,
    dashboardDefinition,
    summary,
    generatedFlux,
    currentFlux,
    hasConnection,
    hasExplorerSelection,
    canRunQuery,
    isConnecting,
    isSchemaLoading,
    isQueryRunning,
    loadLocalDemoPreset,
    connect,
    disconnect,
    selectBucket,
    selectMeasurement,
    refreshSchema,
    addTagFilter,
    updateTagFilterKey,
    updateTagFilterValues,
    removeTagFilter,
    syncQueryFromExplorer,
    updateQueryText,
    setQueryMode,
    runQuery,
    isDashboardPanelRunning,
    updateDashboardMeta,
    addCurrentSelectionToDashboard,
    createCurrentPanelSnapshot,
    removeDashboardPanel,
    importDashboardYaml,
    runDashboardPanel,
    runDashboardPanels,
    loadDashboardPanel,
  }
}

export type InfluxWorkbenchController = ReturnType<typeof useInfluxWorkbench>
