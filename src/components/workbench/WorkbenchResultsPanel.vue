<script setup lang="ts">
import { ref } from 'vue'

import { NTabPane, NTabs } from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import InfluxResultChart from '@/components/InfluxResultChart.vue'
import InfluxResultTable from '@/components/InfluxResultTable.vue'

defineProps<{
  workbench: InfluxWorkbenchController
}>()

const resultTab = ref<'chart' | 'table'>('chart')
</script>

<template>
  <NTabs v-model:value="resultTab" type="line" animated>
    <NTabPane name="chart" tab="Chart">
      <InfluxResultChart :rows="workbench.rows.value" />
    </NTabPane>
    <NTabPane name="table" tab="Table">
      <InfluxResultTable :rows="workbench.rows.value" />
    </NTabPane>
  </NTabs>
</template>
