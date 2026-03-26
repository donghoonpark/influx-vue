<script setup lang="ts">
import { computed, h } from 'vue'

import type { DataTableColumns } from 'naive-ui'
import { NDataTable, NEmpty, NText } from 'naive-ui'

import {
  collectColumnKeys,
  formatScalarValue,
} from '@/services/influx/resultTransforms'
import type { InfluxRow } from '@/services/influx/types'

const props = defineProps<{
  rows: InfluxRow[]
}>()

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
  <NDataTable
    v-if="rows.length > 0"
    :columns="columns"
    :data="rows"
    :pagination="{ pageSize: 20 }"
    max-height="520"
    size="small"
    striped
  />
  <NEmpty v-else description="Run a query to inspect rows in tabular form." />
</template>
