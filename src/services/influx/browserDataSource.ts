import { InfluxDB } from '@influxdata/influxdb-client-browser'

import { createInfluxExplorerDataSource } from '@/services/influx/dataSourceCore'
import type {
  InfluxConnectionConfig,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as {
      message?: string
      error?: string
    }
    return payload.message ?? payload.error ?? response.statusText
  }

  const text = await response.text()
  return text || response.statusText
}

async function requestJson<T>(
  baseUrl: string,
  token: string,
  path: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Token ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as T
}

async function ping(baseUrl: string, token: string): Promise<InfluxPingResult> {
  const response = await fetch(`${baseUrl}/health`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Token ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as InfluxPingResult
}

export function createBrowserInfluxDataSource(config: InfluxConnectionConfig) {
  const baseUrl = normalizeBaseUrl(config.url)
  const influxDB = new InfluxDB({ url: baseUrl, token: config.token })
  const queryApi = influxDB.getQueryApi(config.org)

  return createInfluxExplorerDataSource({
    org: config.org,
    ping: () => ping(baseUrl, config.token),
    requestJson: <T>(path: string) =>
      requestJson<T>(baseUrl, config.token, path),
    collectRows: (flux: string) => queryApi.collectRows<InfluxRow>(flux),
  })
}
