<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  AnalyticsOutline,
  InformationCircleOutline,
  LayersOutline,
  StatsChartOutline,
} from '@vicons/ionicons5'
import { NAlert, NButton, NCard, NFlex, NModal, NPopover, NTag } from 'naive-ui'

import { useInfluxWorkbench } from '@/composables/useInfluxWorkbench'
import ConnectionPanel from '@/components/workbench/ConnectionPanel.vue'
import ExplorerPanel from '@/components/workbench/ExplorerPanel.vue'
import ResultPanel from '@/components/workbench/ResultPanel.vue'
import type { InfluxConnectionConfig } from '@/services/influx/types'
import type { StatusMessage } from '@/services/influx/types'
import type {
  InfluxWorkbenchConnectError,
  InfluxWorkbenchConnectEvent,
  InfluxWorkbenchDisconnectEvent,
  InfluxWorkbenchExposed,
  InfluxWorkbenchProps,
} from '@/components/workbench/types'
import { renderNaiveIcon } from '@/utils/renderNaiveIcon'

const props = withDefaults(defineProps<InfluxWorkbenchProps>(), {
  title: 'Influx Vue Workbench',
  subtitle:
    'Bucket에서 measurement, field, tag filter를 선택하고, Flux와 결과/대시보드를 한 화면에서 확인하는 InfluxDB explorer입니다.',
  autoConnect: false,
  autoRunQuery: false,
  initialConnection: undefined,
  hiddenSections: () => [],
})

const emit = defineEmits<{
  connect: [payload: InfluxWorkbenchConnectEvent]
  'connect-error': [payload: InfluxWorkbenchConnectError]
  disconnect: [payload: InfluxWorkbenchDisconnectEvent]
}>()

const workbench = useInfluxWorkbench({
  createDataSource: props.createDataSource,
})

const showHero = computed(() => !props.hiddenSections.includes('hero'))
const showConnectionPanel = computed(
  () => !props.hiddenSections.includes('connection'),
)
const showExplorerPanel = computed(
  () => !props.hiddenSections.includes('explorer'),
)
const showResultPanel = computed(
  () => !props.hiddenSections.includes('results'),
)
const floatingStatus = ref<StatusMessage | null>(null)
const queryErrorDialog = ref<StatusMessage | null>(null)
const shouldAutoConnect = computed(
  () =>
    props.autoConnect ||
    (!showConnectionPanel.value && Boolean(props.initialConnection)),
)
const showConnectionOverlay = computed(
  () => showConnectionPanel.value && !workbench.hasConnection.value,
)

function currentConnection(): InfluxConnectionConfig {
  return {
    url: workbench.connection.url,
    org: workbench.connection.org,
    token: workbench.connection.token,
    bucket: workbench.connection.bucket,
  }
}

function applyConnection(connection: Partial<InfluxConnectionConfig>) {
  Object.assign(workbench.connection, connection)

  if ('bucket' in connection) {
    workbench.selectedBucket.value = connection.bucket ?? ''
  }
}

async function connectWorkbench() {
  const connected = await workbench.connect()

  if (connected) {
    emit('connect', {
      connection: currentConnection(),
      health: workbench.health.value,
      bucketCount: workbench.buckets.value.length,
    })
    return true
  }

  if (workbench.lastConnectionFailure.value) {
    emit('connect-error', workbench.lastConnectionFailure.value)
  }

  return false
}

function disconnectWorkbench() {
  const connection = currentConnection()
  workbench.disconnect()
  emit('disconnect', { connection })
}

function handleQueryErrorModal(show: boolean) {
  if (!show) {
    queryErrorDialog.value = null
  }
}

async function runQueryWorkbench() {
  return workbench.runQuery()
}

watch(
  () =>
    `${workbench.status.value.type}:${workbench.status.value.title}:${workbench.status.value.message}`,
  (_nextValue, _previousValue, onCleanup) => {
    if (workbench.status.value.title === 'Ready to connect') {
      return
    }

    floatingStatus.value = { ...workbench.status.value }

    if (
      workbench.status.value.type === 'error' &&
      ['Query failed', 'Query validation failed'].includes(
        workbench.status.value.title,
      )
    ) {
      queryErrorDialog.value = { ...workbench.status.value }
    }

    const timeoutId = window.setTimeout(() => {
      floatingStatus.value = null
    }, 3000)

    onCleanup(() => window.clearTimeout(timeoutId))
  },
)

async function initializeWorkbench() {
  if (props.initialConnection) {
    applyConnection(props.initialConnection)
  }

  if (!shouldAutoConnect.value) {
    return
  }

  const connected = await connectWorkbench()
  if (connected && props.autoRunQuery) {
    await runQueryWorkbench()
  }
}

onMounted(async () => {
  await initializeWorkbench()
})

defineExpose<InfluxWorkbenchExposed>({
  applyConnection,
  connect: connectWorkbench,
  disconnect: disconnectWorkbench,
  runQuery: runQueryWorkbench,
})
</script>

