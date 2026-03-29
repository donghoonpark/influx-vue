import { computed, reactive, ref, shallowRef } from 'vue'

import {
  AGGREGATE_FUNCTIONS,
  buildFluxQuery,
  RANGE_PRESETS,
  SCHEMA_LOOKBACK,
} from '@/services/influx/flux'
import {
  hasBlockingFluxValidationIssues,
  summarizeFluxValidationIssues,
  validateFluxQuery,
} from '@/services/influx/fluxValidation'
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
import {
  authenticateBrowserInfluxConnection,
  createBrowserInfluxDataSource,
} from '@/services/influx/browserDataSource'
import type { FluxAutocompleteSchema } from '@/services/influx/fluxAutocomplete'
import type {
  AggregateFunction,
  InfluxAuthMethod,
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

const DEFAULT_AUTH_METHOD: InfluxAuthMethod = 'token'
const LOCAL_DEMO_CONFIG: InfluxConnectionConfig = {
  url: 'http://127.0.0.1:4173',
  org: 'influx-vue',
  token: 'influx-vue-admin-token',
  bucket: 'demo-metrics',
  authMethod: DEFAULT_AUTH_METHOD,
  username: '',
  password: '',
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
    const parsed = JSON.parse(raw) as Partial<InfluxConnectionConfig>

    return {
      url: parsed.url ?? '',
      org: parsed.org ?? '',
      token: parsed.token ?? '',
      bucket: parsed.bucket,
      authMethod: parsed.authMethod ?? DEFAULT_AUTH_METHOD,
      username: parsed.username ?? '',
      password: '',
    }
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

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      url: config.url,
      org: config.org,
      token:
        (config.authMethod ?? DEFAULT_AUTH_METHOD) === 'token'
          ? config.token
          : '',
      bucket: config.bucket,
      authMethod: config.authMethod ?? DEFAULT_AUTH_METHOD,
      username: config.username ?? '',
      password: '',
    } satisfies InfluxConnectionConfig),
  )
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

function unionStringsInOrder(values: string[][]): string[] {
  return uniqueStringsInOrder(values.flat())
}

function snapshotConnection(
  connection: InfluxConnectionConfig,
): InfluxConnectionConfig {
  return {
    url: connection.url,
    org: connection.org,
    token: connection.token,
    bucket: connection.bucket,
    authMethod: connection.authMethod ?? DEFAULT_AUTH_METHOD,
    username: connection.username ?? '',
    password: connection.password ?? '',
  }
}

function sanitizeConnectionSnapshot(
  connection: InfluxConnectionConfig,
): InfluxConnectionConfig {
  const snapshot = snapshotConnection(connection)

  return {
    ...snapshot,
    token: snapshot.authMethod === 'password' ? '' : snapshot.token,
    password: '',
  }
}

function resolveLocalDemoConfig(): InfluxConnectionConfig {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return { ...LOCAL_DEMO_CONFIG }
  }

  return {
    ...LOCAL_DEMO_CONFIG,
    url: window.location.origin,
  }
}

interface CachedMeasurementSchema {
  fields: string[]
  tagKeys: string[]
  tagValuesByKey: Record<string, string[]>
}

export interface UseInfluxWorkbenchOptions {
  createDataSource?: (
    config: InfluxConnectionConfig,
  ) => InfluxExplorerDataSource
  authenticateConnection?: (
    config: InfluxConnectionConfig,
  ) => Promise<InfluxConnectionConfig>
}

