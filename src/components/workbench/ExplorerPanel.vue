<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDatePicker,
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
  NSwitch,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import ExplorerStagePanel from '@/components/workbench/ExplorerStagePanel.vue'
import type {
  AggregateFunction,
  InfluxBucket,
  RangePresetKey,
  TagFilter,
} from '@/services/influx/types'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const isQueryView = ref(false)

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

const customRangeValue = computed<[number, number] | null>(() => {
  if (
    !props.workbench.customStart.value.trim() ||
    !props.workbench.customStop.value.trim()
  ) {
    return null
  }

  const start = new Date(props.workbench.customStart.value).getTime()
  const stop = new Date(props.workbench.customStop.value).getTime()

  if (Number.isNaN(start) || Number.isNaN(stop)) {
    return null
  }

  return [start, stop]
})

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

function updateCustomRange(value: [number, number] | null) {
  if (!value) {
    props.workbench.customStart.value = ''
    props.workbench.customStop.value = ''
    return
  }

  props.workbench.rangePreset.value = 'custom'
  props.workbench.customStart.value = new Date(value[0]).toISOString()
  props.workbench.customStop.value = new Date(value[1]).toISOString()
}

function updateQuerySwitch(value: boolean) {
  isQueryView.value = value

  if (value) {
    props.workbench.syncQueryFromExplorer()
  }
}

function updateQueryText(event: Event) {
  props.workbench.updateQueryText((event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="panel-shell">
    <div class="panel-toolbar">
      <h2 class="panel-title">ExplorerPanel</h2>

      <NFlex :size="8" align="center">
        <NSwitch :value="isQueryView" @update:value="updateQuerySwitch">
          <template #checked>Query</template>
          <template #unchecked>Explorer</template>
        </NSwitch>
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

    <div class="settings-shell">
      <NForm label-placement="top">
        <NGrid :cols="5" :x-gap="12">
          <NGi :span="1">
            <NFormItem label="Range preset">
              <NSelect
                :value="workbench.rangePreset.value"
                :options="workbench.rangePresetOptions"
                @update:value="updateRangePreset"
              />
            </NFormItem>
          </NGi>

          <NGi :span="2">
            <NFormItem label="Datetime range">
              <NDatePicker
                clearable
                type="datetimerange"
                :value="customRangeValue"
                @update:value="
                  (value) => updateCustomRange(value as [number, number] | null)
                "
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

          <NGi :span="5">
            <NFormItem label="Aggregate window">
              <NInput
                v-model:value="workbench.aggregateWindow.value"
                placeholder="15m or empty"
              />
            </NFormItem>
          </NGi>
        </NGrid>
      </NForm>
    </div>

    <NSpin
      :show="workbench.isSchemaLoading.value || workbench.isConnecting.value"
    >
      <div v-if="!isQueryView" class="flow-grid">
        <ExplorerStagePanel
          title="Bucket"
          :count="workbench.buckets.value.length"
          count-type="info"
        >
          <template #default>
            <div
              v-if="workbench.buckets.value.length > 0"
              class="selection-list"
            >
              <button
                v-for="bucket in workbench.buckets.value"
                :key="bucket.id"
                class="selection-item"
                :class="{
                  active: bucket.name === workbench.selectedBucket.value,
                }"
                @click="workbench.selectBucket(bucket.name)"
              >
                <span class="item-title">{{ bucket.name }}</span>
                <span class="item-meta">{{ formatBucketMeta(bucket) }}</span>
              </button>
            </div>
            <NEmpty v-else description="Connect to InfluxDB to load buckets." />
          </template>
        </ExplorerStagePanel>

        <ExplorerStagePanel
          title="Measurement"
          :count="workbench.measurements.value.length"
          count-type="info"
        >
          <template #actions>
            <NSelect
              :value="workbench.selectedBucket.value"
              :options="bucketOptions"
              size="small"
              placeholder="Bucket"
              class="stage-select"
              @update:value="
                (value) => workbench.selectBucket(String(value ?? ''))
              "
            />
          </template>

          <template #default>
            <div
              v-if="workbench.measurements.value.length > 0"
              class="selection-list"
            >
              <button
                v-for="measurement in workbench.measurements.value"
                :key="measurement"
                class="selection-item"
                :class="{
                  active: measurement === workbench.selectedMeasurement.value,
                }"
                @click="updateSelectedMeasurement(measurement)"
              >
                <span class="item-title">{{ measurement }}</span>
              </button>
            </div>
            <NEmpty
              v-else
              description="Select a bucket to load measurements."
            />
          </template>
        </ExplorerStagePanel>

        <ExplorerStagePanel
          title="Field"
          :count="workbench.fieldKeys.value.length"
          count-type="success"
        >
          <template #default>
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
            <NEmpty v-else description="Select a measurement to load fields." />
          </template>
        </ExplorerStagePanel>

        <ExplorerStagePanel
          title="Tags"
          :count="workbench.tagKeys.value.length"
          count-type="warning"
        >
          <template #actions>
            <NButton
              tertiary
              size="small"
              :disabled="workbench.tagKeys.value.length === 0"
              @click="workbench.addTagFilter()"
            >
              Add
            </NButton>
          </template>

          <template #default>
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
            <NEmpty v-else description="Add a tag filter when you need one." />
          </template>
        </ExplorerStagePanel>
      </div>

      <div v-else class="query-shell">
        <div class="code-shell">
          <div class="code-toolbar">
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
            placeholder="Switch back to explorer to define a query."
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

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-title {
  margin: 0;
  font-size: 1.4rem;
}

.settings-shell {
  padding: 14px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
}

.flow-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.selection-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
}

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

.selection-item:hover {
  transform: translateY(-1px);
  border-color: rgba(14, 165, 233, 0.4);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.selection-item.active {
  border-color: rgba(20, 184, 166, 0.55);
  background: rgba(236, 253, 245, 0.92);
}

.item-title,
.item-meta {
  display: block;
}

.item-title {
  font-weight: 700;
}

.item-meta {
  margin-top: 4px;
  font-size: 0.9rem;
  color: rgba(71, 85, 105, 0.84);
}

.stage-select {
  width: 150px;
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

.filter-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.query-shell {
  min-width: 0;
}

.code-shell {
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: #0f172a;
}

.code-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
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

@media (max-width: 1400px) {
  .flow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .panel-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .flow-grid {
    grid-template-columns: 1fr;
  }

  .stage-select {
    width: 100px;
  }
}

@media (max-width: 720px) {
  .flow-grid {
    grid-template-columns: 1fr;
  }
}
</style>
