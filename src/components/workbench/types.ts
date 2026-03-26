import type {
  InfluxConnectionConfig,
  InfluxConnectionFailure,
  InfluxExplorerDataSource,
  InfluxPingResult,
} from '@/services/influx/types'

export type InfluxWorkbenchSectionKey =
  | 'hero'
  | 'connection'
  | 'explorer'
  | 'results'

export type InfluxWorkbenchCreateDataSource = (
  config: InfluxConnectionConfig,
) => InfluxExplorerDataSource

export interface InfluxWorkbenchProps {
  title?: string
  subtitle?: string
  autoConnect?: boolean
  autoRunQuery?: boolean
  initialConnection?: Partial<InfluxConnectionConfig>
  hiddenSections?: InfluxWorkbenchSectionKey[]
  createDataSource?: InfluxWorkbenchCreateDataSource
}

export interface InfluxWorkbenchConnectEvent {
  connection: InfluxConnectionConfig
  health: InfluxPingResult | null
  bucketCount: number
}

export interface InfluxWorkbenchDisconnectEvent {
  connection: InfluxConnectionConfig
}

export interface InfluxWorkbenchExposed {
  applyConnection(connection: Partial<InfluxConnectionConfig>): void
  connect(): Promise<boolean>
  disconnect(): void
  runQuery(): Promise<boolean>
}

export type InfluxWorkbenchConnectError = InfluxConnectionFailure
