<script setup lang="ts">
import { computed, ref } from 'vue'

import { format } from 'date-fns'
import {
  NAlert,
  NButton,
  NCard,
  NCode,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputNumber,
  NSelect,
  NSpin,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
  NText,
} from 'naive-ui'

import { useInfluxWorkbench } from '@/composables/useInfluxWorkbench'
import InfluxResultChart from '@/components/InfluxResultChart.vue'
import InfluxResultTable from '@/components/InfluxResultTable.vue'
import type {
  AggregateFunction,
  InfluxBucket,
  RangePresetKey,
  TagFilter,
} from '@/services/influx/types'

const resultTab = ref<'chart' | 'table'>('chart')
const workbench = useInfluxWorkbench()

const bucketOptions = computed(() =>
  workbench.buckets.value.map((bucket) => ({
    label: bucket.name,
    value: bucket.name,
  })),
)

const measurementOptions = computed(() =>
  workbench.measurements.value.map((measurement) => ({
    label: measurement,
    value: measurement,
  })),
)

const fieldOptions = computed(() =>
  workbench.fieldKeys.value.map((field) => ({
    label: field,
    value: field,
  })),
)

function formatRetention(retentionSeconds: number | null): string {
  if (!retentionSeconds) {
    return 'Infinite retention'
  }

  if (retentionSeconds < 3600) {
    return `${Math.round(retentionSeconds / 60)}m retention`
  }

  if (retentionSeconds < 86_400) {
    return `${Math.round(retentionSeconds / 3600)}h retention`
  }

  return `${Math.round(retentionSeconds / 86_400)}d retention`
}

function formatBucketMeta(bucket: InfluxBucket): string {
  const parts = [formatRetention(bucket.retentionSeconds)]
  if (bucket.description) {
    parts.push(bucket.description)
  }

  return parts.join(' · ')
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return '-'
  }

  return format(new Date(value), 'yyyy-MM-dd HH:mm:ss')
}

function getTagKeyOptions(_filter: TagFilter, index: number) {
  return workbench.tagKeys.value.map((tagKey) => ({
    label: tagKey,
    value: tagKey,
    disabled: workbench.tagFilters.value.some(
      (activeFilter, activeIndex) =>
        activeIndex !== index && activeFilter.tagKey === tagKey,
    ),
  }))
}

function getTagValueOptions(tagKey: string) {
  return (workbench.tagValueOptions.value[tagKey] ?? []).map((value) => ({
    label: value,
    value,
  }))
}

function updateSelectedFields(value: Array<string | number> | null) {
  workbench.selectedFields.value = (value ?? []).map(String)
}

function updateRangePreset(value: string | number | null) {
  workbench.rangePreset.value = String(value ?? 'last_24h') as RangePresetKey
}

function updateAggregateFunction(value: string | number | null) {
  workbench.aggregateFunction.value = String(
    value ?? 'mean',
  ) as AggregateFunction
}

function updateTagValues(index: number, value: Array<string | number> | null) {
  workbench.updateTagFilterValues(index, (value ?? []).map(String))
}
</script>

