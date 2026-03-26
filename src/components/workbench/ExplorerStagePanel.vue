<script setup lang="ts">
import { NTag } from 'naive-ui'

defineProps<{
  title: string
  count?: number | string
  countType?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
}>()
</script>

<template>
  <section class="stage-panel">
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
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
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
