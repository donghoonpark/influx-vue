<script setup lang="ts">
import { NAlert, NFlex, NTag, NText } from 'naive-ui'

import type { StatusMessage } from '@/services/influx/types'

defineProps<{
  title: string
  subtitle: string
  status: StatusMessage
}>()
</script>

<template>
  <NFlex vertical :size="16">
    <NTag size="small" round type="success">Explorer-first MVP</NTag>

    <div>
      <h1 class="headline">{{ title }}</h1>
      <p class="lead">{{ subtitle }}</p>
    </div>

    <NAlert :title="status.title" :type="status.type" :bordered="false">
      {{ status.message }}
    </NAlert>

    <div class="hero-note">
      <NText depth="3">
        Security note: browser 토큰 모드는 내부 도구와 데모에 적합합니다. 외부 배포
        시에는 프록시 또는 BFF 계층을 두는 편이 안전합니다.
      </NText>
    </div>
  </NFlex>
</template>

<style scoped>
.headline {
  margin: 0 0 12px;
  font-size: clamp(2rem, 3vw, 3.2rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

.lead {
  margin: 0;
  max-width: 58ch;
  color: rgba(15, 23, 42, 0.8);
}

.hero-note {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.72);
}
</style>