<template>
  <div class="workbench">
    <NCard class="hero-card" :bordered="false">
      <NGrid :cols="24" :x-gap="16" :y-gap="16">
        <NGi :span="14">
          <NFlex vertical :size="16">
            <NTag size="small" round type="success">Explorer-first MVP</NTag>
            <div>
              <h1 class="headline">Influx Vue Workbench</h1>
              <p class="lead">
                Bucket에서 measurement, field, tag, tag value까지 순차적으로
                탐색한 뒤 Flux 쿼리와 시각화로 이어지는 InfluxDB explorer를 위한
                워크벤치입니다.
              </p>
            </div>

            <NAlert
              :title="workbench.status.value.title"
              :type="workbench.status.value.type"
              :bordered="false"
            >
              {{ workbench.status.value.message }}
            </NAlert>

            <div class="hero-note">
              <NText depth="3">
                Security note: 브라우저에서 토큰을 직접 사용하는 방식은 내부
                도구와 개발 환경에 적합합니다. 외부 배포 시에는 프록시 또는 BFF
                계층을 두는 편이 안전합니다.
              </NText>
            </div>
          </NFlex>
        </NGi>

        <NGi :span="10">
          <NCard size="small" title="Connection">
            <NForm label-placement="top">
              <NGrid :cols="2" :x-gap="12">
                <NGi :span="2">
                  <NFormItem label="InfluxDB URL">
                    <NInput
                      v-model:value="workbench.connection.url"
                      placeholder="http://127.0.0.1:8086"
                    />
                  </NFormItem>
                </NGi>

                <NGi :span="1">
                  <NFormItem label="Organization">
                    <NInput
                      v-model:value="workbench.connection.org"
                      placeholder="influx-vue"
                    />
                  </NFormItem>
                </NGi>

                <NGi :span="1">
                  <NFormItem label="Default bucket">
                    <NInput
                      :value="workbench.connection.bucket ?? ''"
                      placeholder="demo-metrics"
                      @update:value="
                        (value) => (workbench.connection.bucket = value)
                      "
                    />
                  </NFormItem>
                </NGi>

                <NGi :span="2">
                  <NFormItem label="Token">
                    <NInput
                      v-model:value="workbench.connection.token"
                      type="password"
                      show-password-on="click"
                      placeholder="InfluxDB API token"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>

              <NFlex :size="12">
                <NButton secondary @click="workbench.loadLocalDemoPreset()">
                  Load local demo preset
                </NButton>
                <NButton
                  type="primary"
                  :loading="workbench.isConnecting.value"
                  @click="workbench.connect()"
                >
                  Connect and load explorer
                </NButton>
              </NFlex>

              <NFlex
                v-if="workbench.health.value"
                class="health-tags"
                :size="8"
              >
                <NTag
                  :type="
                    workbench.health.value.status === 'pass'
                      ? 'success'
                      : 'warning'
                  "
                >
                  {{ workbench.health.value.status ?? 'unknown' }}
                </NTag>
                <NTag type="info">{{
                  workbench.health.value.name ?? 'InfluxDB'
                }}</NTag>
                <NTag v-if="workbench.health.value.version" type="default">
                  {{ workbench.health.value.version }}
                </NTag>
              </NFlex>
            </NForm>
          </NCard>
        </NGi>
      </NGrid>
    </NCard>

    <NGrid class="content-grid" :cols="24" :x-gap="16" :y-gap="16">
      <NGi :span="7">
        <NCard title="1. Bucket explorer" size="small">
          <NSpin :show="workbench.isConnecting.value">
            <div v-if="workbench.buckets.value.length > 0" class="bucket-list">
              <button
                v-for="bucket in workbench.buckets.value"
                :key="bucket.id"
                class="bucket-button"
                :class="{
                  active: bucket.name === workbench.selectedBucket.value,
                }"
                @click="workbench.selectBucket(bucket.name)"
              >
                <span class="bucket-name">{{ bucket.name }}</span>
                <span class="bucket-meta">{{ formatBucketMeta(bucket) }}</span>
              </button>
            </div>
            <NEmpty
              v-else
              description="Connect to InfluxDB to load bucket metadata."
            />
          </NSpin>
        </NCard>
      </NGi>

      <NGi :span="9">
        <NCard title="2. Measurement and field explorer" size="small">
          <NSpin :show="workbench.isSchemaLoading.value">
            <NForm label-placement="top">
              <NFormItem label="Active bucket">
                <NSelect
                  :value="workbench.selectedBucket.value"
                  :options="bucketOptions"
                  placeholder="Select a bucket"
                  @update:value="
                    (value) => workbench.selectBucket(String(value ?? ''))
                  "
                />
              </NFormItem>

              <NFormItem label="Measurement">
                <NSelect
                  :value="workbench.selectedMeasurement.value"
                  :options="measurementOptions"
                  filterable
                  placeholder="Select a measurement"
                  @update:value="
                    (value) => workbench.selectMeasurement(String(value ?? ''))
                  "
                />
              </NFormItem>

              <NFormItem label="Fields">
                <NSelect
                  :value="workbench.selectedFields.value"
                  :options="fieldOptions"
                  filterable
                  multiple
                  clearable
                  max-tag-count="responsive"
                  placeholder="Choose one or more fields"
                  @update:value="updateSelectedFields"
                />
              </NFormItem>
            </NForm>

            <NFlex class="measurement-meta" :size="8">
              <NTag type="info"
                >{{ workbench.measurements.value.length }} measurements</NTag
              >
              <NTag type="success"
                >{{ workbench.fieldKeys.value.length }} fields</NTag
              >
              <NButton tertiary size="small" @click="workbench.refreshSchema()"
                >Refresh schema</NButton
              >
            </NFlex>
          </NSpin>
        </NCard>
      </NGi>

      <NGi :span="8">
        <NCard title="3. Tag explorer and filters" size="small">
          <NSpin :show="workbench.isSchemaLoading.value">
            <NFlex vertical :size="14">
              <div class="tag-summary">
                <NTag type="warning"
                  >{{ workbench.tagKeys.value.length }} tags discovered</NTag
                >
                <NButton
                  tertiary
                  size="small"
                  :disabled="workbench.tagKeys.value.length === 0"
                  @click="workbench.addTagFilter()"
                >
                  Add tag filter
                </NButton>
              </div>

              <div
                v-if="workbench.tagFilters.value.length > 0"
                class="filter-stack"
              >
                <div
                  v-for="(filter, index) in workbench.tagFilters.value"
                  :key="`${filter.tagKey}-${index}`"
                  class="filter-row"
                >
                  <NSelect
                    :value="filter.tagKey"
                    :options="getTagKeyOptions(filter, index)"
                    placeholder="Tag key"
                    @update:value="
                      (value) =>
                        workbench.updateTagFilterKey(index, String(value ?? ''))
                    "
                  />
                  <NSelect
                    :value="filter.values"
                    :options="getTagValueOptions(filter.tagKey)"
                    filterable
                    multiple
                    clearable
                    max-tag-count="responsive"
                    placeholder="Tag values"
                    @update:value="(value) => updateTagValues(index, value)"
                  />
                  <NButton
                    tertiary
                    type="error"
                    @click="workbench.removeTagFilter(index)"
                  >
                    Remove
                  </NButton>
                </div>
              </div>
              <NEmpty
                v-else
                description="Add tag filters when you want to narrow results to specific hosts, regions, or services."
              />
            </NFlex>
          </NSpin>
        </NCard>
      </NGi>

      <NGi :span="15">
        <NCard title="4. Query builder" size="small">
          <NForm label-placement="top">
            <NGrid :cols="4" :x-gap="12">
              <NGi :span="1">
                <NFormItem label="Time range">
                  <NSelect
                    :value="workbench.rangePreset.value"
                    :options="workbench.rangePresetOptions"
                    @update:value="updateRangePreset"
                  />
                </NFormItem>
              </NGi>

              <NGi :span="1">
                <NFormItem label="Aggregate fn">
                  <NSelect
                    :value="workbench.aggregateFunction.value"
                    :options="workbench.aggregateFunctionOptions"
                    @update:value="updateAggregateFunction"
                  />
                </NFormItem>
              </NGi>

              <NGi :span="1">
                <NFormItem label="Aggregate window">
                  <NInput
                    v-model:value="workbench.aggregateWindow.value"
                    placeholder="15m or empty"
                  />
                </NFormItem>
              </NGi>

              <NGi :span="1">
                <NFormItem label="Row limit">
                  <NInputNumber
                    :value="workbench.limit.value"
                    :min="100"
                    :step="100"
                    placeholder="2000"
                    @update:value="
                      (value) => (workbench.limit.value = value ?? 2000)
                    "
                  />
                </NFormItem>
              </NGi>

              <NGi v-if="workbench.rangePreset.value === 'custom'" :span="2">
                <NFormItem label="Custom start">
                  <input
                    v-model="workbench.customStart.value"
                    class="native-datetime"
                    type="datetime-local"
                  />
                </NFormItem>
              </NGi>

              <NGi v-if="workbench.rangePreset.value === 'custom'" :span="2">
                <NFormItem label="Custom stop">
                  <input
                    v-model="workbench.customStop.value"
                    class="native-datetime"
                    type="datetime-local"
                  />
                </NFormItem>
              </NGi>
            </NGrid>

            <NFlex justify="space-between" align="center" class="query-toolbar">
              <NFlex :size="8">
                <NButton
                  :type="
                    workbench.queryMode.value === 'builder'
                      ? 'primary'
                      : 'default'
                  "
                  secondary
                  @click="workbench.setQueryMode('builder')"
                >
                  Builder preview
                </NButton>
                <NButton
                  :type="
                    workbench.queryMode.value === 'raw' ? 'primary' : 'default'
                  "
                  secondary
                  @click="workbench.setQueryMode('raw')"
                >
                  Raw Flux
                </NButton>
              </NFlex>

              <NButton
                type="primary"
                :disabled="!workbench.canRunQuery.value"
                :loading="workbench.isQueryRunning.value"
                @click="workbench.runQuery()"
              >
                Run query
              </NButton>
            </NFlex>

            <NFormItem
              :label="
                workbench.queryMode.value === 'builder'
                  ? 'Generated Flux'
                  : 'Flux editor'
              "
            >
              <NInput
                v-if="workbench.queryMode.value === 'builder'"
                :value="workbench.generatedFlux.value"
                type="textarea"
                readonly
                :autosize="{ minRows: 10, maxRows: 18 }"
                placeholder="Select a bucket, measurement, and field to generate Flux."
              />
              <NInput
                v-else
                v-model:value="workbench.rawFlux.value"
                type="textarea"
                :autosize="{ minRows: 10, maxRows: 18 }"
                placeholder="Paste or refine Flux here."
              />
            </NFormItem>
          </NForm>
        </NCard>
      </NGi>

      <NGi :span="9">
        <NCard title="Selection summary" size="small">
          <NGrid :cols="2" :x-gap="12" :y-gap="12">
            <NGi :span="1">
              <NStatistic
                label="Buckets"
                :value="workbench.buckets.value.length"
              />
            </NGi>
            <NGi :span="1">
              <NStatistic
                label="Measurements"
                :value="workbench.measurements.value.length"
              />
            </NGi>
            <NGi :span="1">
              <NStatistic
                label="Rows"
                :value="workbench.summary.value.rowCount"
              />
            </NGi>
            <NGi :span="1">
              <NStatistic
                label="Series"
                :value="workbench.summary.value.seriesCount"
              />
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
              <strong>{{
                formatTimestamp(workbench.summary.value.firstTimestamp)
              }}</strong>
            </div>
            <div class="summary-row">
              <span class="summary-label">Last timestamp</span>
              <strong>{{
                formatTimestamp(workbench.summary.value.lastTimestamp)
              }}</strong>
            </div>
          </NFlex>
        </NCard>
      </NGi>

      <NGi :span="24">
        <NCard title="Results" size="small">
          <NSpin :show="workbench.isQueryRunning.value">
            <NTabs v-model:value="resultTab" type="line" animated>
              <NTabPane name="chart" tab="Chart">
                <InfluxResultChart :rows="workbench.rows.value" />
              </NTabPane>
              <NTabPane name="table" tab="Table">
                <InfluxResultTable :rows="workbench.rows.value" />
              </NTabPane>
            </NTabs>
          </NSpin>
        </NCard>
      </NGi>
    </NGrid>
  </div>
