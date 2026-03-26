<script setup lang="ts">
import {
  NButton,
  NFlex,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputNumber,
  NSelect,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'
import type { AggregateFunction, RangePresetKey } from '@/services/influx/types'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

function updateRangePreset(value: string | number | null) {
  props.workbench.rangePreset.value = String(value ?? 'last_24h') as RangePresetKey
}

function updateAggregateFunction(value: string | number | null) {
  props.workbench.aggregateFunction.value = String(
    value ?? 'mean',
  ) as AggregateFunction
}
</script>

<template>
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
            @update:value="(value) => (workbench.limit.value = value ?? 2000)"
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
          :type="workbench.queryMode.value === 'builder' ? 'primary' : 'default'"
          secondary
          @click="workbench.setQueryMode('builder')"
        >
          Builder preview
        </NButton>
        <NButton
          :type="workbench.queryMode.value === 'raw' ? 'primary' : 'default'"
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
      :label="workbench.queryMode.value === 'builder' ? 'Generated Flux' : 'Flux editor'"
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
</template>

<style scoped>
.query-toolbar {
  margin: 8px 0 12px;
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
</style>
