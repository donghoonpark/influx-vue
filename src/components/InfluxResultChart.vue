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
    top: 4,
    left: 8,
    right: 8,
    type: 'scroll',
    itemWidth: 10,
    itemHeight: 7,
    itemGap: 10,
    textStyle: {
      fontSize: 11,
    },
  },
  tooltip: {
    trigger: 'axis',
  },
  grid: {
    top: 38,
    left: 40,
    right: 12,
    bottom: 42,
    containLabel: true,
  },
  xAxis: {
    type: 'time',
    axisLabel: {
      hideOverlap: true,
      margin: 10,
    },
    axisTick: {
      show: false,
    },
  },
  yAxis: {
    type: 'value',
    scale: true,
    axisLabel: {
      margin: 8,
    },
    axisTick: {
      show: false,
    },
    splitLine: {
      lineStyle: {
        opacity: 0.35,
      },
    },
  },
  dataZoom: [
    { type: 'inside' },
    {
      type: 'slider',
      height: 14,
      bottom: 8,
      borderColor: 'transparent',
      moveHandleSize: 0,
    },
  ],
  series: chartSeries.value.map((series) => ({
    type: 'line',
    name: series.name,
    showSymbol: false,
    smooth: true,
    lineStyle: {
      width: 1.8,
    },
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
  min-height: 380px;
}

.chart {
  height: 380px;
  width: 100%;
}
</style>
