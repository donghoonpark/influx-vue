<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NFlex,
  NGi,
  NGrid,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import InfluxResultChart from '@/components/InfluxResultChart.vue'
import InfluxResultTable from '@/components/InfluxResultTable.vue'
import {
  createDashboardDefinition,
  serializeDashboardToYaml,
} from '@/services/influx/dashboard'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const resultTab = ref<'chart' | 'table' | 'yaml' | 'dashboard'>('chart')
const yamlDraft = ref('')

const currentYamlDefinition = computed(() => {
  if (props.workbench.dashboardPanels.value.length > 0) {
    return props.workbench.dashboardDefinition.value
  }

  const currentPanel = props.workbench.createCurrentPanelSnapshot({
    title: props.workbench.selectedMeasurement.value
      ? `${props.workbench.selectedMeasurement.value} preview`
      : 'Current selection',
    visualization: 'split',
  })

  return createDashboardDefinition({
    name: currentPanel
      ? 'Current workbench state'
      : 'Influx explorer dashboard',
    description: currentPanel
      ? 'Single-panel snapshot generated from the active explorer selection.'
      : '',
    columns: props.workbench.dashboardColumns.value,
    panels: currentPanel ? [currentPanel] : [],
  })
})

const serializedYaml = computed(() =>
  serializeDashboardToYaml(currentYamlDefinition.value),
)

const isYamlDirty = computed(() => yamlDraft.value !== serializedYaml.value)

const dashboardGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.workbench.dashboardColumns.value}, minmax(0, 1fr))`,
}))

watch(
  serializedYaml,
  (nextValue, previousValue) => {
    if (!yamlDraft.value.trim() || yamlDraft.value === previousValue) {
      yamlDraft.value = nextValue
    }
  },
  { immediate: true },
)

function syncYamlFromState() {
  yamlDraft.value = serializedYaml.value
}

async function applyYamlAsDashboard() {
  const loaded = props.workbench.importDashboardYaml(yamlDraft.value)
  if (!loaded) {
    return
  }

  resultTab.value = 'dashboard'
  if (props.workbench.dashboardPanels.value.length > 0) {
    await props.workbench.runDashboardPanels()
  }
}

async function saveCurrentSelection() {
  const panel = props.workbench.addCurrentSelectionToDashboard({
    visualization: 'split',
  })
  if (!panel) {
    return
  }

  resultTab.value = 'dashboard'
  if (!props.workbench.dashboardPanelRows.value[panel.id]) {
    await props.workbench.runDashboardPanel(panel.id)
  }
}

function dashboardRows(panelId: string) {
  return props.workbench.dashboardPanelRows.value[panelId] ?? []
}
</script>

<template>
  <div class="panel-shell">
    <div class="panel-header">
      <h2 class="panel-title">ResultPanel</h2>

      <NFlex :size="8">
        <NTag type="info">{{
          workbench.selectedBucket.value || 'bucket pending'
        }}</NTag>
        <NTag type="success">
          {{ workbench.selectedMeasurement.value || 'measurement pending' }}
        </NTag>
      </NFlex>
    </div>

    <NAlert
      :title="workbench.status.value.title"
      :type="workbench.status.value.type"
      :bordered="false"
    >
      {{ workbench.status.value.message }}
    </NAlert>

    <NGrid :cols="4" :x-gap="12" :y-gap="12">
      <NGi>
        <NStatistic label="Rows" :value="workbench.summary.value.rowCount" />
      </NGi>
      <NGi>
        <NStatistic
          label="Series"
          :value="workbench.summary.value.seriesCount"
        />
      </NGi>
      <NGi>
        <NStatistic
          label="Dashboard panels"
          :value="workbench.dashboardPanels.value.length"
        />
      </NGi>
      <NGi>
        <NStatistic
          label="Selected fields"
          :value="workbench.selectedFields.value.length"
        />
      </NGi>
    </NGrid>

    <NTabs v-model:value="resultTab" type="line" animated>
      <NTabPane name="chart" tab="Chart">
        <InfluxResultChart :rows="workbench.rows.value" />
      </NTabPane>

      <NTabPane name="table" tab="Table">
        <InfluxResultTable :rows="workbench.rows.value" />
      </NTabPane>

      <NTabPane name="yaml" tab="YAML">
        <div class="yaml-shell">
          <div class="yaml-toolbar">
            <NFlex :size="8">
              <NTag v-if="isYamlDirty" type="warning">Unsaved edits</NTag>
              <NButton secondary size="small" @click="syncYamlFromState()">
                Load current state
              </NButton>
              <NButton secondary size="small" @click="saveCurrentSelection()">
                Save current panel
              </NButton>
              <NButton
                type="primary"
                size="small"
                @click="applyYamlAsDashboard()"
              >
                Apply as dashboard
              </NButton>
            </NFlex>
          </div>

          <textarea
            v-model="yamlDraft"
            class="code-editor yaml-editor"
            placeholder="Dashboard YAML will appear here."
          />
        </div>
      </NTabPane>

      <NTabPane name="dashboard" tab="Dashboard">
        <div
          v-if="workbench.dashboardPanels.value.length === 0"
          class="dashboard-empty"
        >
          <NEmpty
            description="Use the YAML tab or save the current selection to create a dashboard."
          />
        </div>

        <div v-else class="dashboard-grid" :style="dashboardGridStyle">
          <NCard
            v-for="panel in workbench.dashboardPanels.value"
            :key="panel.id"
            class="dashboard-card"
            :bordered="false"
          >
            <div class="dashboard-card-header">
              <div>
                <h3 class="dashboard-title">{{ panel.title }}</h3>
                <p v-if="panel.description" class="dashboard-description">
                  {{ panel.description }}
                </p>
              </div>

              <NFlex :size="8">
                <NButton
                  tertiary
                  size="small"
                  @click="workbench.loadDashboardPanel(panel.id)"
                >
                  Load
                </NButton>
                <NButton
                  tertiary
                  size="small"
                  :loading="workbench.isDashboardPanelRunning(panel.id)"
                  @click="workbench.runDashboardPanel(panel.id)"
                >
                  Refresh
                </NButton>
                <NButton
                  tertiary
                  type="error"
                  size="small"
                  @click="workbench.removeDashboardPanel(panel.id)"
                >
                  Remove
                </NButton>
              </NFlex>
            </div>

            <NFlex class="dashboard-tags" :size="8">
              <NTag type="info">{{ panel.query.bucket }}</NTag>
              <NTag type="success">{{ panel.query.measurement }}</NTag>
              <NTag type="warning">{{ panel.visualization }}</NTag>
            </NFlex>

            <NAlert
              v-if="workbench.dashboardPanelErrors.value[panel.id]"
              type="error"
              :bordered="false"
              title="Panel query failed"
              class="dashboard-error"
            >
              {{ workbench.dashboardPanelErrors.value[panel.id] }}
            </NAlert>

            <div class="dashboard-visuals">
              <InfluxResultChart
                v-if="panel.visualization !== 'table'"
                :rows="dashboardRows(panel.id)"
              />
              <InfluxResultTable
                v-if="panel.visualization !== 'chart'"
                :rows="dashboardRows(panel.id)"
              />
            </div>
          </NCard>
        </div>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.panel-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-title {
  margin: 0 0 8px;
  font-size: 1.4rem;
}

.yaml-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.yaml-toolbar,
.dashboard-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.code-editor {
  width: 100%;
  min-height: 420px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 20px;
  padding: 18px;
  resize: vertical;
  background: #0f172a;
  color: #e2e8f0;
  font:
    500 0.94rem/1.6 'SFMono-Regular',
    'Consolas',
    'Menlo',
    monospace;
}

.code-editor:focus {
  outline: none;
}

.dashboard-empty {
  padding: 18px 0;
}

.dashboard-grid {
  display: grid;
  gap: 16px;
}

.dashboard-card {
  border-radius: 22px;
  min-width: 0;
}

.dashboard-title {
  margin: 0;
  font-size: 1.02rem;
}

.dashboard-description {
  margin: 6px 0 0;
  color: rgba(71, 85, 105, 0.88);
}

.dashboard-tags,
.dashboard-error {
  margin: 14px 0;
}

.dashboard-visuals {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1200px) {
  .panel-header,
  .yaml-toolbar,
  .dashboard-card-header {
    flex-direction: column;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
