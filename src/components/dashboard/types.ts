import type { InfluxConnectionConfig, InfluxExplorerDataSource } from '@/services/influx/types'
import type {
  InfluxDashboardDefinition,
  InfluxDashboardTimeRangeOverride,
} from '@/services/influx/dashboard'

export type InfluxDashboardCreateDataSource = (
  config: InfluxConnectionConfig,
) => InfluxExplorerDataSource

export type InfluxDashboardAuthenticateConnection = (
  config: InfluxConnectionConfig,
) => Promise<InfluxConnectionConfig>

export interface InfluxDashboardProps {
  yaml: string
  autoRun?: boolean
  showTimeControls?: boolean
  initialTimeRangeOverride?: Partial<InfluxDashboardTimeRangeOverride>
  connectionOverride?: Partial<InfluxConnectionConfig>
  createDataSource?: InfluxDashboardCreateDataSource
  authenticateConnection?: InfluxDashboardAuthenticateConnection
}

export interface InfluxDashboardExposed {
  connect(): Promise<boolean>
  refresh(): Promise<boolean>
  getDefinition(): InfluxDashboardDefinition
  getTimeRangeOverride(): InfluxDashboardTimeRangeOverride
}
