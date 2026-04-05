<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { LogOutOutline, PlayOutline, RefreshOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDatePicker,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NInputNumber,
  NSelect,
  NSpin,
  NSwitch,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import FluxCodeEditor from '@/components/workbench/FluxCodeEditor.vue'
import ExplorerStagePanel from '@/components/workbench/ExplorerStagePanel.vue'
import type { FluxAutocompleteRequest } from '@/services/influx/fluxAutocomplete'
import { validateFluxQuery } from '@/services/influx/fluxValidation'
import type {
  AggregateFunction,
  InfluxBucket,
  RangePresetKey,
  TagFilter,
} from '@/services/influx/types'
import { renderNaiveIcon } from '@/utils/renderNaiveIcon'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const emit = defineEmits<{
  disconnect: []
}>()

const isQueryView = ref(false)

const aggregateWindowOptions = [
  '100ms',
  '250ms',
  '500ms',
  '1s',
  '5s',
  '10s',
  '30s',
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '6h',
  '12h',
  '1d',
].map((value) => ({
  label: value,
  value,
}))

const queryText = computed(() =>
  props.workbench.queryMode.value === 'raw'
    ? props.workbench.rawFlux.value
    : props.workbench.generatedFlux.value,
)
const queryValidationIssues = computed(() => validateFluxQuery(queryText.value))
const aggregationNotice = computed(() => {
  if (
    props.workbench.aggregateFunction.value === 'none' ||
    props.workbench.aggregationPassthroughFields.value.length === 0
  ) {
    return ''
  }

  return `String/boolean fields bypass aggregation automatically: ${props.workbench.aggregationPassthroughFields.value.join(', ')}.`
})

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

function toggleSelectedMeasurement(measurement: string) {
  void props.workbench.toggleMeasurement(measurement)
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

function updateAggregateWindow(value: string | number | null) {
  props.workbench.aggregateWindow.value = String(value ?? '')
}

function updateQuerySwitch(value: boolean) {
  isQueryView.value = value

  if (value) {
    props.workbench.syncQueryFromExplorer()
  }
}

function updateQueryText(value: string) {
  props.workbench.updateQueryText(value)
}

function loadCompletionSchema(request: FluxAutocompleteRequest) {
  return props.workbench.resolveFluxAutocompleteSchema({
    bucket: request.references.bucket,
    measurement: request.references.measurement,
    tagKey: request.references.tagKey,
  })
}
</script>

<template>
  <div class="panel-shell">
    <div class="panel-toolbar">
      <NFlex :size="8" align="center">
        <NSwitch :value="isQueryView" @update:value="updateQuerySwitch">
          <template #checked>Query</template>
          <template #unchecked>Explorer</template>
        </NSwitch>
        <NButton
          tertiary
          :disabled="!workbench.hasConnection.value"
          :render-icon="renderNaiveIcon(RefreshOutline)"
          @click="workbench.refreshSchema()"
        >
          Refresh schema
        </NButton>
        <NButton
          v-if="workbench.hasConnection.value"
          tertiary
          type="warning"
          :render-icon="renderNaiveIcon(LogOutOutline)"
          @click="emit('disconnect')"
        >
          Disconnect
        </NButton>
        <NButton
          type="primary"
          :disabled="!workbench.canRunQuery.value"
          :loading="workbench.isQueryRunning.value"
          :render-icon="renderNaiveIcon(PlayOutline)"
          @click="workbench.runQuery()"
        >
          Run query
        </NButton>
      </NFlex>
    </div>

    <div v-if="!isQueryView" class="settings-shell">
      <NForm label-placement="top">
        <div class="settings-row">
          <NFormItem label="Range preset" class="setting-item preset-item">
            <NSelect
              :value="workbench.rangePreset.value"
              :options="workbench.rangePresetOptions"
              @update:value="updateRangePreset"
            />
          </NFormItem>

          <NFormItem
            v-if="workbench.rangePreset.value === 'custom'"
            label="Datetime range"
            class="setting-item range-item"
          >
            <NDatePicker
              clearable
              type="datetimerange"
              :value="customRangeValue"
              @update:value="
                (value) => updateCustomRange(value as [number, number] | null)
              "
            />
          </NFormItem>

          <NFormItem label="Aggregate fn" class="setting-item">
            <NSelect
              :value="workbench.aggregateFunction.value"
              :options="workbench.aggregateFunctionOptions"
              @update:value="updateAggregateFunction"
            />
          </NFormItem>

          <NFormItem label="Aggregate window" class="setting-item">
            <NSelect
              filterable
              tag
              :disabled="workbench.aggregateFunction.value === 'none'"
              :value="workbench.aggregateWindow.value"
              :options="aggregateWindowOptions"
              placeholder="1s"
              @update:value="updateAggregateWindow"
            />
          </NFormItem>

          <NFormItem label="Row limit" class="setting-item">
            <NInputNumber
              :value="workbench.limit.value"
              :min="100"
              :step="100"
              placeholder="2000"
              @update:value="(value) => (workbench.limit.value = value ?? 2000)"
            />
          </NFormItem>
        </div>
      </NForm>
      <p v-if="aggregationNotice" class="settings-note">
        {{ aggregationNotice }}
      </p>
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
          title="Measurements"
          :count="workbench.measurements.value.length"
          count-type="info"
        >
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
                  active:
                    workbench.selectedMeasurements.value.includes(measurement),
                }"
                @click="toggleSelectedMeasurement(measurement)"
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
            <NEmpty
              v-else
              description="Select one or more measurements to load fields."
            />
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
          <FluxCodeEditor
            :model-value="queryText"
            :completion-schema-provider="loadCompletionSchema"
            :validation-issues="queryValidationIssues"
            placeholder="Switch back to explorer to define a query."
            @update:model-value="updateQueryText"
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
  gap: 12px;
  min-width: 0;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.settings-shell {
  padding: 10px 12px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
}

.settings-note {
  margin: 2px 2px 0;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(71, 85, 105, 0.9);
}

.settings-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
  flex-wrap: nowrap;
}

.setting-item {
  min-width: 0;
  flex: 1 1 0;
  margin-bottom: 0;
}

.preset-item {
  flex: 1 1 0;
}

.range-item {
  flex: 1 1 0;
}

.setting-item :deep(.n-base-selection),
.setting-item :deep(.n-date-picker),
.setting-item :deep(.n-input-number) {
  width: 100%;
}

.flow-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.selection-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.selection-item {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: white;
  padding: 10px 12px;
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
  font-size: 0.78rem;
  color: rgba(71, 85, 105, 0.84);
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.7);
}

.filter-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: #0f172a;
}

.code-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

@media (max-width: 1400px) {
  .flow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-row {
    flex-wrap: wrap;
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
}
</style>