<template>
  <div class="workbench-shell">
    <NCard v-if="showHero" class="hero-card" :bordered="false">
      <div class="hero-topline">
        <NFlex :size="8" align="center" wrap>
          <NButton
            round
            size="small"
            secondary
            strong
            :render-icon="renderNaiveIcon(AnalyticsOutline)"
          >
            InfluxDB Explorer
          </NButton>
          <NTag
            size="small"
            :type="workbench.hasConnection.value ? 'success' : 'warning'"
          >
            {{
              workbench.hasConnection.value
                ? 'Connected'
                : 'Connection required'
            }}
          </NTag>
          <NPopover trigger="hover">
            <template #trigger>
              <NButton
                quaternary
                size="small"
                :render-icon="renderNaiveIcon(LayersOutline)"
              >
                Selection
              </NButton>
            </template>
            <div class="popover-content stats-popover">
              <div class="stat-row">
                <span>Bucket</span>
                <strong>{{
                  workbench.selectedBucket.value || 'pending'
                }}</strong>
              </div>
              <div class="stat-row">
                <span>Measurement</span>
                <strong>{{
                  workbench.selectedMeasurement.value || 'pending'
                }}</strong>
              </div>
            </div>
          </NPopover>
          <NPopover trigger="hover">
            <template #trigger>
              <NButton
                quaternary
                size="small"
                :render-icon="renderNaiveIcon(InformationCircleOutline)"
              >
                Status
              </NButton>
            </template>
            <div class="popover-content">
              <strong>{{ workbench.status.value.title }}</strong>
              <p>{{ workbench.status.value.message }}</p>
            </div>
          </NPopover>
          <NPopover trigger="hover">
            <template #trigger>
              <NButton
                quaternary
                size="small"
                :render-icon="renderNaiveIcon(StatsChartOutline)"
              >
                Stats
              </NButton>
            </template>
            <div class="popover-content stats-popover">
              <div class="stat-row">
                <span>Rows</span>
                <strong>{{ workbench.summary.value.rowCount }}</strong>
              </div>
              <div class="stat-row">
                <span>Series</span>
                <strong>{{ workbench.summary.value.seriesCount }}</strong>
              </div>
              <div class="stat-row">
                <span>Selected fields</span>
                <strong>{{ workbench.selectedFields.value.length }}</strong>
              </div>
            </div>
          </NPopover>
        </NFlex>
      </div>
    </NCard>

    <div class="workspace">
      <NCard
        v-if="showResultPanel"
        class="surface-card result-surface"
        :bordered="false"
      >
        <ResultPanel :workbench="workbench" />
      </NCard>

      <NCard
        v-if="showExplorerPanel"
        class="surface-card explorer-surface"
        :bordered="false"
      >
        <ExplorerPanel
          :workbench="workbench"
          @disconnect="disconnectWorkbench"
        />
      </NCard>

      <div v-if="showConnectionOverlay" class="connection-overlay">
        <div class="overlay-backdrop" />
        <NCard class="connection-card" :bordered="false">
          <ConnectionPanel :workbench="workbench" @connect="connectWorkbench" />
        </NCard>
      </div>
    </div>

    <transition name="floating-status">
      <NAlert
        v-if="floatingStatus"
        class="floating-status"
        :title="floatingStatus.title"
        :type="floatingStatus.type"
        :bordered="false"
      >
        {{ floatingStatus.message }}
      </NAlert>
    </transition>

    <NModal
      :show="Boolean(queryErrorDialog)"
      preset="card"
      title="Query error"
      class="query-error-modal"
      @update:show="handleQueryErrorModal"
    >
      <template v-if="queryErrorDialog">
        <strong>{{ queryErrorDialog.title }}</strong>
        <p class="query-error-message">{{ queryErrorDialog.message }}</p>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.workbench-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-card {
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(
      circle at top right,
      rgba(34, 197, 94, 0.18),
      transparent 24rem
    ),
    radial-gradient(
      circle at top left,
      rgba(14, 165, 233, 0.16),
      transparent 18rem
    ),
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.96),
      rgba(247, 251, 252, 0.98)
    );
}

.hero-card :deep(.n-card__content) {
  padding: 10px 14px;
}

.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
}

.popover-content {
  min-width: 220px;
}

.popover-content p {
  margin: 6px 0 0;
  color: rgba(71, 85, 105, 0.88);
}

.stats-popover {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.workspace {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.surface-card {
  min-width: 0;
  border-radius: 28px;
}

.surface-card :deep(.n-card__content) {
  padding: 10px 12px;
}

.result-surface {
  min-height: 0;
}

.explorer-surface {
  min-height: 680px;
}

.query-error-modal {
  width: min(560px, calc(100vw - 32px));
}

.query-error-message {
  margin: 10px 0 0;
  white-space: pre-wrap;
  color: rgba(51, 65, 85, 0.96);
}

.connection-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 10;
}

.overlay-backdrop {
  position: absolute;
  inset: 0;
  border-radius: 28px;
  background: rgba(248, 250, 252, 0.82);
  backdrop-filter: blur(8px);
}

.connection-card {
  position: relative;
  z-index: 1;
  width: min(680px, 100%);
  border-radius: 26px;
  box-shadow: 0 28px 90px rgba(15, 23, 42, 0.16);
}

.floating-status {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 30;
  width: min(420px, calc(100vw - 32px));
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.18);
}

.floating-status-enter-active,
.floating-status-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.floating-status-enter-from,
.floating-status-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 1200px) {
  .workbench-shell {
    gap: 8px;
  }
}
</style>
