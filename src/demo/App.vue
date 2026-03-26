<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NLayout,
  NLayoutContent,
  NMessageProvider,
} from 'naive-ui'

import { InfluxWorkbench } from '@/index'

const demoConnection = {
  url: 'http://127.0.0.1:8086',
  org: 'influx-vue',
  bucket: 'demo-metrics',
  token: 'influx-vue-admin-token',
}
</script>

<template>
  <NConfigProvider>
    <NDialogProvider>
      <NMessageProvider>
        <NLayout class="demo-layout">
          <NLayoutContent content-style="padding: 32px 20px 56px;">
            <InfluxWorkbench
              :initial-connection="demoConnection"
              auto-connect
              auto-run-query
            />
          </NLayoutContent>
        </NLayout>
      </NMessageProvider>
    </NDialogProvider>
  </NConfigProvider>
</template>
