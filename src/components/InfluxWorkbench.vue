<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { NButton, NCard, NFlex, NTabPane, NTabs, NText } from 'naive-ui'

import {
  useInfluxWorkbench,
  type InfluxWorkbenchController,
} from '@/composables/useInfluxWorkbench'
import WorkbenchConnectionPanel from '@/components/workbench/WorkbenchConnectionPanel.vue'
import WorkbenchDashboardPanel from '@/components/workbench/WorkbenchDashboardPanel.vue'
import WorkbenchExplorerPanel from '@/components/workbench/WorkbenchExplorerPanel.vue'
import WorkbenchHeroPanel from '@/components/workbench/WorkbenchHeroPanel.vue'
import WorkbenchQueryPanel from '@/components/workbench/WorkbenchQueryPanel.vue'
import WorkbenchResultsPanel from '@/components/workbench/WorkbenchResultsPanel.vue'
import WorkbenchSummaryPanel from '@/components/workbench/WorkbenchSummaryPanel.vue'
import WorkbenchTagFiltersPanel from '@/components/workbench/WorkbenchTagFiltersPanel.vue'
import type { InfluxConnectionConfig } from '@/services/influx/types'
import type {
  InfluxWorkbenchSectionKey,
  InfluxWorkbenchStepDefinition,
  InfluxWorkbenchStepKey,
} from '@/components/workbench/types'

const STEP_DEFINITIONS: InfluxWorkbenchStepDefinition[] = [
  {
    key: 'connection',
    label: 'Connect',
    description:
      'Connect to InfluxDB and confirm the token can enumerate buckets.',
    section: 'connection',
  },
  {
    key: 'explorer',
    label: 'Explorer',
    description:
      'Choose a bucket, then select a measurement and the fields you want to inspect.',
    section: 'explorer',
  },
  {
    key: 'tags',
    label: 'Tags',
    description:
      'Optionally refine the selected measurement with tag keys and tag values.',
    section: 'tags',
  },
  {
    key: 'query',
    label: 'Query',
    description:
      'Tune time range and aggregation, then preview or edit the generated Flux.',
    section: 'query',
  },
  {
    key: 'results',
    label: 'Results',
    description: 'Review table and chart output once the query has executed.',
    section: 'results',
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    description:
      'Save the current query as YAML-backed panels and run them together in a Grafana-style grid.',
    section: 'dashboard',
  },
]

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
      'Bucket에서 measurement, field, tag, tag value까지 순차적으로 탐색한 뒤 Flux 쿼리와 시각화로 이어지는 InfluxDB explorer를 위한 워크벤치입니다.',
    autoConnect: false,
    autoRunQuery: false,
    initialConnection: undefined,
    hiddenSections: () => [],
  },
)

const workbench = useInfluxWorkbench()
const activeStep = ref<InfluxWorkbenchStepKey>('connection')

function isSectionVisible(section: InfluxWorkbenchSectionKey) {
  return !props.hiddenSections.includes(section)
}

const visibleSteps = computed(() =>
  STEP_DEFINITIONS.filter((step) => isSectionVisible(step.section)),
)

const stepStatus = computed<Record<InfluxWorkbenchStepKey, boolean>>(() => ({
  connection: workbench.hasConnection.value,
  explorer:
    workbench.hasConnection.value &&
    Boolean(workbench.selectedBucket.value) &&
    Boolean(workbench.selectedMeasurement.value) &&
    workbench.selectedFields.value.length > 0,
  tags:
    workbench.hasConnection.value &&
    Boolean(workbench.selectedBucket.value) &&
    Boolean(workbench.selectedMeasurement.value) &&
    workbench.selectedFields.value.length > 0,
  query:
    workbench.hasConnection.value &&
    Boolean(workbench.selectedBucket.value) &&
    Boolean(workbench.selectedMeasurement.value) &&
    workbench.selectedFields.value.length > 0,
  results: workbench.hasExecutedQuery.value,
  dashboard: workbench.dashboardPanels.value.length > 0,
}))

function isStepEnabled(stepKey: InfluxWorkbenchStepKey) {
  switch (stepKey) {
    case 'connection':
      return true
    case 'explorer':
      return workbench.hasConnection.value
    case 'tags':
      return stepStatus.value.explorer
    case 'query':
      return stepStatus.value.explorer
    case 'results':
      return workbench.hasExecutedQuery.value
    case 'dashboard':
      return workbench.hasConnection.value
  }
}

function stepComponent(stepKey: InfluxWorkbenchStepKey) {
  const components: Record<InfluxWorkbenchStepKey, object> = {
    connection: WorkbenchConnectionPanel,
    explorer: WorkbenchExplorerPanel,
    tags: WorkbenchTagFiltersPanel,
    query: WorkbenchQueryPanel,
    results: WorkbenchResultsPanel,
    dashboard: WorkbenchDashboardPanel,
  }

  return components[stepKey]
}

