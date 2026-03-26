import { setTimeout as delay } from 'node:timers/promises'

import { InfluxDB, Point } from '@influxdata/influxdb-client'
import type { WritePrecisionType } from '@influxdata/influxdb-client'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

import { createInfluxExplorerDataSource } from '@/services/influx/dataSourceCore'
import type {
  InfluxConnectionConfig,
  InfluxExplorerDataSource,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'

interface InfluxHarness {
  container: StartedTestContainer
  config: InfluxConnectionConfig
  dataSource: InfluxExplorerDataSource
}

const ORG = 'influx-vue'
const BUCKET = 'demo-metrics'
const TOKEN = 'influx-vue-admin-token'
const USERNAME = 'influx'
const PASSWORD = 'influx-password-123'

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

async function waitForHealthy(baseUrl: string, token: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await ping(baseUrl, token)
      if (health.status === 'pass') {
        return
      }
    } catch {
      // InfluxDB is still starting.
    }

    await delay(1000)
  }

  throw new Error('InfluxDB container did not become healthy in time.')
}

async function seedData(baseUrl: string) {
  const precision: WritePrecisionType = 's'
  const influxDB = new InfluxDB({ url: baseUrl, token: TOKEN })
  const writeApi = influxDB.getWriteApi(ORG, BUCKET, precision)

  const nowSeconds = Math.floor(Date.now() / 1000)
  const points: Point[] = []

  for (let index = 5; index >= 0; index -= 1) {
    const timestamp = nowSeconds - index * 3600

    points.push(
      new Point('system')
        .tag('host', 'alpha')
        .tag('region', 'ap-northeast-2')
        .floatField('usage_user', 42 + index)
        .floatField('usage_system', 16 + index)
        .timestamp(timestamp),
    )

    points.push(
      new Point('system')
        .tag('host', 'beta')
        .tag('region', 'us-west-2')
        .floatField('usage_user', 32 + index)
        .floatField('usage_system', 11 + index)
        .timestamp(timestamp),
    )

    points.push(
      new Point('memory')
        .tag('host', 'alpha')
        .tag('region', 'ap-northeast-2')
        .floatField('used_percent', 71 + index)
        .timestamp(timestamp),
    )
  }

  writeApi.writePoints(points)
  await writeApi.close()
}

export async function startInfluxHarness(): Promise<InfluxHarness> {
  const container = await new GenericContainer('influxdb:2.7')
    .withEnvironment({
      DOCKER_INFLUXDB_INIT_MODE: 'setup',
      DOCKER_INFLUXDB_INIT_USERNAME: USERNAME,
      DOCKER_INFLUXDB_INIT_PASSWORD: PASSWORD,
      DOCKER_INFLUXDB_INIT_ORG: ORG,
      DOCKER_INFLUXDB_INIT_BUCKET: BUCKET,
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: TOKEN,
    })
    .withExposedPorts(8086)
    .start()

  const config: InfluxConnectionConfig = {
    url: `http://${container.getHost()}:${container.getMappedPort(8086)}`,
    org: ORG,
    token: TOKEN,
    bucket: BUCKET,
  }

  await waitForHealthy(config.url, config.token)
  await seedData(config.url)

  const influxDB = new InfluxDB({ url: config.url, token: config.token })
  const queryApi = influxDB.getQueryApi(config.org)

  const dataSource = createInfluxExplorerDataSource({
    org: config.org,
    ping: () => ping(config.url, config.token),
    requestJson: <T>(path: string) =>
      requestJson<T>(config.url, config.token, path),
    collectRows: (flux: string) => queryApi.collectRows<InfluxRow>(flux),
  })

  return {
    container,
    config,
    dataSource,
  }
}
