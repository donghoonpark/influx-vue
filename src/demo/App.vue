<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NLayout,
  NLayoutContent,
  NMessageProvider,
} from 'naive-ui'

import { InfluxWorkbench } from '@/index'
</script>

<template>
  <NConfigProvider>
    <NDialogProvider>
      <NMessageProvider>
        <NLayout class="demo-layout">
          <NLayoutContent content-style="padding: 32px 20px 56px;">
            <InfluxWorkbench />
          </NLayoutContent>
        </NLayout>
      </NMessageProvider>
    </NDialogProvider>
  </NConfigProvider>
</template>
