export type InfluxWorkbenchSectionKey =
  | 'hero'
  | 'connection'
  | 'explorer'
  | 'tags'
  | 'query'
  | 'summary'
  | 'dashboard'
  | 'results'

export type InfluxWorkbenchStepKey =
  | 'connection'
  | 'explorer'
  | 'tags'
  | 'query'
  | 'dashboard'
  | 'results'

export interface InfluxWorkbenchStepDefinition {
  key: InfluxWorkbenchStepKey
  label: string
  description: string
  section: Exclude<InfluxWorkbenchSectionKey, 'hero' | 'summary'>
}