</template>

<style scoped>
.workbench {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-card {
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(
      circle at top right,
      rgba(34, 197, 94, 0.18),
      transparent 24rem
    ),
    radial-gradient(
      circle at top left,
      rgba(14, 165, 233, 0.16),
      transparent 18rem
    ),
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.96),
      rgba(247, 251, 252, 0.98)
    );
}

.headline {
  margin: 0 0 12px;
  font-size: clamp(2rem, 3vw, 3.2rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

.lead {
  margin: 0;
  max-width: 58ch;
  color: rgba(15, 23, 42, 0.8);
}

.hero-note {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.72);
}

.bucket-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 430px;
  overflow: auto;
}

.native-datetime {
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(203, 213, 225, 1);
  border-radius: 12px;
  padding: 0 12px;
  background: white;
  color: inherit;
}

.bucket-button {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  background: white;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  transition:
    transform 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.bucket-button:hover {
  transform: translateY(-1px);
  border-color: rgba(14, 165, 233, 0.4);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.bucket-button.active {
  border-color: rgba(20, 184, 166, 0.55);
  background: linear-gradient(
    180deg,
    rgba(236, 253, 245, 0.9),
    rgba(255, 255, 255, 0.98)
  );
  box-shadow: 0 14px 28px rgba(20, 184, 166, 0.12);
}

.bucket-name,
.bucket-meta {
  display: block;
}

.bucket-name {
  font-weight: 700;
}

.bucket-meta {
  margin-top: 4px;
  font-size: 0.9rem;
  color: rgba(71, 85, 105, 0.84);
}

.health-tags,
.measurement-meta,
.tag-summary,
.query-toolbar {
  margin-top: 8px;
}

.filter-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr auto;
  gap: 10px;
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

@media (max-width: 1200px) {
  .filter-row {
    grid-template-columns: 1fr;
  }
}
</style>