const previousStep = computed(() => {
  const index = visibleSteps.value.findIndex(
    (step) => step.key === activeStep.value,
  )
  if (index <= 0) {
    return null
  }

  return visibleSteps.value[index - 1]
})

const nextStep = computed(() => {
  const index = visibleSteps.value.findIndex(
    (step) => step.key === activeStep.value,
  )
  if (index < 0 || index === visibleSteps.value.length - 1) {
    return null
  }

  return visibleSteps.value[index + 1]
})

const canAdvance = computed(() =>
  nextStep.value ? isStepEnabled(nextStep.value.key) : false,
)

const shouldAutoConnect = computed(
  () =>
    props.autoConnect ||
    (!isSectionVisible('connection') && Boolean(props.initialConnection)),
)

watch(
  visibleSteps,
  (steps) => {
    if (steps.length === 0) {
      return
    }

    if (!steps.some((step) => step.key === activeStep.value)) {
      activeStep.value = steps[0].key
    }
  },
  { immediate: true },
)

function goToStep(stepKey: string | number) {
  const key = String(stepKey) as InfluxWorkbenchStepKey
  if (
    visibleSteps.value.some((step) => step.key === key) &&
    isStepEnabled(key)
  ) {
    activeStep.value = key
  }
}

function goToPreviousStep() {
  if (previousStep.value) {
    activeStep.value = previousStep.value.key
  }
}

function goToNextStep() {
  if (nextStep.value && isStepEnabled(nextStep.value.key)) {
    activeStep.value = nextStep.value.key
  }
}

async function initializeWorkbench(controller: InfluxWorkbenchController) {
  if (props.initialConnection) {
    Object.assign(controller.connection, props.initialConnection)
    if (props.initialConnection.bucket) {
      controller.selectedBucket.value = props.initialConnection.bucket
    }
  }

  if (!shouldAutoConnect.value) {
    return
  }

  const connected = await controller.connect()
  if (!connected) {
    return
  }

  if (visibleSteps.value.some((step) => step.key === 'explorer')) {
    activeStep.value = 'explorer'
  }

  if (props.autoRunQuery) {
    const ran = await controller.runQuery()
    if (ran && visibleSteps.value.some((step) => step.key === 'results')) {
      activeStep.value = 'results'
    } else if (
      ran &&
      visibleSteps.value.some((step) => step.key === 'dashboard')
    ) {
      activeStep.value = 'dashboard'
    } else if (visibleSteps.value.some((step) => step.key === 'query')) {
      activeStep.value = 'query'
    }
  }
}

onMounted(async () => {
  await initializeWorkbench(workbench)
})
</script>

<template>
  <div class="workbench">
    <NCard v-if="isSectionVisible('hero')" class="hero-card" :bordered="false">
      <WorkbenchHeroPanel
        :title="title"
        :subtitle="subtitle"
        :status="workbench.status.value"
      />
    </NCard>

    <NCard class="step-card" :bordered="false">
      <NTabs
        :value="activeStep"
        type="segment"
        animated
        @update:value="goToStep"
      >
        <NTabPane
          v-for="step in visibleSteps"
          :key="step.key"
          :name="step.key"
          :tab="step.label"
          :disabled="!isStepEnabled(step.key)"
        />
      </NTabs>

      <div v-if="visibleSteps.length > 0" class="step-content">
        <div class="step-header">
          <div>
            <h2 class="step-title">
              {{ visibleSteps.find((step) => step.key === activeStep)?.label }}
            </h2>
            <NText depth="3">
              {{
                visibleSteps.find((step) => step.key === activeStep)
                  ?.description
              }}
            </NText>
          </div>
        </div>

        <component :is="stepComponent(activeStep)" :workbench="workbench" />

        <WorkbenchSummaryPanel
          v-if="
            isSectionVisible('summary') &&
            activeStep === 'query' &&
            !isSectionVisible('results')
          "
          :workbench="workbench"
          class="summary-inline"
        />

        <div
          v-if="activeStep === 'results' && isSectionVisible('summary')"
          class="results-summary"
        >
          <WorkbenchSummaryPanel :workbench="workbench" />
        </div>

        <NFlex
          v-if="previousStep || nextStep"
          justify="space-between"
          align="center"
          class="step-actions"
        >
          <NButton v-if="previousStep" tertiary @click="goToPreviousStep()">
            Back to {{ previousStep.label }}
          </NButton>
          <span v-else />

          <NButton
            v-if="nextStep"
            type="primary"
            :disabled="!canAdvance"
            @click="goToNextStep()"
          >
            Continue to {{ nextStep.label }}
          </NButton>
        </NFlex>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.workbench {
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

.step-card {
  border-radius: 28px;
}

.step-content {
  margin-top: 18px;
}

.step-header {
  margin-bottom: 18px;
}

.step-title {
  margin: 0 0 8px;
  font-size: 1.4rem;
}

.step-actions {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
}

.summary-inline,
.results-summary {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
}
</style>
