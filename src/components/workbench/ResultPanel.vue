<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { DocumentTextOutline } from '@vicons/ionicons5'
import { NButton, NFlex, NTabPane, NTabs, NTag } from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import InfluxResultChart from '@/components/InfluxResultChart.vue'
import InfluxResultTable from '@/components/InfluxResultTable.vue'
import YamlCodeEditor from '@/components/workbench/YamlCodeEditor.vue'
import {
  createDashboardDefinition,
  serializeDashboardToYaml,
} from '@/services/influx/dashboard'
import { renderNaiveIcon } from '@/utils/renderNaiveIcon'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const resultTab = ref<'chart' | 'table' | 'yaml'>('chart')
const yamlDraft = ref('')

const currentYamlDefinition = computed(() => {
  const currentPanel = props.workbench.createCurrentPanelSnapshot({
    title: props.workbench.selectedMeasurement.value
      ? `${props.workbench.selectedMeasurement.value} preview`
      : 'Current selection',
    visualization: 'split',
  })

  return createDashboardDefinition({
    name: currentPanel ? 'Current workbench state' : 'Influx explorer snapshot',
    description: currentPanel
      ? 'Single-panel snapshot generated from the active explorer selection.'
      : '',
    columns: 1,
    panels: currentPanel ? [currentPanel] : [],
  })
})

const serializedYaml = computed(() =>
  serializeDashboardToYaml(currentYamlDefinition.value),
)

const isYamlDirty = computed(() => yamlDraft.value !== serializedYaml.value)

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
</script>

<template>
  <div class="panel-shell">
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
              <NButton
                secondary
                size="small"
                :render-icon="renderNaiveIcon(DocumentTextOutline)"
                @click="syncYamlFromState()"
              >
                Load current state
              </NButton>
            </NFlex>
          </div>

          <YamlCodeEditor
            v-model="yamlDraft"
            placeholder="Current selection YAML will appear here."
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
