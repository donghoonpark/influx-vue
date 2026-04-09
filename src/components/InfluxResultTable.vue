<script setup lang="ts">
import { computed, h, ref } from 'vue'

import { DownloadOutline } from '@vicons/ionicons5'
import type { DataTableColumns } from 'naive-ui'
import { NAlert, NButton, NDataTable, NEmpty, NFlex, NText } from 'naive-ui'

import {
  collectColumnKeys,
  formatScalarValue,
} from '@/services/influx/resultTransforms'
import {
  downloadRowsAsCsv,
  downloadRowsAsParquet,
} from '@/services/influx/resultExport'
import type { InfluxRow } from '@/services/influx/types'
import { renderNaiveIcon } from '@/utils/renderNaiveIcon'

const props = defineProps<{
  rows: InfluxRow[]
  downloadBaseName?: string
}>()

const exportError = ref('')
const isExportingParquet = ref(false)

function clearExportError() {
  exportError.value = ''
}

function exportCsv() {
  clearExportError()

  try {
    downloadRowsAsCsv(props.rows, props.downloadBaseName)
  } catch (error) {
    exportError.value =
      error instanceof Error ? error.message : 'CSV export failed.'
  }
}

async function exportParquet() {
  clearExportError()
  isExportingParquet.value = true

  try {
    await downloadRowsAsParquet(props.rows, props.downloadBaseName)
  } catch (error) {
    exportError.value =
      error instanceof Error ? error.message : 'Parquet export failed.'
  } finally {
    isExportingParquet.value = false
  }
}

const columns = computed<DataTableColumns<InfluxRow>>(() =>
  collectColumnKeys(props.rows).map((columnKey) => ({
    key: columnKey,
    title: columnKey,
    ellipsis: {
      tooltip: true,
    },
    render: (row) =>
      h(
        NText,
        {
          depth: columnKey.startsWith('_') ? 3 : 2,
        },
        { default: () => formatScalarValue(row[columnKey]) },
      ),
  })),
)
</script>

<template>
  <div v-if="rows.length > 0" class="table-shell">
    <NAlert
      v-if="exportError"
      type="error"
      :bordered="false"
      closable
      class="table-alert"
      @close="clearExportError"
    >
      {{ exportError }}
    </NAlert>

    <div class="table-toolbar">
      <NFlex :size="8" justify="end">
        <NButton
          secondary
          size="small"
          :render-icon="renderNaiveIcon(DownloadOutline)"
          @click="exportCsv"
        >
          CSV
        </NButton>
        <NButton
          secondary
          size="small"
          :loading="isExportingParquet"
          :render-icon="renderNaiveIcon(DownloadOutline)"
          @click="exportParquet"
        >
          Parquet
        </NButton>
      </NFlex>
    </div>

    <NDataTable
      :columns="columns"
      :data="rows"
      :pagination="{ pageSize: 20 }"
      max-height="520"
      size="small"
      striped
    />
  </div>
  <NEmpty v-else description="Run a query to inspect rows in tabular form." />
</template>

<style scoped>
.table-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.table-alert {
  margin-top: 2px;
}

.table-toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
