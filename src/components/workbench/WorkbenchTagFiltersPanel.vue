<script setup lang="ts">
import { NButton, NEmpty, NFlex, NSelect, NSpin, NTag } from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import type { TagFilter } from '@/services/influx/types'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

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
</script>

<template>
  <NSpin :show="workbench.isSchemaLoading.value">
    <NFlex vertical :size="14">
      <div class="tag-summary">
        <NTag type="warning">{{ workbench.tagKeys.value.length }} tags discovered</NTag>
        <NButton
          tertiary
          size="small"
          :disabled="workbench.tagKeys.value.length === 0"
          @click="workbench.addTagFilter()"
        >
          Add tag filter
        </NButton>
      </div>

      <div v-if="workbench.tagFilters.value.length > 0" class="filter-stack">
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
              (value) => workbench.updateTagFilterKey(index, String(value ?? ''))
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
          <NButton tertiary type="error" @click="workbench.removeTagFilter(index)">
            Remove
          </NButton>
        </div>
      </div>
      <NEmpty
        v-else
        description="Tag filters are optional. Add host, region, or service filters when needed."
      />
    </NFlex>
  </NSpin>
</template>

<style scoped>
.tag-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

@media (max-width: 900px) {
  .filter-row {
    grid-template-columns: 1fr;
  }
}
</style>