export function useInfluxWorkbench(options: UseInfluxWorkbenchOptions = {}) {
  const createDataSource =
    options.createDataSource ?? createBrowserInfluxDataSource
  const authenticateConnection =
    options.authenticateConnection ?? authenticateBrowserInfluxConnection
  const storedConnection = readStoredConnection()
  const localDemoConfig = resolveLocalDemoConfig()

  const connection = reactive<InfluxConnectionConfig>({
    ...localDemoConfig,
    ...storedConnection,
    authMethod:
      storedConnection?.authMethod ??
      localDemoConfig.authMethod ??
      DEFAULT_AUTH_METHOD,
    username: storedConnection?.username ?? '',
    password: '',
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
  const bucketMeasurementsCache = ref<Record<string, string[]>>({})
  const measurementSchemaCache = ref<
    Record<string, Record<string, CachedMeasurementSchema>>
  >({})

  const selectedBucket = ref(connection.bucket ?? '')
  const selectedMeasurement = ref('')
  const selectedMeasurements = ref<string[]>([])
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
  const selectedMeasurementLabel = computed(() => {
    if (selectedMeasurements.value.length === 0) {
      return ''
    }

    if (selectedMeasurements.value.length === 1) {
      return selectedMeasurements.value[0]
    }

    return `${selectedMeasurements.value[0]} +${selectedMeasurements.value.length - 1}`
  })

  const generatedFlux = computed(() => {
    if (
      !selectedBucket.value ||
      selectedMeasurements.value.length === 0 ||
      selectedFields.value.length === 0
    ) {
      return ''
    }

    try {
      return buildFluxQuery({
        bucket: selectedBucket.value,
        measurement: selectedMeasurement.value,
        measurements: selectedMeasurements.value,
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
      selectedMeasurements.value.length > 0 &&
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
    const nextDemoConfig = resolveLocalDemoConfig()

    Object.assign(connection, nextDemoConfig)
    selectedBucket.value = nextDemoConfig.bucket ?? ''
    status.value = createStatusMessage(
      'info',
      'Loaded local preset',
      'Use docker compose and the seed script to start a local demo InfluxDB instance behind the app proxy.',
    )
  }

  function clearSchemaCache() {
    bucketMeasurementsCache.value = {}
    measurementSchemaCache.value = {}
  }

  function cacheBucketMeasurements(
    bucketName: string,
    nextMeasurements: string[],
  ) {
    bucketMeasurementsCache.value = {
      ...bucketMeasurementsCache.value,
      [bucketName]: [...nextMeasurements],
    }
  }

  function readBucketMeasurements(bucketName: string): string[] {
    return bucketMeasurementsCache.value[bucketName] ?? []
  }

  function cacheMeasurementSchema(
    bucketName: string,
    measurement: string,
    input: Partial<CachedMeasurementSchema>,
  ) {
    const nextBucketSchemas = {
      ...(measurementSchemaCache.value[bucketName] ?? {}),
    }
    const currentSchema = nextBucketSchemas[measurement] ?? {
      fields: [],
      tagKeys: [],
      tagValuesByKey: {},
    }

    nextBucketSchemas[measurement] = {
      fields: input.fields ? [...input.fields] : currentSchema.fields,
      tagKeys: input.tagKeys ? [...input.tagKeys] : currentSchema.tagKeys,
      tagValuesByKey: input.tagValuesByKey
        ? {
            ...currentSchema.tagValuesByKey,
            ...input.tagValuesByKey,
          }
        : currentSchema.tagValuesByKey,
    }

    measurementSchemaCache.value = {
      ...measurementSchemaCache.value,
      [bucketName]: nextBucketSchemas,
    }
  }

  function readMeasurementSchema(
    bucketName: string,
    measurement: string,
  ): CachedMeasurementSchema {
    return (
      measurementSchemaCache.value[bucketName]?.[measurement] ?? {
        fields: [],
        tagKeys: [],
        tagValuesByKey: {},
      }
    )
  }

  function setSelectedMeasurements(
    nextMeasurements: string[],
    preferredMeasurement = '',
  ) {
    const normalizedMeasurements = uniqueStringsInOrder(nextMeasurements)

    selectedMeasurements.value = normalizedMeasurements
    selectedMeasurement.value =
      normalizedMeasurements.find(
        (measurement) => measurement === preferredMeasurement,
      ) ??
      normalizedMeasurements[0] ??
      ''
  }

  function clearMeasurementState() {
    measurements.value = []
    fieldKeys.value = []
    tagKeys.value = []
    tagValueOptions.value = {}
    selectedMeasurement.value = ''
    selectedMeasurements.value = []
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
      connection: sanitizeConnectionSnapshot(failedConnection),
      phase,
    }

    dataSource.value = null
    health.value = null
    buckets.value = []
    clearSchemaCache()
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
      measurements: [...selectedMeasurements.value],
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

  async function ensureCombinedMeasurementSchema(
    bucketName: string,
    nextMeasurements: string[],
  ): Promise<CachedMeasurementSchema> {
    const resolvedMeasurements = uniqueStringsInOrder(nextMeasurements)

    if (!bucketName || resolvedMeasurements.length === 0) {
      return {
        fields: [],
        tagKeys: [],
        tagValuesByKey: {},
      }
    }

    const schemas = await Promise.all(
      resolvedMeasurements.map((measurement) =>
        ensureMeasurementSchema(bucketName, measurement),
      ),
    )

    return {
      fields: unionStringsInOrder(schemas.map((schema) => schema.fields)),
      tagKeys: unionStringsInOrder(schemas.map((schema) => schema.tagKeys)),
      tagValuesByKey: Object.fromEntries(
        unionStringsInOrder(schemas.map((schema) => schema.tagKeys)).map(
          (tagKey) => [
            tagKey,
            unionStringsInOrder(
              schemas.map((schema) => schema.tagValuesByKey[tagKey] ?? []),
            ),
          ],
        ),
      ),
    }
  }

  function isDashboardPanelRunning(panelId: string) {
    return dashboardPanelLoadingIds.value.includes(panelId)
  }

  async function ensureBucketMeasurements(
    bucketName: string,
  ): Promise<string[]> {
    if (!dataSource.value || !bucketName) {
      return []
    }

    const cachedMeasurements = readBucketMeasurements(bucketName)
    if (cachedMeasurements.length > 0) {
      return cachedMeasurements
    }

    const nextMeasurements = await dataSource.value.listMeasurements({
      bucket: bucketName,
      start: SCHEMA_LOOKBACK,
    })

    cacheBucketMeasurements(bucketName, nextMeasurements)
    return nextMeasurements
  }

  async function ensureMeasurementSchema(
    bucketName: string,
    measurement: string,
  ): Promise<CachedMeasurementSchema> {
    if (!dataSource.value || !bucketName || !measurement) {
      return {
        fields: [],
        tagKeys: [],
        tagValuesByKey: {},
      }
    }

    const cachedSchema = readMeasurementSchema(bucketName, measurement)
    if (cachedSchema.fields.length > 0 || cachedSchema.tagKeys.length > 0) {
      return cachedSchema
    }

    const [fields, tags] = await Promise.all([
      dataSource.value.listFieldKeys({
        bucket: bucketName,
        measurement,
        start: SCHEMA_LOOKBACK,
      }),
      dataSource.value.listTagKeys({
        bucket: bucketName,
        measurement,
        start: SCHEMA_LOOKBACK,
      }),
    ])

    cacheMeasurementSchema(bucketName, measurement, {
      fields,
      tagKeys: tags,
    })

    return readMeasurementSchema(bucketName, measurement)
  }

  async function ensureTagValues(
    bucketName: string,
    measurement: string,
    tagKey: string,
  ): Promise<string[]> {
    if (!dataSource.value || !bucketName || !measurement || !tagKey) {
      return []
    }

    const cachedValues = readMeasurementSchema(bucketName, measurement)
      .tagValuesByKey[tagKey]
    if (cachedValues) {
      return cachedValues
    }

    const nextValues = await dataSource.value.listTagValues({
      bucket: bucketName,
      measurement,
      tagKey,
      start: SCHEMA_LOOKBACK,
    })

    cacheMeasurementSchema(bucketName, measurement, {
      tagValuesByKey: {
        [tagKey]: nextValues,
      },
    })

    return nextValues
  }

  function syncMeasurementStateFromCache(
    bucketName: string,
    nextMeasurements: string[],
    options: {
      preserveSelectedFields?: boolean
      preserveTagFilters?: boolean
    } = {},
  ) {
    const selectedSchema = uniqueStringsInOrder(nextMeasurements).map(
      (measurement) => readMeasurementSchema(bucketName, measurement),
    )

    const combinedFields = unionStringsInOrder(
      selectedSchema.map((schema) => schema.fields),
    )
    const combinedTagKeys = unionStringsInOrder(
      selectedSchema.map((schema) => schema.tagKeys),
    )
    const combinedTagValueOptions = Object.fromEntries(
      combinedTagKeys.map((tagKey) => [
        tagKey,
        unionStringsInOrder(
          selectedSchema.map((schema) => schema.tagValuesByKey[tagKey] ?? []),
        ),
      ]),
    )

    fieldKeys.value = combinedFields
    selectedFields.value = options.preserveSelectedFields
      ? intersectSelections(selectedFields.value, combinedFields)
      : [...combinedFields]
    if (selectedFields.value.length === 0 && combinedFields.length > 0) {
      selectedFields.value = [combinedFields[0]]
    }

    tagKeys.value = combinedTagKeys
    tagFilters.value = options.preserveTagFilters
      ? tagFilters.value.filter((filter) =>
          combinedTagKeys.includes(filter.tagKey),
        )
      : []
    tagValueOptions.value = combinedTagValueOptions
  }

  async function loadTagValues(tagKey: string) {
    if (
      !selectedBucket.value ||
      selectedMeasurements.value.length === 0 ||
      !tagKey
    ) {
      return
    }

    const values = unionStringsInOrder(
      await Promise.all(
        selectedMeasurements.value.map((measurement) =>
          ensureTagValues(selectedBucket.value, measurement, tagKey),
        ),
      ),
    )

    tagValueOptions.value = {
      ...tagValueOptions.value,
      [tagKey]: values,
    }
  }

  async function hydrateMeasurements(
    nextMeasurements: string[],
    preferredMeasurement = '',
  ) {
    if (!selectedBucket.value) {
      return
    }

    const resolvedMeasurements = uniqueStringsInOrder(nextMeasurements)

    setSelectedMeasurements(resolvedMeasurements, preferredMeasurement)

    if (resolvedMeasurements.length === 0) {
      fieldKeys.value = []
      tagKeys.value = []
      tagValueOptions.value = {}
      selectedFields.value = []
      tagFilters.value = []
      clearResults()
      if (!rawFlux.value.trim()) {
        rawFlux.value = ''
      }
      return
    }

    isSchemaLoading.value = true
    clearResults()

    try {
      await ensureCombinedMeasurementSchema(
        selectedBucket.value,
        resolvedMeasurements,
      )
      syncMeasurementStateFromCache(
        selectedBucket.value,
        resolvedMeasurements,
        {
          preserveSelectedFields: true,
          preserveTagFilters: true,
        },
      )

      if (!rawFlux.value.trim()) {
        rawFlux.value = generatedFlux.value
      }
    } finally {
      isSchemaLoading.value = false
    }
  }

  async function selectMeasurement(measurement: string) {
    await hydrateMeasurements([measurement], measurement)
  }

  async function toggleMeasurement(measurement: string) {
    const nextMeasurements = selectedMeasurements.value.includes(measurement)
      ? selectedMeasurements.value.filter((value) => value !== measurement)
      : [...selectedMeasurements.value, measurement]

    await hydrateMeasurements(nextMeasurements, measurement)
  }

  async function hydrateBucket(
    bucketName: string,
    options: { preserveMeasurements?: boolean } = {},
  ) {
    if (!dataSource.value || !bucketName) {
      clearMeasurementState()
      return
    }

    isSchemaLoading.value = true
    const previousMeasurements = options.preserveMeasurements
      ? [...selectedMeasurements.value]
      : []
    clearMeasurementState()
    clearResults()

    try {
      const bucketMeasurements = await ensureBucketMeasurements(bucketName)

      measurements.value = bucketMeasurements
      const nextMeasurements = options.preserveMeasurements
        ? intersectSelections(previousMeasurements, bucketMeasurements)
        : []
      const fallbackMeasurement =
        nextMeasurements[0] ?? bucketMeasurements[0] ?? ''

      if (nextMeasurements.length > 0) {
        await hydrateMeasurements(nextMeasurements, nextMeasurements[0])
      } else if (fallbackMeasurement) {
        await hydrateMeasurements([fallbackMeasurement], fallbackMeasurement)
      }
    } finally {
      isSchemaLoading.value = false
    }
  }

  async function connect() {
    const requestedConnection = snapshotConnection(connection)
    lastConnectionFailure.value = null

    const authMethod = connection.authMethod ?? DEFAULT_AUTH_METHOD
    const isPasswordAuth = authMethod === 'password'
    const hasRequiredCredentials = isPasswordAuth
      ? Boolean(
          connection.url.trim() &&
          connection.org.trim() &&
          (connection.token.trim() ||
            (connection.username?.trim() && connection.password)),
        )
      : Boolean(
          connection.url.trim() &&
          connection.org.trim() &&
          connection.token.trim(),
        )

    if (!hasRequiredCredentials) {
      const error = new Error(
        isPasswordAuth
          ? 'Provide the InfluxDB URL, organization, and username/password before connecting.'
          : 'Provide the InfluxDB URL, organization, and token before connecting.',
      )
      lastConnectionFailure.value = {
        error,
        connection: sanitizeConnectionSnapshot(requestedConnection),
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
      let authenticatedConnection: InfluxConnectionConfig

      try {
        authenticatedConnection =
          await authenticateConnection(requestedConnection)
      } catch (error) {
        setConnectionFailure('auth', error, requestedConnection)
        return false
      }

      const nextDataSource = createDataSource(authenticatedConnection)
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
      clearSchemaCache()

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

      connection.authMethod = authenticatedConnection.authMethod
      connection.token = authenticatedConnection.token
      connection.username = authenticatedConnection.username ?? ''
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
    if (connection.authMethod === 'password') {
      connection.token = ''
    }
    clearSchemaCache()
    status.value = createStatusMessage(
      'info',
      'Disconnected',
      'Disconnected from InfluxDB. Current explorer state remains visible until you reconnect.',
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

    await hydrateBucket(selectedBucket.value, {
      preserveMeasurements: true,
    })
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
        'Select a bucket, at least one measurement, and a field before running a query.',
      )
      return false
    }

    const validationIssues = validateFluxQuery(currentFlux.value)
    if (hasBlockingFluxValidationIssues(validationIssues)) {
      status.value = createStatusMessage(
        'error',
        'Query validation failed',
        summarizeFluxValidationIssues(validationIssues),
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

  async function resolveFluxAutocompleteSchema(input: {
    bucket?: string
    measurement?: string
    tagKey?: string
  }): Promise<FluxAutocompleteSchema> {
    const bucketName = input.bucket?.trim() || selectedBucket.value
    const selectedMeasurementNames = input.measurement?.trim()
      ? [input.measurement.trim()]
      : bucketName === selectedBucket.value
        ? [...selectedMeasurements.value]
        : []
    const bucketNames = buckets.value.map((bucket) => bucket.name)

    let nextMeasurements =
      bucketName === selectedBucket.value
        ? [...measurements.value]
        : readBucketMeasurements(bucketName)

    if (dataSource.value && bucketName && nextMeasurements.length === 0) {
      nextMeasurements = await ensureBucketMeasurements(bucketName)
    }

    const isSelectedMeasurementContext =
      bucketName === selectedBucket.value &&
      selectedMeasurementNames.length === selectedMeasurements.value.length &&
      selectedMeasurementNames.every((measurement, index) => {
        return measurement === selectedMeasurements.value[index]
      })

    let nextFields = isSelectedMeasurementContext ? [...fieldKeys.value] : []
    let nextTagKeys = isSelectedMeasurementContext ? [...tagKeys.value] : []
    let nextTagValuesByKey = isSelectedMeasurementContext
      ? { ...tagValueOptions.value }
      : {}

    if (dataSource.value && bucketName && selectedMeasurementNames.length > 0) {
      const cachedSchema = await ensureCombinedMeasurementSchema(
        bucketName,
        selectedMeasurementNames,
      )
      nextFields = [...cachedSchema.fields]
      nextTagKeys = [...cachedSchema.tagKeys]
      nextTagValuesByKey = { ...cachedSchema.tagValuesByKey }

      if (
        input.tagKey &&
        (nextTagValuesByKey[input.tagKey]?.length ?? 0) === 0
      ) {
        nextTagValuesByKey = {
          ...nextTagValuesByKey,
          [input.tagKey]: unionStringsInOrder(
            await Promise.all(
              selectedMeasurementNames.map((measurement) =>
                ensureTagValues(bucketName, measurement, input.tagKey!),
              ),
            ),
          ),
        }
      }
    }

    return {
      buckets: bucketNames,
      measurements: nextMeasurements,
      fields: nextFields,
      tagKeys: nextTagKeys,
      tagValuesByKey: nextTagValuesByKey,
      aggregateFunctions: AGGREGATE_FUNCTIONS,
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
        'Pick a bucket, at least one measurement, and at least one field before saving a panel.',
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

    const panelMeasurements = uniqueStringsInOrder([
      ...(panel.query.measurements ?? []),
      panel.query.measurement,
    ])

    if (dataSource.value && panelMeasurements.length > 0) {
      const availableMeasurements = intersectSelections(
        panelMeasurements,
        measurements.value,
      )

      if (availableMeasurements.length > 0) {
        await hydrateMeasurements(
          availableMeasurements,
          panel.query.measurement || availableMeasurements[0],
        )
      } else {
        setSelectedMeasurements(panelMeasurements, panel.query.measurement)
      }
    } else {
      setSelectedMeasurements(panelMeasurements, panel.query.measurement)
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
    selectedMeasurementLabel,
    selectedMeasurements,
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
    toggleMeasurement,
    refreshSchema,
    addTagFilter,
    updateTagFilterKey,
    updateTagFilterValues,
    removeTagFilter,
    syncQueryFromExplorer,
    updateQueryText,
    setQueryMode,
    runQuery,
    resolveFluxAutocompleteSchema,
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
