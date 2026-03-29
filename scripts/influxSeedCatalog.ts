import { Point } from '@influxdata/influxdb-client'

export interface SeedBucketDefinition {
  name: string
  description: string
  points: Point[]
}

function createPseudoRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function roundTo(value: number, fractionDigits = 2) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

function timestampAt(
  nowMs: number,
  sampleCount: number,
  index: number,
  stepMs: number,
) {
  return nowMs - (sampleCount - 1 - index) * stepMs
}

export function buildSeedBuckets(nowMs = Date.now()): SeedBucketDefinition[] {
  const sampleCount = 1200
  const stepMs = 100
  const systemEventMessages = [
    'deploy started',
    'cache warmup',
    'autoscale triggered',
    'deploy completed',
    'traffic shifted',
  ]
  const sensorEventMessages = [
    'calibration started',
    'calibration complete',
    'maintenance check',
    'operator inspection',
  ]

  const demoRandom = createPseudoRandom(11)
  const sensorRandom = createPseudoRandom(29)
  const paymentsRandom = createPseudoRandom(47)
  const latencyRandom = createPseudoRandom(83)

  const demoPoints: Point[] = []
  const sensorPoints: Point[] = []
  const paymentPoints: Point[] = []
  const latencyPoints: Point[] = []

  for (let index = 0; index < sampleCount; index += 1) {
    const timestamp = timestampAt(nowMs, sampleCount, index, stepMs)

    demoPoints.push(
      new Point('system')
        .tag('host', 'alpha')
        .tag('region', 'ap-northeast-2')
        .tag('service', 'frontend')
        .floatField(
          'usage_user',
          roundTo(38 + Math.sin(index / 14) * 8 + demoRandom() * 5),
        )
        .floatField(
          'usage_system',
          roundTo(12 + Math.cos(index / 19) * 3 + demoRandom() * 2),
        )
        .timestamp(timestamp),
    )

    demoPoints.push(
      new Point('system')
        .tag('host', 'beta')
        .tag('region', 'us-west-2')
        .tag('service', 'worker')
        .floatField(
          'usage_user',
          roundTo(30 + Math.sin(index / 17) * 7 + demoRandom() * 4),
        )
        .floatField(
          'usage_system',
          roundTo(10 + Math.cos(index / 15) * 2 + demoRandom() * 2),
        )
        .timestamp(timestamp),
    )

    demoPoints.push(
      new Point('memory')
        .tag('host', 'alpha')
        .tag('region', 'ap-northeast-2')
        .tag('service', 'frontend')
        .floatField(
          'used_percent',
          roundTo(64 + Math.sin(index / 13) * 6 + demoRandom() * 3),
        )
        .timestamp(timestamp),
    )

    sensorPoints.push(
      new Point('temperature')
        .tag('site', 'factory-seoul')
        .tag('device', 'temp-sensor-a')
        .tag('status', index % 11 === 0 ? 'check' : 'ok')
        .floatField(
          'celsius',
          roundTo(23 + Math.sin(index / 9) * 3 + sensorRandom() * 1.4),
        )
        .timestamp(timestamp),
    )

    sensorPoints.push(
      new Point('humidity')
        .tag('site', 'factory-seoul')
        .tag('device', 'humid-sensor-a')
        .tag('status', index % 17 === 0 ? 'check' : 'ok')
        .floatField(
          'relative_humidity',
          roundTo(48 + Math.cos(index / 12) * 7 + sensorRandom() * 2.5),
        )
        .timestamp(timestamp),
    )

    paymentPoints.push(
      new Point('payments')
        .tag('region', 'eu-central-1')
        .tag('currency', 'EUR')
        .tag('service', 'checkout')
        .floatField(
          'latency_ms',
          roundTo(180 + Math.sin(index / 10) * 30 + paymentsRandom() * 24),
        )
        .floatField(
          'success_rate',
          roundTo(98.6 + Math.cos(index / 15) * 0.6 + paymentsRandom() * 0.3),
        )
        .timestamp(timestamp),
    )

    paymentPoints.push(
      new Point('payments')
        .tag('region', 'ap-southeast-1')
        .tag('currency', 'USD')
        .tag('service', 'settlement')
        .floatField(
          'latency_ms',
          roundTo(220 + Math.cos(index / 11) * 26 + paymentsRandom() * 20),
        )
        .floatField(
          'success_rate',
          roundTo(97.9 + Math.sin(index / 12) * 0.7 + paymentsRandom() * 0.35),
        )
        .timestamp(timestamp),
    )

    latencyPoints.push(
      new Point('gateway')
        .tag('route', '/v1/search')
        .tag('region', 'ap-northeast-2')
        .tag('env', 'staging')
        .floatField(
          'p95_ms',
          roundTo(110 + Math.sin(index / 8) * 20 + latencyRandom() * 12),
        )
        .floatField(
          'error_rate',
          roundTo(0.8 + Math.cos(index / 10) * 0.2 + latencyRandom() * 0.12, 3),
        )
        .timestamp(timestamp),
    )

    latencyPoints.push(
      new Point('gateway')
        .tag('route', '/v1/orders')
        .tag('region', 'us-east-1')
        .tag('env', 'staging')
        .floatField(
          'p95_ms',
          roundTo(130 + Math.cos(index / 9) * 24 + latencyRandom() * 14),
        )
        .floatField(
          'error_rate',
          roundTo(
            1.1 + Math.sin(index / 11) * 0.22 + latencyRandom() * 0.12,
            3,
          ),
        )
        .timestamp(timestamp),
    )

    if (index % 100 === 0) {
      demoPoints.push(
        new Point('system_event')
          .tag('host', index % 200 === 0 ? 'alpha' : 'beta')
          .tag('service', index % 200 === 0 ? 'frontend' : 'worker')
          .stringField(
            'message',
            systemEventMessages[
              Math.floor(index / 100) % systemEventMessages.length
            ],
          )
          .timestamp(timestamp),
      )
    }

    if (index % 150 === 0) {
      sensorPoints.push(
        new Point('sensor_event')
          .tag('site', 'factory-seoul')
          .tag('device', index % 300 === 0 ? 'temp-sensor-a' : 'humid-sensor-a')
          .stringField(
            'message',
            sensorEventMessages[
              Math.floor(index / 150) % sensorEventMessages.length
            ],
          )
          .timestamp(timestamp),
      )
    }
  }

  return [
    {
      name: 'demo-metrics',
      description: 'Core system and memory metrics for the workbench demo.',
      points: demoPoints,
    },
    {
      name: 'edge-sensors',
      description: '10 Hz environmental sensor samples from the factory floor.',
      points: sensorPoints,
    },
    {
      name: 'payments-stream',
      description: 'Synthetic checkout and settlement metrics at 10 Hz.',
      points: paymentPoints,
    },
    {
      name: 'api-latency',
      description: 'Gateway latency and error rate signals sampled at 10 Hz.',
      points: latencyPoints,
    },
  ]
}
