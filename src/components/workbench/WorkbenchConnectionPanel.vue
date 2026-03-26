<script setup lang="ts">
import {
  NButton,
  NFlex,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NTag,
} from 'naive-ui'

import type { InfluxWorkbenchController } from '@/composables/useInfluxWorkbench'

const props = defineProps<{
  workbench: InfluxWorkbenchController
}>()

function updateBucket(value: string) {
  props.workbench.connection.bucket = value
}
</script>

<template>
  <div class="panel-shell">
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
              @update:value="updateBucket"
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

      <NFlex v-if="workbench.health.value" class="health-tags" :size="8">
        <NTag :type="workbench.health.value.status === 'pass' ? 'success' : 'warning'">
          {{ workbench.health.value.status ?? 'unknown' }}
        </NTag>
        <NTag type="info">{{ workbench.health.value.name ?? 'InfluxDB' }}</NTag>
        <NTag v-if="workbench.health.value.version" type="default">
          {{ workbench.health.value.version }}
        </NTag>
      </NFlex>
    </NForm>
  </div>
</template>

<style scoped>
.panel-shell {
  padding-top: 4px;
}

.health-tags {
  margin-top: 12px;
}
</style>
