<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NTag,
  NText,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import InfluxResultChart from '@/components/InfluxResultChart.vue'
import InfluxResultTable from '@/components/InfluxResultTable.vue'
import {
  DASHBOARD_COLUMN_OPTIONS,
  PANEL_VISUALIZATIONS,
  serializeDashboardToYaml,
  type InfluxPanelVisualization,
} from '@/services/influx/dashboard'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const panelTitle = ref('')
const panelDescription = ref('')
const panelVisualization = ref<InfluxPanelVisualization>('chart')
const yamlDraft = ref('')

const dashboardColumnOptions = DASHBOARD_COLUMN_OPTIONS.map((value) => ({
  label: `${value} column${value > 1 ? 's' : ''}`,
  value,
}))

const visualizationOptions = PANEL_VISUALIZATIONS.map((value) => ({
  label: value === 'split' ? 'Chart + table' : value,
  value,
}))

const serializedDashboard = computed(() =>
  serializeDashboardToYaml(props.workbench.dashboardDefinition.value),
)

const isYamlDirty = computed(
  () => yamlDraft.value !== serializedDashboard.value,
)

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.workbench.dashboardColumns.value}, minmax(0, 1fr))`,
}))

function syncYamlDraft(nextValue = serializedDashboard.value) {
  yamlDraft.value = nextValue
}

watch(
  serializedDashboard,
  (nextValue, previousValue) => {
    if (!yamlDraft.value.trim() || yamlDraft.value === previousValue) {
      syncYamlDraft(nextValue)
    }
  },
  { immediate: true },
)

function updateDashboardColumns(value: string | number | null) {
  props.workbench.updateDashboardMeta({
    columns: Number(value ?? 2) as 1 | 2 | 3,
  })
}

async function addCurrentPanel() {
  const panel = props.workbench.addCurrentSelectionToDashboard({
    title: panelTitle.value,
    description: panelDescription.value,
    visualization: panelVisualization.value,
  })

  if (!panel) {
    return
  }

  panelTitle.value = ''
  panelDescription.value = ''
  panelVisualization.value = 'chart'

  if (!props.workbench.dashboardPanelRows.value[panel.id]) {
    await props.workbench.runDashboardPanel(panel.id)
  }
}

function applyYamlDraft() {
  const loaded = props.workbench.importDashboardYaml(yamlDraft.value)
  if (loaded) {
    syncYamlDraft()
  }
}

function resultRows(panelId: string) {
  return props.workbench.dashboardPanelRows.value[panelId] ?? []
}
</script>

<template>
  <NFlex vertical :size="18">
    <div class="dashboard-layout">
      <NCard class="dashboard-card" :bordered="false">
        <NForm label-placement="top">
          <NFormItem label="Dashboard name">
            <NInput
              :value="workbench.dashboardName.value"
              placeholder="Influx explorer dashboard"
              @update:value="
                (value) => workbench.updateDashboardMeta({ name: value })
              "
            />
          </NFormItem>

          <NFormItem label="Description">
            <NInput
              :value="workbench.dashboardDescription.value"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="Describe what this dashboard is tracking."
              @update:value="
                (value) => workbench.updateDashboardMeta({ description: value })
              "
            />
          </NFormItem>

          <NFormItem label="Grid columns">
            <NSelect
              :value="workbench.dashboardColumns.value"
              :options="dashboardColumnOptions"
              @update:value="updateDashboardColumns"
            />
          </NFormItem>

          <div class="form-divider" />

          <NText depth="2" class="form-label">
            Save current query as a panel
          </NText>

          <NFormItem label="Panel title">
            <NInput
              v-model:value="panelTitle"
              placeholder="CPU usage by host"
            />
          </NFormItem>

          <NFormItem label="Panel description">
            <NInput
              v-model:value="panelDescription"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="Optional notes for the panel."
            />
          </NFormItem>

          <NFormItem label="Visualization">
            <NSelect
              :value="panelVisualization"
              :options="visualizationOptions"
              @update:value="
                (value) =>
                  (panelVisualization = String(
                    value ?? 'chart',
                  ) as InfluxPanelVisualization)
              "
            />
          </NFormItem>

          <NFlex :size="10">
            <NButton type="primary" @click="addCurrentPanel()">
              Add current selection
            </NButton>
            <NButton
              secondary
              :disabled="workbench.dashboardPanels.value.length === 0"
              :loading="
                workbench.dashboardPanels.value.some((panel) =>
                  workbench.isDashboardPanelRunning(panel.id),
                )
              "
              @click="workbench.runDashboardPanels()"
            >
              Run all panels
            </NButton>
          </NFlex>
        </NForm>
      </NCard>

      <NCard class="dashboard-card" :bordered="false">
        <div class="yaml-header">
          <div>
            <h3 class="panel-title">Dashboard YAML</h3>
            <NText depth="3">
              Save, review, or paste a dashboard definition for the current
              connection.
            </NText>
          </div>
          <NFlex :size="8">
            <NTag type="info"
              >{{ workbench.dashboardPanels.value.length }} panels</NTag
            >
            <NTag v-if="isYamlDirty" type="warning">Unsaved edits</NTag>
          </NFlex>
        </div>

        <NInput
          v-model:value="yamlDraft"
          type="textarea"
          :autosize="{ minRows: 18, maxRows: 24 }"
          placeholder="Dashboard YAML will appear here."
        />

        <NFlex justify="space-between" align="center" class="yaml-actions">
          <NButton secondary @click="syncYamlDraft()">Refresh YAML</NButton>
          <NButton type="primary" @click="applyYamlDraft()">Apply YAML</NButton>
        </NFlex>
      </NCard>
    </div>

    <div class="saved-header">
      <div>
        <h3 class="panel-title">Saved panels</h3>
        <NText depth="3">
          Run panels individually or open them back in the query editor.
        </NText>
      </div>
    </div>

    <NEmpty
      v-if="workbench.dashboardPanels.value.length === 0"
      description="Save the current explorer selection or import YAML to build a dashboard."
    />

    <div v-else class="dashboard-grid" :style="gridStyle">
      <NCard
        v-for="panel in workbench.dashboardPanels.value"
        :key="panel.id"
        class="panel-card"
        :bordered="false"
      >
        <div class="panel-header">
          <div>
            <h4 class="panel-card-title">{{ panel.title }}</h4>
            <p v-if="panel.description" class="panel-description">
              {{ panel.description }}
            </p>
          </div>

          <NFlex :size="8">
            <NButton
              tertiary
              size="small"
              @click="workbench.loadDashboardPanel(panel.id)"
            >
              Load into editor
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

        <NFlex class="panel-tags" :size="8">
          <NTag type="info">{{ panel.query.bucket }}</NTag>
          <NTag type="success">{{ panel.query.measurement }}</NTag>
          <NTag type="warning">{{ panel.visualization }}</NTag>
          <NTag type="default">{{ panel.query.fields.join(', ') }}</NTag>
        </NFlex>

        <NAlert
          v-if="workbench.dashboardPanelErrors.value[panel.id]"
          type="error"
          class="panel-error"
          :bordered="false"
          title="Panel query failed"
        >
          {{ workbench.dashboardPanelErrors.value[panel.id] }}
        </NAlert>

        <div class="panel-visuals">
          <InfluxResultChart
            v-if="panel.visualization !== 'table'"
            :rows="resultRows(panel.id)"
          />
          <InfluxResultTable
            v-if="panel.visualization !== 'chart'"
            :rows="resultRows(panel.id)"
          />
        </div>
      </NCard>
    </div>
  </NFlex>
</template>

<style scoped>
.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
}

.dashboard-card {
  border-radius: 24px;
  min-width: 0;
}

.form-divider {
  margin: 10px 0 16px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
}

.form-label,
.panel-title {
  margin-bottom: 10px;
}

.yaml-header,
.saved-header,
.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.yaml-actions {
  margin-top: 14px;
}

.dashboard-grid {
  display: grid;
  gap: 16px;
}

.panel-card {
  border-radius: 24px;
  min-width: 0;
}

.panel-card-title {
  margin: 0;
  font-size: 1.05rem;
}

.panel-description {
  margin: 6px 0 0;
  color: rgba(71, 85, 105, 0.86);
}

.panel-tags,
.panel-error {
  margin-bottom: 14px;
}

.panel-visuals {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1080px) {
  .dashboard-layout,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
