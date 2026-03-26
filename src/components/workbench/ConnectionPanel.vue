<script setup lang="ts">
import {
  NAlert,
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
    <div class="panel-copy">
      <h2 class="panel-title">Connect to InfluxDB</h2>
      <p class="panel-description">
        Explorer와 Result 패널은 한 화면에서 함께 동작합니다. 먼저 연결을
        완료하면 overlay가 사라지고 바로 탐색을 이어갈 수 있습니다.
      </p>
    </div>

    <NAlert
      :title="workbench.status.value.title"
      :type="workbench.status.value.type"
      :bordered="false"
      class="status-alert"
    >
      {{ workbench.status.value.message }}
    </NAlert>

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

        <NGi>
          <NFormItem label="Organization">
            <NInput
              v-model:value="workbench.connection.org"
              placeholder="influx-vue"
            />
          </NFormItem>
        </NGi>

        <NGi>
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
          Connect
        </NButton>
      </NFlex>

      <NFlex v-if="workbench.health.value" class="health-tags" :size="8">
        <NTag
          :type="
            workbench.health.value.status === 'pass' ? 'success' : 'warning'
          "
        >
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
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-title {
  margin: 0;
  font-size: 1.45rem;
}

.panel-description {
  margin: 0;
  color: rgba(71, 85, 105, 0.9);
}

.status-alert,
.health-tags {
  margin-top: 2px;
}
</style>
