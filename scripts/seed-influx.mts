import { setTimeout as delay } from 'node:timers/promises'

import { InfluxDB } from '@influxdata/influxdb-client'
import type { WritePrecisionType } from '@influxdata/influxdb-client'

import {
  buildSeedBuckets,
  type SeedBucketDefinition,
} from './influxSeedCatalog'

const url = process.env.INFLUX_URL ?? 'http://127.0.0.1:8086'
const org = process.env.INFLUX_ORG ?? 'influx-vue'
const token = process.env.INFLUX_TOKEN ?? 'influx-vue-admin-token'

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
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${url}${path}`, {
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

async function resolveOrgId() {
  const payload = await requestJson<InfluxOrgListResponse>(
    `/api/v2/orgs?org=${encodeURIComponent(org)}`,
  )
  const orgId = payload.orgs?.[0]?.id

  if (!orgId) {
    throw new Error(`Could not resolve org "${org}" from ${url}`)
  }

  return orgId
}

async function findBucket(name: string) {
  const payload = await requestJson<InfluxBucketListResponse>(
    `/api/v2/buckets?org=${encodeURIComponent(org)}&limit=100`,
  )

  return payload.buckets?.find((bucket) => bucket.name === name)
}

async function ensureBucket(
  orgId: string,
  bucket: SeedBucketDefinition,
): Promise<InfluxBucket> {
  const existingBucket = await findBucket(bucket.name)

  if (existingBucket) {
    return existingBucket
  }

  return requestJson<InfluxBucket>('/api/v2/buckets', {
    method: 'POST',
    body: JSON.stringify({
      orgID: orgId,
      name: bucket.name,
      description: bucket.description,
    }),
  })
}

async function waitForHealthy() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${url}/health`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Token ${token}`,
        },
      })

      if (response.ok) {
        const payload = (await response.json()) as { status?: string }
        if (payload.status === 'pass') {
          return
        }
      }
    } catch {
      // InfluxDB is still starting.
    }

    await delay(1000)
  }

  throw new Error('InfluxDB did not become healthy in time.')
}

async function seed() {
  await waitForHealthy()

  const seedBuckets = buildSeedBuckets()
  const orgId = await resolveOrgId()
  const resolvedBuckets: Array<{
    definition: SeedBucketDefinition
    bucket: InfluxBucket
  }> = []

  for (const seedBucket of seedBuckets) {
    resolvedBuckets.push({
      definition: seedBucket,
      bucket: await ensureBucket(orgId, seedBucket),
    })
  }

  const influxDB = new InfluxDB({ url, token })
  const precision: WritePrecisionType = 'ms'
  let totalPoints = 0

  for (const resolvedBucket of resolvedBuckets) {
    const writeApi = influxDB.getWriteApi(
      org,
      resolvedBucket.bucket.id,
      precision,
    )
    writeApi.writePoints(resolvedBucket.definition.points)
    await writeApi.close()
    totalPoints += resolvedBucket.definition.points.length
  }

  console.log(
    `Seeded ${totalPoints} points across ${seedBuckets.length} buckets at ${url}`,
  )
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
