<script setup lang="ts">
import { format } from 'date-fns'
import { NCode, NFlex, NGrid, NGi, NStatistic } from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'

defineProps<{
  workbench: InfluxWorkbenchController
}>()

function formatTimestamp(value?: string): string {
  if (!value) {
    return '-'
  }

  return format(new Date(value), 'yyyy-MM-dd HH:mm:ss')
}
</script>

<template>
  <div class="summary-shell">
    <NGrid :cols="2" :x-gap="12" :y-gap="12">
      <NGi :span="1">
        <NStatistic label="Buckets" :value="workbench.buckets.value.length" />
      </NGi>
      <NGi :span="1">
        <NStatistic label="Measurements" :value="workbench.measurements.value.length" />
      </NGi>
      <NGi :span="1">
        <NStatistic label="Rows" :value="workbench.summary.value.rowCount" />
      </NGi>
      <NGi :span="1">
        <NStatistic label="Series" :value="workbench.summary.value.seriesCount" />
      </NGi>
    </NGrid>

    <NFlex vertical class="summary-list" :size="10">
      <div class="summary-row">
        <span class="summary-label">Bucket</span>
        <strong>{{ workbench.selectedBucket.value || '-' }}</strong>
      </div>
      <div class="summary-row">
        <span class="summary-label">Measurement</span>
        <strong>{{ workbench.selectedMeasurement.value || '-' }}</strong>
      </div>
      <div class="summary-row">
        <span class="summary-label">Fields</span>
        <NCode :code="workbench.selectedFields.value.join(', ') || '-'" />
      </div>
      <div class="summary-row">
        <span class="summary-label">First timestamp</span>
        <strong>{{ formatTimestamp(workbench.summary.value.firstTimestamp) }}</strong>
      </div>
      <div class="summary-row">
        <span class="summary-label">Last timestamp</span>
        <strong>{{ formatTimestamp(workbench.summary.value.lastTimestamp) }}</strong>
      </div>
    </NFlex>
  </div>
</template>

<style scoped>
.summary-shell {
  padding: 4px 0;
}

.summary-list {
  margin-top: 16px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
}

.summary-label {
  color: rgba(71, 85, 105, 0.86);
}
</style>
