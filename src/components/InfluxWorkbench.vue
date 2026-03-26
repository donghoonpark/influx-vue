<script setup lang="ts">
import {
  NButton,
  NCard,
  NCode,
  NFlex,
  NH2,
  NList,
  NListItem,
  NP,
  NTag,
  NText,
} from 'naive-ui'

const checklist = [
  'Connect to InfluxDB OSS 2.x or compatible endpoints',
  'Browse buckets, measurements, fields, and tags',
  'Compose Flux queries with a guided builder',
  'Switch between chart and table views',
  'Verify behavior against a real InfluxDB container',
]
</script>

<template>
  <NCard class="workbench-shell" :bordered="false">
    <NFlex vertical :size="20">
      <NTag size="small" round type="success">MVP bootstrap</NTag>

      <div>
        <NH2 class="title">Influx Vue Workbench</NH2>
        <NP class="lead">
          Vue 3 + TypeScript + Naive UI 기반의 InfluxDB 탐색 및 시각화
          컴포넌트를 위한 작업 공간입니다.
        </NP>
      </div>

      <NCard size="small" title="Planned capabilities">
        <NList bordered>
          <NListItem v-for="item in checklist" :key="item">
            <NText>{{ item }}</NText>
          </NListItem>
        </NList>
      </NCard>

      <NCard size="small" title="Current status">
        <NFlex vertical :size="12">
          <NText depth="3"
            >The full explorer UI and Influx integration are being wired in
            next.</NText
          >
          <NCode code="pnpm dev" />
          <NButton tertiary type="primary"
            >Bootstrapped and ready for feature work</NButton
          >
        </NFlex>
      </NCard>
    </NFlex>
  </NCard>
</template>
