import { setTimeout as delay } from 'node:timers/promises'

import { InfluxDB, Point } from '@influxdata/influxdb-client'

const url = process.env.INFLUX_URL ?? 'http://127.0.0.1:8086'
const org = process.env.INFLUX_ORG ?? 'influx-vue'
const bucket = process.env.INFLUX_BUCKET ?? 'demo-metrics'
const token = process.env.INFLUX_TOKEN ?? 'influx-vue-admin-token'

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

  const influxDB = new InfluxDB({ url, token })
  const writeApi = influxDB.getWriteApi(org, bucket, 's')
  const nowSeconds = Math.floor(Date.now() / 1000)

  const points: Point[] = []
  for (let index = 11; index >= 0; index -= 1) {
    const timestamp = nowSeconds - index * 1800

    points.push(
      new Point('system')
        .tag('host', 'alpha')
        .tag('region', 'ap-northeast-2')
        .tag('service', 'frontend')
        .floatField('usage_user', 38 + index)
        .floatField('usage_system', 12 + index / 2)
        .timestamp(timestamp),
    )

    points.push(
      new Point('system')
        .tag('host', 'beta')
        .tag('region', 'us-west-2')
        .tag('service', 'worker')
        .floatField('usage_user', 30 + index)
        .floatField('usage_system', 9 + index / 2)
        .timestamp(timestamp),
    )

    points.push(
      new Point('memory')
        .tag('host', 'alpha')
        .tag('region', 'ap-northeast-2')
        .tag('service', 'frontend')
        .floatField('used_percent', 68 + index / 2)
        .timestamp(timestamp),
    )
  }

  writeApi.writePoints(points)
  await writeApi.close()

  console.log(`Seeded ${points.length} points into ${bucket} at ${url}`)
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
