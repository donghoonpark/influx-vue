<script setup lang="ts">
import { computed } from 'vue'

import type { EChartsOption } from 'echarts'
import { NEmpty } from 'naive-ui'
import VChart from 'vue-echarts'

import '@/services/charts/setup'
import { rowsToChartSeries } from '@/services/influx/resultTransforms'
import type { InfluxRow } from '@/services/influx/types'

const props = defineProps<{
  rows: InfluxRow[]
}>()

const chartSeries = computed(() => rowsToChartSeries(props.rows))

const option = computed<EChartsOption>(() => ({
  animation: false,
  legend: {
    top: 0,
    type: 'scroll',
  },
  tooltip: {
    trigger: 'axis',
  },
  grid: {
    top: 64,
    left: 56,
    right: 20,
    bottom: 72,
  },
  xAxis: {
    type: 'time',
  },
  yAxis: {
    type: 'value',
    scale: true,
  },
  dataZoom: [{ type: 'inside' }, { type: 'slider', height: 24, bottom: 20 }],
  series: chartSeries.value.map((series) => ({
    type: 'line',
    name: series.name,
    showSymbol: false,
    smooth: true,
    emphasis: {
      focus: 'series',
    },
    data: series.points.map((point) => [point.time, point.value]),
  })),
}))
</script>

<template>
  <div v-if="chartSeries.length > 0" class="chart-shell">
    <VChart class="chart" :option="option" autoresize />
  </div>
  <NEmpty
    v-else
    description="Numeric time-series rows are required before a line chart can be rendered."
  />
</template>

<style scoped>
.chart-shell {
  min-height: 420px;
}

.chart {
  height: 420px;
  width: 100%;
}
</style>
