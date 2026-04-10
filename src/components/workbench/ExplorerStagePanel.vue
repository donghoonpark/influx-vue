<script setup lang="ts">
import { computed } from 'vue'

import { NTag, useThemeVars } from 'naive-ui'

import { isDarkColor, withAlpha } from '@/utils/themeColor'

defineProps<{
  title: string
  count?: number | string
  countType?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
}>()

const themeVars = useThemeVars()
const themeStyle = computed(() => {
  const dark = isDarkColor(themeVars.value.bodyColor)

  return {
    '--influx-stage-border': withAlpha(
      themeVars.value.borderColor,
      dark ? 0.78 : 0.92,
    ),
    '--influx-stage-bg': dark
      ? withAlpha(themeVars.value.cardColor, 0.9)
      : withAlpha(themeVars.value.cardColor, 0.84),
  }
})
</script>

<template>
  <section class="stage-panel" :style="themeStyle">
    <div class="stage-header">
      <strong>{{ title }}</strong>
      <div class="stage-meta">
        <slot name="actions" />
        <NTag
          v-if="count !== undefined"
          size="small"
          :type="countType ?? 'default'"
        >
          {{ count }}
        </NTag>
      </div>
    </div>

    <div class="stage-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.stage-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 360px;
  padding: 10px 12px;
  border: 1px solid var(--influx-stage-border);
  border-radius: 16px;
  background: var(--influx-stage-bg);
}

.stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stage-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stage-body {
  min-height: 0;
  flex: 1;
}
</style>
