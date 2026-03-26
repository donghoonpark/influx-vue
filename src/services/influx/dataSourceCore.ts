import {
  buildFieldKeysFlux,
  buildMeasurementsFlux,
  buildTagKeysFlux,
  buildTagValuesFlux,
} from '@/services/influx/flux'
import { extractValueList } from '@/services/influx/resultTransforms'
import type {
  InfluxBucket,
  InfluxExplorerDataSource,
  InfluxMeasurementRequest,
  InfluxPingResult,
  InfluxRow,
  InfluxSchemaRequest,
  InfluxTagValuesRequest,
} from '@/services/influx/types'

interface BucketsResponse {
  buckets?: Array<{
    id: string
    name: string
    description?: string
    retentionRules?: Array<{
      everySeconds?: number
    }>
  }>
}

export interface InfluxExplorerTransport {
  org: string
  ping(): Promise<InfluxPingResult>
  requestJson<T>(path: string): Promise<T>
  collectRows(flux: string): Promise<InfluxRow[]>
}

function mapBuckets(response: BucketsResponse): InfluxBucket[] {
  return (response.buckets ?? [])
    .map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      description: bucket.description,
      retentionSeconds: bucket.retentionRules?.[0]?.everySeconds ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function collectStringValues(
  transport: InfluxExplorerTransport,
  flux: string,
): Promise<string[]> {
  const rows = await transport.collectRows(flux)
  return extractValueList(rows)
}

export function createInfluxExplorerDataSource(
  transport: InfluxExplorerTransport,
): InfluxExplorerDataSource {
  return {
    ping() {
      return transport.ping()
    },

    async listBuckets() {
      const response = await transport.requestJson<BucketsResponse>(
        `/api/v2/buckets?org=${encodeURIComponent(transport.org)}&limit=100`,
      )
      return mapBuckets(response)
    },

    listMeasurements(request: InfluxSchemaRequest) {
      return collectStringValues(
        transport,
        buildMeasurementsFlux(request.bucket, request.start),
      )
    },

    listFieldKeys(request: InfluxMeasurementRequest) {
      return collectStringValues(
        transport,
        buildFieldKeysFlux(request.bucket, request.measurement, request.start),
      )
    },

    listTagKeys(request: InfluxMeasurementRequest) {
      return collectStringValues(
        transport,
        buildTagKeysFlux(request.bucket, request.measurement, request.start),
      )
    },

    listTagValues(request: InfluxTagValuesRequest) {
      return collectStringValues(
        transport,
        buildTagValuesFlux(
          request.bucket,
          request.measurement,
          request.tagKey,
          request.start,
        ),
      )
    },

    queryRows(flux: string) {
      return transport.collectRows(flux)
    },
  }
}
