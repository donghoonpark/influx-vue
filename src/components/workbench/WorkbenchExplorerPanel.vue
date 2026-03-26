<script setup lang="ts">
import { computed } from 'vue'

import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NSelect,
  NSpin,
  NTag,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import type { InfluxBucket } from '@/services/influx/types'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

const bucketOptions = computed(() =>
  props.workbench.buckets.value.map((bucket) => ({
    label: bucket.name,
    value: bucket.name,
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

function updateSelectedFields(value: Array<string | number> | null) {
  props.workbench.selectedFields.value = (value ?? []).map(String)
}

function updateSelectedMeasurement(measurement: string) {
  void props.workbench.selectMeasurement(measurement)
}
</script>

<template>
  <div class="step-layout">
    <div class="bucket-column">
      <div class="section-heading">
        <strong>Bucket explorer</strong>
        <NTag size="small" type="info">{{ workbench.buckets.value.length }}</NTag>
      </div>

      <NSpin :show="workbench.isConnecting.value">
        <div v-if="workbench.buckets.value.length > 0" class="bucket-list">
          <button
            v-for="bucket in workbench.buckets.value"
            :key="bucket.id"
            class="bucket-button"
            :class="{ active: bucket.name === workbench.selectedBucket.value }"
            @click="workbench.selectBucket(bucket.name)"
          >
            <span class="bucket-name">{{ bucket.name }}</span>
            <span class="bucket-meta">{{ formatBucketMeta(bucket) }}</span>
          </button>
        </div>
        <NEmpty v-else description="Connect to InfluxDB to load bucket metadata." />
      </NSpin>
    </div>

    <div class="selection-column">
      <NSpin :show="workbench.isSchemaLoading.value">
        <NForm label-placement="top">
          <NFormItem label="Active bucket">
            <NSelect
              :value="workbench.selectedBucket.value"
              :options="bucketOptions"
              placeholder="Select a bucket"
              @update:value="(value) => workbench.selectBucket(String(value ?? ''))"
            />
          </NFormItem>
        </NForm>

        <div class="explorer-shelves">
          <div class="explorer-panel">
            <div class="explorer-heading">
              <span>Measurements</span>
              <NTag size="small" type="info">
                {{ workbench.measurements.value.length }}
              </NTag>
            </div>

            <div v-if="workbench.measurements.value.length > 0" class="selection-list">
              <button
                v-for="measurement in workbench.measurements.value"
                :key="measurement"
                class="selection-item"
                :class="{ active: measurement === workbench.selectedMeasurement.value }"
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

          <div class="explorer-panel">
            <div class="explorer-heading">
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

        <NFlex class="meta-row" :size="8">
          <NTag type="info">{{ workbench.measurements.value.length }} measurements</NTag>
          <NTag type="success">{{ workbench.fieldKeys.value.length }} fields</NTag>
          <NButton tertiary size="small" @click="workbench.refreshSchema()">
            Refresh schema
          </NButton>
        </NFlex>
      </NSpin>
    </div>
  </div>
</template>

<style scoped>
.step-layout {
  display: grid;
  grid-template-columns: minmax(250px, 0.9fr) minmax(0, 1.4fr);
  gap: 16px;
  align-items: start;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.bucket-column,
.selection-column {
  min-width: 0;
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

.explorer-panel {
  min-height: 300px;
  padding: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
}

.explorer-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 700;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(203, 213, 225, 0.8);
  border-radius: 12px;
  background: white;
}

.meta-row {
  margin-top: 12px;
}

@media (max-width: 1100px) {
  .step-layout,
  .explorer-shelves {
    grid-template-columns: 1fr;
  }
}
</style>
