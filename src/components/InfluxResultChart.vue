<script setup lang="ts">
import { computed } from 'vue'

import type { EChartsOption } from 'echarts'
import { NEmpty } from 'naive-ui'
import VChart from 'vue-echarts'

import '@/services/charts/setup'
import {
  rowsToAnnotationSeries,
  rowsToChartSeries,
} from '@/services/influx/resultTransforms'
import type { InfluxRow } from '@/services/influx/types'

const props = defineProps<{
  rows: InfluxRow[]
}>()

const chartSeries = computed(() => rowsToChartSeries(props.rows))
const annotationSeries = computed(() => rowsToAnnotationSeries(props.rows))
const hasRenderableSeries = computed(
  () => chartSeries.value.length > 0 || annotationSeries.value.length > 0,
)

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const annotationBaseline = computed(() => {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  chartSeries.value.forEach((series) => {
    series.points.forEach((point) => {
      if (point.value < min) {
        min = point.value
      }
      if (point.value > max) {
        max = point.value
      }
    })
  })

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 0.5
  }

  return min + (max - min) / 2
})

const seriesOptions = computed(
  () =>
    [
      ...chartSeries.value.map((series) => ({
        type: 'line' as const,
        name: series.name,
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 1.8,
        },
        emphasis: {
          focus: 'series' as const,
        },
        data: series.points.map((point) => [point.time, point.value]),
      })),
      ...annotationSeries.value.map((series) => ({
        type: 'custom' as const,
        name: `${series.name} · event`,
        z: 3,
        data: series.points.map((point) => [
          point.time,
          annotationBaseline.value,
          point.value,
        ]),
        encode: {
          x: 0,
          y: 1,
          tooltip: [2],
        },
        renderItem(params: any, api: any) {
          const [x] = api.coord([api.value(0), api.value(1)])
          const coordSystem = params.coordSys as { y: number; height: number }
          const color = String(api.visual('color'))

          return {
            type: 'line',
            shape: {
              x1: x,
              y1: coordSystem.y,
              x2: x,
              y2: coordSystem.y + coordSystem.height,
            },
            style: {
              stroke: color,
              lineWidth: 2,
              opacity: 0.72,
              lineDash: [4, 3],
            },
            emphasis: {
              style: {
                stroke: color,
                lineWidth: 3,
                opacity: 1,
              },
            },
          }
        },
      })),
    ] as NonNullable<EChartsOption['series']>,
)

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
    formatter(params: any) {
      const items = Array.isArray(params) ? params : [params]
      if (items.length === 0) {
        return ''
      }

      const axisLabel =
        String(items[0]?.axisValueLabel ?? '') ||
        (Array.isArray(items[0]?.value) ? String(items[0].value[0] ?? '') : '')
      const lines = [`<div>${escapeHtml(axisLabel)}</div>`]

      items.forEach((item) => {
        const rawValue = Array.isArray(item.value)
          ? item.value[item.value.length - 1]
          : item.value
        const formattedValue =
          typeof rawValue === 'number'
            ? rawValue.toLocaleString(undefined, {
                maximumFractionDigits: 3,
              })
            : String(rawValue ?? '-')

        lines.push(
          `${item.marker ?? ''}${escapeHtml(item.seriesName ?? 'Value')}: ${escapeHtml(formattedValue)}`,
        )
      })

      return lines.join('<br/>')
    },
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
    min: chartSeries.value.length > 0 ? undefined : 0,
    max: chartSeries.value.length > 0 ? undefined : 1,
    scale: true,
    axisLabel: {
      show: chartSeries.value.length > 0,
      margin: 8,
    },
    axisTick: {
      show: false,
    },
    axisLine: {
      show: chartSeries.value.length > 0,
    },
    splitLine: {
      show: chartSeries.value.length > 0,
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
  series: seriesOptions.value,
}))
</script>

<template>
  <div v-if="hasRenderableSeries" class="chart-shell">
    <VChart class="chart" :option="option" autoresize />
  </div>
  <NEmpty
    v-else
    description="Numeric or string-valued time-series rows are required before a chart can be rendered."
  />
</template>

<style scoped>
.chart-shell {
  min-height: 340px;
}

.chart {
  height: 340px;
  width: 100%;
}
</style>
