<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  NAlert,
  NButton,
  NCheckbox,
  NCheckboxGroup,
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
  NTag,
  NText,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import type {
  AggregateFunction,
  InfluxBucket,
  RangePresetKey,
  TagFilter,
} from '@/services/influx/types'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const panelMode = ref<'explorer' | 'query'>('explorer')

const bucketOptions = computed(() =>
  props.workbench.buckets.value.map((bucket) => ({
    label: bucket.name,
    value: bucket.name,
  })),
)

const queryText = computed(() =>
  props.workbench.queryMode.value === 'raw'
    ? props.workbench.rawFlux.value
    : props.workbench.generatedFlux.value,
)

watch(
  () => props.workbench.generatedFlux.value,
  (nextValue, previousValue) => {
    if (nextValue && nextValue !== previousValue) {
      props.workbench.syncQueryFromExplorer()
    }
  },
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

function updateSelectedFields(value: Array<string | number> | null) {
  props.workbench.selectedFields.value = (value ?? []).map(String)
}

function updateSelectedMeasurement(measurement: string) {
  void props.workbench.selectMeasurement(measurement)
}

function getTagKeyOptions(_filter: TagFilter, index: number) {
  return props.workbench.tagKeys.value.map((tagKey) => ({
    label: tagKey,
    value: tagKey,
    disabled: props.workbench.tagFilters.value.some(
      (activeFilter, activeIndex) =>
        activeIndex !== index && activeFilter.tagKey === tagKey,
    ),
  }))
}

function getTagValueOptions(tagKey: string) {
  return (props.workbench.tagValueOptions.value[tagKey] ?? []).map((value) => ({
    label: value,
    value,
  }))
}

function updateTagValues(index: number, value: Array<string | number> | null) {
  props.workbench.updateTagFilterValues(index, (value ?? []).map(String))
}

function updateRangePreset(value: string | number | null) {
  props.workbench.rangePreset.value = String(
    value ?? 'last_24h',
  ) as RangePresetKey
}

function updateAggregateFunction(value: string | number | null) {
  props.workbench.aggregateFunction.value = String(
    value ?? 'mean',
  ) as AggregateFunction
}

function showExplorer() {
  panelMode.value = 'explorer'
}

function showQuery() {
  props.workbench.syncQueryFromExplorer()
  panelMode.value = 'query'
}

function updateQueryText(event: Event) {
  props.workbench.updateQueryText((event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="panel-shell">
    <div class="panel-header">
      <div>
        <h2 class="panel-title">ExplorerPanel</h2>
        <NText depth="3">
          Bucket, measurement, field, tag filter를 선택하고 필요할 때 Flux 쿼리
          뷰로 전환합니다.
        </NText>
      </div>

      <NFlex :size="8" align="center">
        <NButton
          :type="panelMode === 'explorer' ? 'primary' : 'default'"
          secondary
          @click="showExplorer()"
        >
          List explorer
        </NButton>
        <NButton
          :type="panelMode === 'query' ? 'primary' : 'default'"
          secondary
          @click="showQuery()"
        >
          Query
        </NButton>
        <NButton tertiary @click="workbench.refreshSchema()"
          >Refresh schema</NButton
        >
        <NButton
          type="primary"
          :disabled="!workbench.canRunQuery.value"
          :loading="workbench.isQueryRunning.value"
          @click="workbench.runQuery()"
        >
          Run query
        </NButton>
      </NFlex>
    </div>

    <NSpin
      :show="workbench.isSchemaLoading.value || workbench.isConnecting.value"
    >
      <div v-if="panelMode === 'explorer'" class="content-stack">
        <div class="explorer-grid">
          <div class="bucket-column">
            <div class="section-heading">
              <strong>Bucket explorer</strong>
              <NTag size="small" type="info">{{
                workbench.buckets.value.length
              }}</NTag>
            </div>

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
          </div>

          <div class="selection-column">
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
            </NForm>

            <div class="explorer-shelves">
              <div class="surface-card">
                <div class="surface-heading">
                  <span>Measurements</span>
                  <NTag size="small" type="info">
                    {{ workbench.measurements.value.length }}
                  </NTag>
                </div>

                <div
                  v-if="workbench.measurements.value.length > 0"
                  class="selection-list"
                >
                  <button
                    v-for="measurement in workbench.measurements.value"
                    :key="measurement"
                    class="selection-item"
                    :class="{
                      active:
                        measurement === workbench.selectedMeasurement.value,
                    }"
                    @click="updateSelectedMeasurement(measurement)"
                  >
                    {{ measurement }}
                  </button>
                </div>
                <NEmpty
                  v-else
                  size="small"
                  description="Select a bucket to load measurements."
                />
              </div>

              <div class="surface-card">
                <div class="surface-heading">
                  <span>Fields</span>
                  <NTag size="small" type="success">
                    {{ workbench.fieldKeys.value.length }}
                  </NTag>
                </div>

                <NCheckboxGroup
                  v-if="workbench.fieldKeys.value.length > 0"
                  :value="workbench.selectedFields.value"
                  @update:value="updateSelectedFields"
                >
                  <div class="selection-list">
                    <label
                      v-for="field in workbench.fieldKeys.value"
                      :key="field"
                      class="checkbox-item"
                    >
                      <NCheckbox :value="field" />
                      <span>{{ field }}</span>
                    </label>
                  </div>
                </NCheckboxGroup>
                <NEmpty
                  v-else
                  size="small"
                  description="Select a measurement to load fields."
                />
              </div>
            </div>
          </div>
        </div>

        <div class="support-grid">
          <div class="surface-card">
            <div class="surface-heading">
              <span>Tag filters</span>
              <NFlex :size="8" align="center">
                <NTag size="small" type="warning">
                  {{ workbench.tagKeys.value.length }} discovered
                </NTag>
                <NButton
                  tertiary
                  size="small"
                  :disabled="workbench.tagKeys.value.length === 0"
                  @click="workbench.addTagFilter()"
                >
                  Add
                </NButton>
              </NFlex>
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
              description="Tag filters are optional. Add host, region, or service filters when needed."
            />
          </div>

          <div class="surface-card">
            <div class="surface-heading">
              <span>Query settings</span>
              <NTag size="small" type="default">
                {{ workbench.selectedFields.value.length }} selected field(s)
              </NTag>
            </div>

            <NForm label-placement="top">
              <NGrid :cols="2" :x-gap="12">
                <NGi>
                  <NFormItem label="Time range">
                    <NSelect
                      :value="workbench.rangePreset.value"
                      :options="workbench.rangePresetOptions"
                      @update:value="updateRangePreset"
                    />
                  </NFormItem>
                </NGi>

                <NGi>
                  <NFormItem label="Aggregate fn">
                    <NSelect
                      :value="workbench.aggregateFunction.value"
                      :options="workbench.aggregateFunctionOptions"
                      @update:value="updateAggregateFunction"
                    />
                  </NFormItem>
                </NGi>

                <NGi>
                  <NFormItem label="Aggregate window">
                    <NInput
                      v-model:value="workbench.aggregateWindow.value"
                      placeholder="15m or empty"
                    />
                  </NFormItem>
                </NGi>

                <NGi>
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

                <NGi v-if="workbench.rangePreset.value === 'custom'">
                  <NFormItem label="Custom start">
                    <input
                      v-model="workbench.customStart.value"
                      class="native-datetime"
                      type="datetime-local"
                    />
                  </NFormItem>
                </NGi>

                <NGi v-if="workbench.rangePreset.value === 'custom'">
                  <NFormItem label="Custom stop">
                    <input
                      v-model="workbench.customStop.value"
                      class="native-datetime"
                      type="datetime-local"
                    />
                  </NFormItem>
                </NGi>
              </NGrid>
            </NForm>
          </div>
        </div>
      </div>

      <div v-else class="query-view">
        <NAlert type="info" :bordered="false" title="Explorer drives the query">
          리스트 기반 explorer가 Flux의 원본입니다. 여기서 쿼리를 수정해도
          explorer 선택 상태는 바뀌지 않습니다.
        </NAlert>

        <div class="query-summary">
          <NTag type="info">{{
            workbench.selectedBucket.value || 'bucket'
          }}</NTag>
          <NTag type="success">
            {{ workbench.selectedMeasurement.value || 'measurement' }}
          </NTag>
          <NTag type="default">
            {{
              workbench.selectedFields.value.join(', ') ||
              'field selection needed'
            }}
          </NTag>
        </div>

        <div class="code-shell">
          <div class="code-toolbar">
            <NText depth="3">Flux editor</NText>
            <NButton
              secondary
              size="small"
              @click="workbench.syncQueryFromExplorer()"
            >
              Reset from explorer
            </NButton>
          </div>
          <textarea
            class="code-editor"
            :value="queryText"
            placeholder="Switch back to list explorer to define a query."
            @input="updateQueryText"
          />
        </div>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.panel-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-title {
  margin: 0 0 8px;
  font-size: 1.4rem;
}

.content-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.explorer-grid {
  display: grid;
  grid-template-columns: minmax(240px, 0.85fr) minmax(0, 1.25fr);
  gap: 16px;
  align-items: start;
}

.support-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 16px;
}

.surface-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
}

.section-heading,
.surface-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.bucket-list,
.selection-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
}

.bucket-button,
.selection-item {
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

.bucket-button:hover,
.selection-item:hover {
  transform: translateY(-1px);
  border-color: rgba(14, 165, 233, 0.4);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.bucket-button.active,
.selection-item.active {
  border-color: rgba(20, 184, 166, 0.55);
  background: rgba(236, 253, 245, 0.92);
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

.explorer-shelves {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.7);
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

.query-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.query-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.code-shell {
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: #0f172a;
}

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.96);
}

.code-editor {
  width: 100%;
  min-height: 420px;
  border: 0;
  padding: 18px;
  resize: vertical;
  background: transparent;
  color: #e2e8f0;
  font:
    500 0.94rem/1.6 'SFMono-Regular',
    'Consolas',
    'Menlo',
    monospace;
}

.code-editor:focus {
  outline: none;
}

@media (max-width: 1200px) {
  .explorer-grid,
  .support-grid,
  .explorer-shelves {
    grid-template-columns: 1fr;
  }

  .panel-header {
    flex-direction: column;
  }
}

@media (max-width: 900px) {
  .filter-row {
    grid-template-columns: 1fr;
  }
}
</style>
