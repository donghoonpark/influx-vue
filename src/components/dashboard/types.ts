import type { InfluxConnectionConfig, InfluxExplorerDataSource } from '@/services/influx/types'
import type { InfluxDashboardDefinition } from '@/services/influx/dashboard'

export type InfluxDashboardCreateDataSource = (
  config: InfluxConnectionConfig,
) => InfluxExplorerDataSource

export type InfluxDashboardAuthenticateConnection = (
  config: InfluxConnectionConfig,
) => Promise<InfluxConnectionConfig>

export interface InfluxDashboardProps {
  yaml: string
  autoRun?: boolean
  connectionOverride?: Partial<InfluxConnectionConfig>
  createDataSource?: InfluxDashboardCreateDataSource
  authenticateConnection?: InfluxDashboardAuthenticateConnection
}

export interface InfluxDashboardExposed {
  connect(): Promise<boolean>
  refresh(): Promise<boolean>
  getDefinition(): InfluxDashboardDefinition
}
