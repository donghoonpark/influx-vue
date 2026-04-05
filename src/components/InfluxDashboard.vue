<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import { RefreshOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NCard, NEmpty, NFlex, NSpin, NTag, NText } from 'naive-ui'

import InfluxResultChart from '@/components/InfluxResultChart.vue'
import InfluxResultTable from '@/components/InfluxResultTable.vue'
import {
  buildDashboardPanelFlux,
  createDashboardDefinition,
  parseDashboardYaml,
  type InfluxDashboardDefinition,
  type InfluxDashboardPanelDefinition,
} from '@/services/influx/dashboard'
import {
  authenticateBrowserInfluxConnection,
  createBrowserInfluxDataSource,
} from '@/services/influx/browserDataSource'
import { summarizeRows } from '@/services/influx/resultTransforms'
import type {
  InfluxConnectionConfig,
  InfluxExplorerDataSource,
  InfluxRow,
  StatusMessage,
} from '@/services/influx/types'
import type {
  InfluxDashboardExposed,
  InfluxDashboardProps,
} from '@/components/dashboard/types'
import { renderNaiveIcon } from '@/utils/renderNaiveIcon'

const props = withDefaults(defineProps<InfluxDashboardProps>(), {
  autoRun: true,
  connectionOverride: undefined,
  createDataSource: undefined,
  authenticateConnection: undefined,
})

const createDataSource =
  props.createDataSource ?? createBrowserInfluxDataSource
const authenticateConnection =
  props.authenticateConnection ?? authenticateBrowserInfluxConnection

const definition = ref<InfluxDashboardDefinition>(createDashboardDefinition())
const dataSource = shallowRef<InfluxExplorerDataSource | null>(null)
const rowsByPanelId = ref<Record<string, InfluxRow[]>>({})
const errorsByPanelId = ref<Record<string, string>>({})
const loadingPanelIds = ref<string[]>([])
const isConnecting = ref(false)
const isRefreshing = ref(false)
const yamlError = ref<string | null>(null)
const status = ref<StatusMessage | null>(null)

const dashboardGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(definition.value.columns, 1)}, minmax(0, 1fr))`,
}))

function clearPanelArtifacts() {
  rowsByPanelId.value = {}
  errorsByPanelId.value = {}
  loadingPanelIds.value = []
}

function createStatusMessage(
  type: StatusMessage['type'],
  title: string,
  message: string,
): StatusMessage {
  return { type, title, message }
}

function resolveConnectionConfig(): InfluxConnectionConfig | null {
  const dashboardConnection = definition.value.connection
  const override = props.connectionOverride ?? {}

  const authMethod = override.authMethod ?? dashboardConnection?.authMethod ?? 'token'

  const config: InfluxConnectionConfig = {
    url: override.url ?? dashboardConnection?.url ?? '',
    org: override.org ?? dashboardConnection?.org ?? '',
    token: override.token ?? dashboardConnection?.token ?? '',
    bucket: override.bucket ?? dashboardConnection?.bucket,
    authMethod,
    username: override.username ?? dashboardConnection?.username ?? '',
    password: override.password ?? '',
  }

  if (!config.url.trim() || !config.org.trim()) {
    return null
  }

  return config
}

async function connect(): Promise<boolean> {
  const connection = resolveConnectionConfig()

  if (!connection) {
    dataSource.value = null
    status.value = createStatusMessage(
      'warning',
      'Connection missing',
      'The dashboard YAML needs connection.url and connection.org, or a connectionOverride prop.',
    )
    return false
  }

  isConnecting.value = true

  try {
    const authenticatedConnection = await authenticateConnection(connection)
    const nextDataSource = createDataSource(authenticatedConnection)
    await nextDataSource.ping()
    dataSource.value = nextDataSource
    status.value = createStatusMessage(
      'success',
      'Dashboard connected',
      `Connected to ${authenticatedConnection.org} and ready to run ${definition.value.panels.length} panel(s).`,
    )
    return true
  } catch (error) {
    dataSource.value = null
    status.value = createStatusMessage(
      'error',
      'Dashboard connection failed',
      error instanceof Error ? error.message : String(error),
    )
    return false
  } finally {
    isConnecting.value = false
  }
}

function isPanelLoading(panelId: string) {
  return loadingPanelIds.value.includes(panelId)
}

async function runPanel(panel: InfluxDashboardPanelDefinition): Promise<boolean> {
  if (!dataSource.value) {
    return false
  }

  loadingPanelIds.value = [...new Set([...loadingPanelIds.value, panel.id])]

  try {
    const nextRows = await dataSource.value.queryRows(buildDashboardPanelFlux(panel))
    rowsByPanelId.value = {
      ...rowsByPanelId.value,
      [panel.id]: nextRows,
    }

    const nextErrors = { ...errorsByPanelId.value }
    delete nextErrors[panel.id]
    errorsByPanelId.value = nextErrors
    return true
  } catch (error) {
    errorsByPanelId.value = {
      ...errorsByPanelId.value,
      [panel.id]: error instanceof Error ? error.message : String(error),
    }
    return false
  } finally {
    loadingPanelIds.value = loadingPanelIds.value.filter((activeId) => activeId !== panel.id)
  }
}

async function refresh(): Promise<boolean> {
  if (definition.value.panels.length === 0) {
    status.value = createStatusMessage(
      'info',
      'No dashboard panels',
      'The provided YAML does not define any panels yet.',
    )
    clearPanelArtifacts()
    return false
  }

  const connected = await connect()
  if (!connected) {
    clearPanelArtifacts()
    return false
  }

  isRefreshing.value = true
  clearPanelArtifacts()

  try {
    let hasSuccess = false

    for (const panel of definition.value.panels) {
      const panelSucceeded = await runPanel(panel)
      hasSuccess = hasSuccess || panelSucceeded
    }

    status.value = createStatusMessage(
      hasSuccess ? 'success' : 'warning',
      hasSuccess ? 'Dashboard refreshed' : 'Dashboard returned no data',
      hasSuccess
        ? `Rendered ${definition.value.panels.length} panel(s) from the provided YAML.`
        : 'The dashboard YAML loaded, but no panel produced rows.',
    )

    return hasSuccess
  } finally {
    isRefreshing.value = false
  }
}

async function syncDashboardDefinition() {
  clearPanelArtifacts()
  yamlError.value = null

  try {
    definition.value = parseDashboardYaml(props.yaml)
  } catch (error) {
    dataSource.value = null
    definition.value = createDashboardDefinition()
    yamlError.value = error instanceof Error ? error.message : String(error)
    status.value = createStatusMessage(
      'error',
      'Dashboard YAML is invalid',
      yamlError.value,
    )
    return
  }

  if (props.autoRun) {
    await refresh()
  } else {
    status.value = createStatusMessage(
      'info',
      'Dashboard ready',
      `Loaded ${definition.value.panels.length} panel(s) from YAML.`,
    )
  }
}

function panelStatus(panelId: string) {
  const rows = rowsByPanelId.value[panelId] ?? []
  if (errorsByPanelId.value[panelId]) {
    return { type: 'error' as const, label: 'Error' }
  }
  if (isPanelLoading(panelId)) {
    return { type: 'warning' as const, label: 'Loading' }
  }
  if (rows.length > 0) {
    return { type: 'success' as const, label: `${rows.length} rows` }
  }
  return { type: 'default' as const, label: 'Idle' }
}

function panelSummary(panelId: string) {
  return summarizeRows(rowsByPanelId.value[panelId] ?? [])
}

watch(
  () => [props.yaml, props.connectionOverride] as const,
  async () => {
    await syncDashboardDefinition()
  },
  { immediate: true, deep: true },
)

defineExpose<InfluxDashboardExposed>({
  connect,
  refresh,
  getDefinition: () => definition.value,
})
</script>

<template>
  <div class="dashboard-shell">
    <NCard :bordered="false" class="dashboard-header">
      <NFlex align="center" justify="space-between" wrap :size="12">
        <div class="dashboard-meta">
          <div class="dashboard-title-row">
            <strong>{{ definition.name }}</strong>
            <NTag size="small" :type="dataSource ? 'success' : 'default'">
              {{ dataSource ? 'Connected' : 'Disconnected' }}
            </NTag>
            <NTag size="small" type="info">
              {{ definition.panels.length }} panels
            </NTag>
          </div>
          <NText v-if="definition.description" depth="3">
            {{ definition.description }}
          </NText>
        </div>

        <NButton
          secondary
          size="small"
          :loading="isRefreshing || isConnecting"
          :render-icon="renderNaiveIcon(RefreshOutline)"
          @click="refresh()"
        >
          Refresh
        </NButton>
      </NFlex>
    </NCard>

    <NAlert
      v-if="yamlError"
      type="error"
      title="Dashboard YAML is invalid"
      :bordered="false"
    >
      {{ yamlError }}
    </NAlert>

    <NAlert
      v-else-if="status"
      :type="status.type"
      :title="status.title"
      :bordered="false"
    >
      {{ status.message }}
    </NAlert>

    <NEmpty
      v-if="!yamlError && definition.panels.length === 0"
      description="This dashboard YAML does not define any panels."
    />

    <div
      v-else-if="!yamlError"
      class="dashboard-grid"
      :style="dashboardGridStyle"
    >
      <NCard
        v-for="panel in definition.panels"
        :key="panel.id"
        size="small"
        class="dashboard-panel"
      >
        <template #header>
          <div class="panel-header">
            <strong>{{ panel.title }}</strong>
            <NTag size="small" :type="panelStatus(panel.id).type">
              {{ panelStatus(panel.id).label }}
            </NTag>
          </div>
        </template>

        <template #header-extra>
          <NTag size="small" type="default">
            {{ panel.visualization }}
          </NTag>
        </template>

        <NText v-if="panel.description" depth="3" class="panel-description">
          {{ panel.description }}
        </NText>

        <NAlert
          v-if="errorsByPanelId[panel.id]"
          type="error"
          title="Panel query failed"
          :bordered="false"
          class="panel-alert"
        >
          {{ errorsByPanelId[panel.id] }}
        </NAlert>

        <NSpin :show="isPanelLoading(panel.id)">
          <div class="panel-content">
            <InfluxResultChart
              v-if="panel.visualization === 'chart'"
              :rows="rowsByPanelId[panel.id] ?? []"
            />

            <InfluxResultChart
              v-else-if="panel.visualization === 'scatter'"
              :rows="rowsByPanelId[panel.id] ?? []"
              visualization="scatter"
            />

            <InfluxResultTable
              v-else-if="panel.visualization === 'table'"
              :rows="rowsByPanelId[panel.id] ?? []"
            />

            <div v-else class="split-panel">
              <InfluxResultChart :rows="rowsByPanelId[panel.id] ?? []" />
              <InfluxResultTable :rows="rowsByPanelId[panel.id] ?? []" />
            </div>
          </div>
        </NSpin>

        <div class="panel-footer">
          <NText depth="3">
            Rows {{ panelSummary(panel.id).rowCount }} · Series {{ panelSummary(panel.id).seriesCount }}
          </NText>
        </div>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.dashboard-header :deep(.n-card__content) {
  padding: 12px 14px;
}

.dashboard-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dashboard-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dashboard-grid {
  display: grid;
  gap: 12px;
}

.dashboard-panel {
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.panel-description {
  display: block;
  margin-bottom: 10px;
}

.panel-alert {
  margin-bottom: 10px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.split-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-footer {
  margin-top: 10px;
}

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}
</style>
