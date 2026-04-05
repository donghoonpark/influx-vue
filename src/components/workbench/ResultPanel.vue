<script setup lang="ts">
import { computed, ref } from 'vue'

import { DocumentTextOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NFlex, NSelect, NTabPane, NTabs, NTag } from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import InfluxResultChart from '@/components/InfluxResultChart.vue'
import InfluxResultTable from '@/components/InfluxResultTable.vue'
import YamlCodeEditor from '@/components/workbench/YamlCodeEditor.vue'
import {
  createDashboardConnection,
  createDashboardDefinition,
  serializeDashboardToDisplayYaml,
  type InfluxPanelVisualization,
} from '@/services/influx/dashboard'
import { renderNaiveIcon } from '@/utils/renderNaiveIcon'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const resultTab = ref<'chart' | 'table' | 'yaml'>('chart')
const panelVisualization = ref<InfluxPanelVisualization>('split')
const panelVisualizationOptions = [
  { label: 'Line chart', value: 'chart' },
  { label: 'Scatter chart', value: 'scatter' },
  { label: 'Table only', value: 'table' },
  { label: 'Split view', value: 'split' },
] satisfies Array<{ label: string; value: InfluxPanelVisualization }>
const chartVisualization = computed(() =>
  panelVisualization.value === 'scatter' ? 'scatter' : 'line',
)

function updatePanelVisualization(value: string | number | null) {
  panelVisualization.value = (value ?? 'split') as InfluxPanelVisualization
}

const currentDashboardDefinition = computed(() => {
  const currentPanel = props.workbench.createCurrentPanelSnapshot({
    title: props.workbench.selectedMeasurementLabel.value
      ? `${props.workbench.selectedMeasurementLabel.value} preview`
      : 'Current selection',
    visualization: panelVisualization.value,
  })

  return createDashboardDefinition({
    name: currentPanel ? 'Current workbench state' : 'Influx explorer snapshot',
    description: currentPanel
      ? 'Single-panel snapshot generated from the active explorer selection.'
      : '',
    columns: 1,
    panels: currentPanel ? [currentPanel] : [],
    connection: createDashboardConnection(props.workbench.connection),
  })
})

const displayYaml = computed(() =>
  serializeDashboardToDisplayYaml(currentDashboardDefinition.value),
)
const hasMaskedToken = computed(() =>
  Boolean(currentDashboardDefinition.value.connection?.token),
)
const hasAnnotationRows = computed(() =>
  props.workbench.rows.value.some(
    (row) =>
      Boolean(row._time) &&
      (typeof row._value === 'string' || typeof row._value === 'boolean'),
  ),
)
const resultNotice = computed(() => {
  if (!props.workbench.hasExecutedQuery.value) {
    return null
  }

  if (props.workbench.rows.value.length === 0) {
    return {
      type: 'warning' as const,
      title: 'No data returned',
      message:
        'The query completed successfully, but no rows matched the current bucket, range, or filters.',
    }
  }

  if (props.workbench.rows.value.length === 1) {
    return {
      type: 'info' as const,
      title: 'Single row returned',
      message:
        'Only one row matched the current query, so the chart may look sparse until you widen the range or reduce aggregation.',
    }
  }

  if (
    props.workbench.summary.value.numericRowCount === 0 &&
    !hasAnnotationRows.value
  ) {
    return {
      type: 'warning' as const,
      title: 'No numeric series to chart',
      message:
        'Rows were returned, but the chart needs numeric or string-valued _value fields with timestamps. The table tab still contains the raw result.',
    }
  }

  return null
})
</script>

<template>
  <div class="panel-shell">
    <NAlert
      v-if="resultNotice"
      :type="resultNotice.type"
      :title="resultNotice.title"
      :bordered="false"
      class="result-notice"
    >
      {{ resultNotice.message }}
    </NAlert>

    <div class="result-toolbar">
      <NSelect
        size="small"
        class="visualization-select"
        :value="panelVisualization"
        :options="panelVisualizationOptions"
        placeholder="Panel visualization"
        @update:value="updatePanelVisualization"
      />
    </div>

    <NTabs v-model:value="resultTab" type="line" animated>
      <NTabPane name="chart" tab="Chart">
        <InfluxResultChart
          :rows="workbench.rows.value"
          :visualization="chartVisualization"
        />
      </NTabPane>

      <NTabPane name="table" tab="Table">
        <InfluxResultTable :rows="workbench.rows.value" />
      </NTabPane>

      <NTabPane name="yaml" tab="YAML">
        <div class="yaml-shell">
          <div class="yaml-toolbar">
            <NFlex :size="8">
              <NTag v-if="hasMaskedToken" type="warning">Token masked</NTag>
              <NButton
                secondary
                size="small"
                :render-icon="renderNaiveIcon(DocumentTextOutline)"
              >
                YAML snapshot
              </NButton>
            </NFlex>
          </div>

          <YamlCodeEditor
            :model-value="displayYaml"
            placeholder="Current selection YAML will appear here."
            read-only
          />
        </div>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.panel-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.result-notice {
  margin-top: 2px;
}

.result-toolbar {
  display: flex;
  justify-content: flex-end;
}

.visualization-select {
  width: 180px;
}

.yaml-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.yaml-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.panel-shell :deep(.n-tabs-nav) {
  margin-bottom: 6px;
}

@media (max-width: 1200px) {
  .yaml-toolbar {
    flex-direction: column;
  }
}
</style>
