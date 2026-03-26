<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { NCard, NTag } from 'naive-ui'

import { useInfluxWorkbench } from '@/composables/useInfluxWorkbench'
import ConnectionPanel from '@/components/workbench/ConnectionPanel.vue'
import ExplorerPanel from '@/components/workbench/ExplorerPanel.vue'
import ResultPanel from '@/components/workbench/ResultPanel.vue'
import type { InfluxConnectionConfig } from '@/services/influx/types'
import type { InfluxWorkbenchSectionKey } from '@/components/workbench/types'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    autoConnect?: boolean
    autoRunQuery?: boolean
    initialConnection?: Partial<InfluxConnectionConfig>
    hiddenSections?: InfluxWorkbenchSectionKey[]
  }>(),
  {
    title: 'Influx Vue Workbench',
    subtitle:
      'Bucket에서 measurement, field, tag filter를 선택하고, Flux와 결과/대시보드를 한 화면에서 확인하는 InfluxDB explorer입니다.',
    autoConnect: false,
    autoRunQuery: false,
    initialConnection: undefined,
    hiddenSections: () => [],
  },
)

const workbench = useInfluxWorkbench()

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
const shouldAutoConnect = computed(
  () =>
    props.autoConnect ||
    (!showConnectionPanel.value && Boolean(props.initialConnection)),
)
const showConnectionOverlay = computed(
  () => showConnectionPanel.value && !workbench.hasConnection.value,
)

async function initializeWorkbench() {
  if (props.initialConnection) {
    Object.assign(workbench.connection, props.initialConnection)
    if (props.initialConnection.bucket) {
      workbench.selectedBucket.value = props.initialConnection.bucket
    }
  }

  if (!shouldAutoConnect.value) {
    return
  }

  const connected = await workbench.connect()
  if (connected && props.autoRunQuery) {
    await workbench.runQuery()
  }
}

onMounted(async () => {
  await initializeWorkbench()
})
</script>

<template>
  <div class="workbench-shell">
    <NCard v-if="showHero" class="hero-card" :bordered="false">
      <div class="hero-copy">
        <div>
          <div class="hero-topline">
            <NTag round size="small" type="success">Single-page explorer</NTag>
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
          </div>
          <h1 class="hero-title">{{ title }}</h1>
          <p class="hero-subtitle">{{ subtitle }}</p>
        </div>
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
        <ExplorerPanel :workbench="workbench" />
      </NCard>

      <div v-if="showConnectionOverlay" class="connection-overlay">
        <div class="overlay-backdrop" />
        <NCard class="connection-card" :bordered="false">
          <ConnectionPanel :workbench="workbench" />
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workbench-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.hero-topline {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.hero-title {
  margin: 0 0 10px;
  font-size: clamp(2rem, 3vw, 3rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

.hero-subtitle {
  margin: 0;
  max-width: 64ch;
  color: rgba(15, 23, 42, 0.82);
}

.workspace {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.surface-card {
  min-width: 0;
  border-radius: 28px;
}

.result-surface {
  min-height: 520px;
}

.explorer-surface {
  min-height: 760px;
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

@media (max-width: 1200px) {
  .workbench-shell {
    gap: 14px;
  }
}
</style>
