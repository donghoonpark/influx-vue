import parquetWasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url'

import { collectColumnKeys } from '@/services/influx/resultTransforms'
import type { InfluxRow, InfluxScalar } from '@/services/influx/types'

type ExportScalar = string | number | boolean | null
type ExportColumnKind = 'string' | 'number' | 'boolean'
type ParquetModule = typeof import('parquet-wasm/esm')

let parquetModulePromise: Promise<ParquetModule> | null = null

async function loadParquetModule(): Promise<ParquetModule> {
  if (!parquetModulePromise) {
    parquetModulePromise = import('parquet-wasm/esm').then(async (module) => {
      await module.default({ module_or_path: parquetWasmUrl })
      return module
    })
  }

  return parquetModulePromise
}

function escapeCsvCell(value: ExportScalar): string {
  if (value === null || value === undefined) {
    return ''
  }

  const normalized = String(value)

  if (
    normalized.includes(',') ||
    normalized.includes('"') ||
    normalized.includes('\n') ||
    normalized.includes('\r')
  ) {
    return `"${normalized.replaceAll('"', '""')}"`
  }

  return normalized
}

function normalizeFileStem(value: string | undefined): string {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') ?? ''

  return normalized || 'influx-query-result'
}

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function triggerBlobDownload(
  blob: Blob,
  filename: string,
) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function inferColumnKind(values: Array<InfluxScalar | undefined>): ExportColumnKind {
  const nonNullValues = values.filter(
    (value): value is Exclude<InfluxScalar, null> =>
      value !== null && value !== undefined,
  )

  if (nonNullValues.length === 0) {
    return 'string'
  }

  if (nonNullValues.every((value) => typeof value === 'number')) {
    return 'number'
  }

  if (nonNullValues.every((value) => typeof value === 'boolean')) {
    return 'boolean'
  }

  return 'string'
}

function normalizeColumnValue(
  value: InfluxScalar | undefined,
  kind: ExportColumnKind,
): ExportScalar {
  if (value === null || value === undefined) {
    return null
  }

  if (kind === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : String(value)
  }

  if (kind === 'boolean') {
    return typeof value === 'boolean' ? value : String(value)
  }

  return String(value)
}

export function buildExportFileBaseName(
  suggestedName?: string,
): string {
  return `${normalizeFileStem(suggestedName)}-${timestampSuffix()}`
}

export function serializeRowsToCsv(rows: InfluxRow[]): string {
  const columnKeys = collectColumnKeys(rows)
  const lines = [
    columnKeys.map((columnKey) => escapeCsvCell(columnKey)).join(','),
    ...rows.map((row) =>
      columnKeys
        .map((columnKey) => escapeCsvCell(row[columnKey] ?? null))
        .join(','),
    ),
  ]

  return lines.join('\r\n')
}

export function buildParquetColumns(
  rows: InfluxRow[],
): Record<string, ExportScalar[]> {
  const columnKeys = collectColumnKeys(rows)
  const columns = Object.fromEntries(
    columnKeys.map((columnKey) => {
      const values = rows.map((row) => row[columnKey])
      const kind = inferColumnKind(values)

      return [
        columnKey,
        values.map((value) => normalizeColumnValue(value, kind)),
      ]
    }),
  ) as Record<string, ExportScalar[]>

  const filteredColumns = Object.fromEntries(
    Object.entries(columns).filter(([, values]) =>
      values.some((value) => value !== null),
    ),
  )

  if (Object.keys(filteredColumns).length > 0) {
    return filteredColumns
  }

  return {
    _row: rows.map((_, index) => index + 1),
  }
}

export async function serializeRowsToParquet(
  rows: InfluxRow[],
): Promise<Uint8Array> {
  const parquetColumns = buildParquetColumns(rows)
  const { tableFromArrays, tableToIPC } = await import('apache-arrow')
  const arrowTable = tableFromArrays(parquetColumns)
  const { Table, writeParquet } = await loadParquetModule()
  const ipcBuffer = tableToIPC(arrowTable, 'stream')

  return writeParquet(Table.fromIPCStream(ipcBuffer))
}

export function downloadRowsAsCsv(
  rows: InfluxRow[],
  suggestedName?: string,
) {
  const filename = `${buildExportFileBaseName(suggestedName)}.csv`
  const csv = serializeRowsToCsv(rows)
  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8',
  })

  triggerBlobDownload(blob, filename)
}

export async function downloadRowsAsParquet(
  rows: InfluxRow[],
  suggestedName?: string,
) {
  const filename = `${buildExportFileBaseName(suggestedName)}.parquet`
  const parquet = await serializeRowsToParquet(rows)
  const blob = new Blob([Uint8Array.from(parquet)], {
    type: 'application/vnd.apache.parquet',
  })

  triggerBlobDownload(blob, filename)
}
