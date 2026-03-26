export type InfluxWorkbenchSectionKey =
  | 'hero'
  | 'connection'
  | 'explorer'
  | 'tags'
  | 'query'
  | 'summary'
  | 'results'

export type InfluxWorkbenchStepKey =
  | 'connection'
  | 'explorer'
  | 'tags'
  | 'query'
  | 'results'

export interface InfluxWorkbenchStepDefinition {
  key: InfluxWorkbenchStepKey
  label: string
  description: string
  section: Exclude<InfluxWorkbenchSectionKey, 'hero' | 'summary'>
}
