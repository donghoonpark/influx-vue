import { setTimeout as delay } from 'node:timers/promises'

import { InfluxDB } from '@influxdata/influxdb-client'
import type { WritePrecisionType } from '@influxdata/influxdb-client'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

import { createInfluxExplorerDataSource } from '@/services/influx/dataSourceCore'
import type {
  InfluxConnectionConfig,
  InfluxExplorerDataSource,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'
import {
  buildSeedBuckets,
  type SeedBucketDefinition,
} from '../../../scripts/influxSeedCatalog'

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

interface InfluxOrgListResponse {
  orgs?: Array<{
    id: string
    name: string
  }>
}

interface InfluxBucket {
  id: string
  name: string
}

interface InfluxBucketListResponse {
  buckets?: InfluxBucket[]
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
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Token ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as T
}

async function resolveOrgId(baseUrl: string, token: string): Promise<string> {
  const payload = await requestJson<InfluxOrgListResponse>(
    baseUrl,
    token,
    `/api/v2/orgs?org=${encodeURIComponent(ORG)}`,
  )
  const orgId = payload.orgs?.[0]?.id

  if (!orgId) {
    throw new Error(`Could not resolve org "${ORG}" from ${baseUrl}`)
  }

  return orgId
}

async function findBucket(
  baseUrl: string,
  token: string,
  name: string,
): Promise<InfluxBucket | undefined> {
  const payload = await requestJson<InfluxBucketListResponse>(
    baseUrl,
    token,
    `/api/v2/buckets?org=${encodeURIComponent(ORG)}&limit=100`,
  )

  return payload.buckets?.find((bucket) => bucket.name === name)
}

async function ensureBucket(
  baseUrl: string,
  token: string,
  orgId: string,
  bucket: SeedBucketDefinition,
): Promise<InfluxBucket> {
  const existingBucket = await findBucket(baseUrl, token, bucket.name)

  if (existingBucket) {
    return existingBucket
  }

  return requestJson<InfluxBucket>(baseUrl, token, '/api/v2/buckets', {
    method: 'POST',
    body: JSON.stringify({
      orgID: orgId,
      name: bucket.name,
      description: bucket.description,
    }),
  })
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
  const precision: WritePrecisionType = 'ms'
  const influxDB = new InfluxDB({ url: baseUrl, token: TOKEN })
  const orgId = await resolveOrgId(baseUrl, TOKEN)
  const seedBuckets = buildSeedBuckets()
  const resolvedBuckets: Array<{
    definition: SeedBucketDefinition
    bucket: InfluxBucket
  }> = []

  for (const seedBucket of seedBuckets) {
    resolvedBuckets.push({
      definition: seedBucket,
      bucket: await ensureBucket(baseUrl, TOKEN, orgId, seedBucket),
    })
  }

  for (const resolvedBucket of resolvedBuckets) {
    const writeApi = influxDB.getWriteApi(
      ORG,
      resolvedBucket.bucket.id,
      precision,
    )
    writeApi.writePoints(resolvedBucket.definition.points)
    await writeApi.close()
  }
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
