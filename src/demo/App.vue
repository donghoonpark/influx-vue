<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  NAlert,
  NConfigProvider,
  NDialogProvider,
  NFlex,
  NLayout,
  NLayoutContent,
  NMessageProvider,
  NSwitch,
  NTabPane,
  NTabs,
  NText,
  darkTheme,
} from 'naive-ui'

import {
  InfluxDashboard,
  InfluxWorkbench,
  createDashboardDefinition,
  createDashboardPanel,
  exportDashboardYaml,
} from '@/index'

const demoOrigin =
  typeof window === 'undefined'
    ? 'http://127.0.0.1:4173'
    : window.location.origin
const demoThemeStorageKey = 'influx-vue-demo-theme'
const isDarkTheme = ref(
  typeof window !== 'undefined'
    ? window.localStorage.getItem(demoThemeStorageKey) === 'dark'
    : false,
)

const demoConnection = computed(() => ({
  url: demoOrigin,
  org: 'influx-vue',
  bucket: 'demo-metrics',
  token: 'influx-vue-admin-token',
}))

const demoDashboardYaml = computed(() =>
  exportDashboardYaml(
    createDashboardDefinition({
      name: 'Influx dashboard demo',
      description:
        'YAML-driven dashboard rendering against the seeded demo InfluxDB.',
      columns: 2,
      connection: {
        url: demoOrigin,
        org: 'influx-vue',
        authMethod: 'token',
        token: 'influx-vue-admin-token',
      },
      panels: [
        createDashboardPanel({
          id: 'system-cpu',
          title: 'System CPU',
          visualization: 'chart',
          queryMode: 'builder',
          query: {
            bucket: 'demo-metrics',
            measurement: 'system',
            fields: ['usage_user', 'usage_system'],
            rangePreset: 'last_24h',
            customStart: '',
            customStop: '',
            aggregateWindow: '1s',
            aggregateFunction: 'mean',
            limit: 2000,
            tagFilters: [],
          },
        }),
        createDashboardPanel({
          id: 'system-events',
          title: 'System Events',
          visualization: 'split',
          queryMode: 'builder',
          query: {
            bucket: 'demo-metrics',
            measurement: 'system_event',
            fields: ['message'],
            rangePreset: 'last_24h',
            customStart: '',
            customStop: '',
            aggregateWindow: '',
            aggregateFunction: 'none',
            limit: 2000,
            tagFilters: [],
          },
        }),
        createDashboardPanel({
          id: 'sensor-temperature',
          title: 'Sensor Temperature',
          visualization: 'scatter',
          queryMode: 'builder',
          query: {
            bucket: 'edge-sensors',
            measurement: 'temperature',
            fields: ['celsius'],
            rangePreset: 'last_24h',
            customStart: '',
            customStop: '',
            aggregateWindow: '1s',
            aggregateFunction: 'mean',
            limit: 2000,
            tagFilters: [],
          },
        }),
        createDashboardPanel({
          id: 'sensor-events',
          title: 'Sensor Events',
          visualization: 'split',
          queryMode: 'builder',
          query: {
            bucket: 'edge-sensors',
            measurement: 'sensor_event',
            fields: ['message'],
            rangePreset: 'last_24h',
            customStart: '',
            customStop: '',
            aggregateWindow: '',
            aggregateFunction: 'none',
            limit: 2000,
            tagFilters: [],
          },
        }),
      ],
    }),
  ),
)

watch(isDarkTheme, (enabled) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    demoThemeStorageKey,
    enabled ? 'dark' : 'light',
  )
})
</script>

<template>
  <NConfigProvider :theme="isDarkTheme ? darkTheme : undefined">
    <NDialogProvider>
      <NMessageProvider>
        <NLayout
          class="demo-layout"
          :class="{ 'demo-layout--dark': isDarkTheme }"
        >
          <NLayoutContent content-style="padding: 32px 20px 56px;">
            <div class="demo-toolbar">
              <NFlex justify="space-between" align="center" wrap :size="[12, 12]">
                <NText depth="3">
                  Toggle the Naive UI dark theme to verify workbench styling.
                </NText>
                <NFlex align="center" :size="8">
                  <NText depth="3">Dark theme</NText>
                  <NSwitch v-model:value="isDarkTheme" />
                </NFlex>
              </NFlex>
            </div>

            <NTabs type="line" animated>
              <NTabPane name="workbench" tab="Workbench">
                <NAlert type="info" :bordered="false" class="demo-note">
                  <NText depth="3">
                    Explorer workbench wired to the local demo InfluxDB through
                    the Vite `/api` proxy.
                  </NText>
                </NAlert>

                <InfluxWorkbench
                  :initial-connection="demoConnection"
                  auto-connect
                  auto-run-query
                />
              </NTabPane>

              <NTabPane name="dashboard" tab="Dashboard YAML">
                <NAlert type="info" :bordered="false" class="demo-note">
                  <NText depth="3">
                    Standalone dashboard component driven only by a YAML string,
                    including seeded text event panels.
                  </NText>
                </NAlert>

                <InfluxDashboard :yaml="demoDashboardYaml" show-time-controls />
              </NTabPane>
            </NTabs>
          </NLayoutContent>
        </NLayout>
      </NMessageProvider>
    </NDialogProvider>
  </NConfigProvider>
</template>

<style scoped>
.demo-toolbar {
  margin-bottom: 18px;
}

.demo-note {
  margin-bottom: 16px;
}
</style>
