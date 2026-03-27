import {
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from '@codemirror/autocomplete'

import type { AggregateFunction } from '@/services/influx/types'

export interface FluxAutocompleteSchema {
  buckets: string[]
  measurements: string[]
  fields: string[]
  tagKeys: string[]
  tagValuesByKey: Record<string, string[]>
  aggregateFunctions: AggregateFunction[]
}

export type FluxCompletionKind =
  | 'bucket'
  | 'measurement'
  | 'field'
  | 'tagKey'
  | 'tagValue'
  | 'aggregateFunction'
  | 'global'

export interface FluxCompletionMatch {
  from: number
  kind: FluxCompletionKind
  tagKey?: string
  quoteWrapped?: boolean
}

export interface FluxCompletionReferences {
  bucket?: string
  measurement?: string
  tagKey?: string
}

export interface FluxAutocompleteRequest {
  document: string
  position: number
  match: FluxCompletionMatch
  references: FluxCompletionReferences
}

export type FluxAutocompleteSchemaProvider = (
  request: FluxAutocompleteRequest,
) => FluxAutocompleteSchema | Promise<FluxAutocompleteSchema>

const GLOBAL_COMPLETIONS: Completion[] = [
  snippetCompletion(
    'from(bucket: "${bucket}")\n  |> range(start: -1h)\n  |> filter(fn: (r) => r._measurement == "${measurement}")\n  |> filter(fn: (r) => r._field == "${field}")',
    {
      label: 'from |> range |> filter',
      type: 'keyword',
      detail: 'Query skeleton',
      info: 'Insert a basic Flux pipeline with bucket, measurement, and field placeholders.',
    },
  ),
  snippetCompletion(
    'aggregateWindow(every: ${window}, fn: ${fn}, createEmpty: false)',
    {
      label: 'aggregateWindow',
      type: 'function',
      detail: 'Windowed aggregation',
      info: 'Group points into windows and apply an aggregate function.',
    },
  ),
  snippetCompletion('filter(fn: (r) => r["${tagKey}"] == "${value}")', {
    label: 'filter by tag',
    type: 'function',
    detail: 'Tag filter',
    info: 'Insert a tag filter using the r["tag"] access pattern.',
  }),
  {
    label: 'from',
    type: 'function',
    detail: 'Bucket source',
    apply: 'from(bucket: "")',
    info: 'Start a query by reading from a bucket.',
  },
  {
    label: 'range',
    type: 'function',
    detail: 'Time range',
    apply: 'range(start: -1h)',
    info: 'Restrict the query to a time range.',
  },
  {
    label: 'filter',
    type: 'function',
    detail: 'Predicate',
    apply: 'filter(fn: (r) => true)',
    info: 'Filter rows by measurement, field, or tags.',
  },
  {
    label: 'limit',
    type: 'function',
    detail: 'Row limit',
    apply: 'limit(n: 2000)',
    info: 'Limit the number of rows returned by the query.',
  },
  {
    label: 'sort',
    type: 'function',
    detail: 'Sort rows',
    apply: 'sort(columns: ["_time"])',
    info: 'Sort result rows by one or more columns.',
  },
  {
    label: 'yield',
    type: 'function',
    detail: 'Result name',
    apply: 'yield(name: "result")',
    info: 'Name the output stream explicitly.',
  },
  {
    label: 'import "influxdata/influxdb/schema"',
    type: 'keyword',
    detail: 'Schema helpers',
    info: 'Import Flux schema helpers for measurement, field, and tag discovery.',
  },
  {
    label: 'schema.measurements',
    type: 'function',
    detail: 'List measurements',
    apply: 'schema.measurements(bucket: "", start: -30d)',
    info: 'List measurement names from a bucket.',
  },
  {
    label: 'schema.fieldKeys',
    type: 'function',
    detail: 'List fields',
    apply:
      'schema.fieldKeys(bucket: "", start: -30d, predicate: (r) => r._measurement == "")',
    info: 'List field keys for a measurement.',
  },
  {
    label: 'schema.tagKeys',
    type: 'function',
    detail: 'List tags',
    apply:
      'schema.tagKeys(bucket: "", start: -30d, predicate: (r) => r._measurement == "")',
    info: 'List tag keys for a measurement.',
  },
]

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort(
    (left, right) => left.localeCompare(right),
  )
}

function buildValueCompletions(
  values: string[],
  input: {
    type: Completion['type']
    detail: string
    quoteWrapped?: boolean
  },
): Completion[] {
  return uniqueSorted(values).map((value) => ({
    label: value,
    type: input.type,
    detail: input.detail,
    apply: input.quoteWrapped ? value : JSON.stringify(value),
  }))
}

export function resolveFluxCompletionContext(
  document: string,
  position: number,
  explicit = false,
): FluxCompletionMatch | null {
  const beforeCursor = document.slice(0, position)
  const patterns: Array<{
    regex: RegExp
    kind: FluxCompletionKind
    quoteWrapped?: boolean
    getTagKey?: (match: RegExpExecArray) => string
  }> = [
    {
      regex: /r\["([^"\]]+)"\]\s*==\s*"([^"]*)$/m,
      kind: 'tagValue',
      quoteWrapped: true,
      getTagKey: (match) => match[1],
    },
    {
      regex: /r\["([^"\]]*)$/m,
      kind: 'tagKey',
      quoteWrapped: true,
    },
    {
      regex: /from\s*\(\s*bucket\s*:\s*"([^"]*)$/m,
      kind: 'bucket',
      quoteWrapped: true,
    },
    {
      regex: /from\s*\(\s*bucket\s*:\s*([A-Za-z0-9_-]*)$/m,
      kind: 'bucket',
      quoteWrapped: false,
    },
    {
      regex: /_measurement\s*==\s*"([^"]*)$/m,
      kind: 'measurement',
      quoteWrapped: true,
    },
    {
      regex: /_field\s*==\s*"([^"]*)$/m,
      kind: 'field',
      quoteWrapped: true,
    },
    {
      regex: /aggregateWindow\([^)]*fn\s*:\s*([A-Za-z_]*)$/m,
      kind: 'aggregateFunction',
    },
  ]

  for (const pattern of patterns) {
    const match = pattern.regex.exec(beforeCursor)
    if (!match) {
      continue
    }

    const partial = match[match.length - 1] ?? ''
    return {
      from: position - partial.length,
      kind: pattern.kind,
      tagKey: pattern.getTagKey?.(match),
      quoteWrapped: pattern.quoteWrapped,
    }
  }

  const globalWordMatch = /[A-Za-z_][\w.]*$/.exec(beforeCursor)
  if (globalWordMatch) {
    return {
      from: position - globalWordMatch[0].length,
      kind: 'global',
    }
  }

  if (explicit) {
    return {
      from: position,
      kind: 'global',
    }
  }

  return null
}

function findLastMatchValue(
  source: string,
  pattern: RegExp,
): string | undefined {
  let resolved: string | undefined

  for (const match of source.matchAll(pattern)) {
    const nextValue = match[1]?.trim()
    if (nextValue) {
      resolved = nextValue
    }
  }

  return resolved
}

export function resolveFluxCompletionReferences(
  document: string,
  position: number,
  match?: FluxCompletionMatch | null,
): FluxCompletionReferences {
  const scopedSource = document.slice(0, position)

  return {
    bucket:
      findLastMatchValue(
        scopedSource,
        /from\s*\(\s*bucket\s*:\s*"([^"]+)"/gm,
      ) ??
      findLastMatchValue(
        scopedSource,
        /from\s*\(\s*bucket\s*:\s*([A-Za-z0-9_-]+)/gm,
      ),
    measurement: findLastMatchValue(
      scopedSource,
      /_measurement\s*==\s*"([^"]+)"/gm,
    ),
    tagKey:
      match?.tagKey ?? findLastMatchValue(scopedSource, /r\["([^"\]]+)"\]/gm),
  }
}

export function resolveFluxCompletionResult(
  document: string,
  position: number,
  schema: FluxAutocompleteSchema,
  explicit = false,
): CompletionResult | null {
  const match = resolveFluxCompletionContext(document, position, explicit)
  if (!match) {
    return null
  }

  switch (match.kind) {
    case 'bucket':
      return {
        from: match.from,
        options: buildValueCompletions(schema.buckets, {
          type: 'variable',
          detail: 'Bucket',
          quoteWrapped: match.quoteWrapped,
        }),
        validFor: /[^"]*/,
      }
    case 'measurement':
      return {
        from: match.from,
        options: buildValueCompletions(schema.measurements, {
          type: 'property',
          detail: 'Measurement',
          quoteWrapped: match.quoteWrapped,
        }),
        validFor: /[^"]*/,
      }
    case 'field':
      return {
        from: match.from,
        options: buildValueCompletions(schema.fields, {
          type: 'property',
          detail: 'Field',
          quoteWrapped: match.quoteWrapped,
        }),
        validFor: /[^"]*/,
      }
    case 'tagKey':
      return {
        from: match.from,
        options: buildValueCompletions(schema.tagKeys, {
          type: 'property',
          detail: 'Tag key',
          quoteWrapped: match.quoteWrapped,
        }),
        validFor: /[^"\]]*/,
      }
    case 'tagValue':
      return {
        from: match.from,
        options: buildValueCompletions(
          schema.tagValuesByKey[match.tagKey ?? ''] ?? [],
          {
            type: 'text',
            detail: match.tagKey
              ? `Tag value for ${match.tagKey}`
              : 'Tag value',
            quoteWrapped: match.quoteWrapped,
          },
        ),
        validFor: /[^"]*/,
      }
    case 'aggregateFunction':
      return {
        from: match.from,
        options: buildValueCompletions(schema.aggregateFunctions, {
          type: 'function',
          detail: 'Aggregate function',
        }),
        validFor: /[A-Za-z_]*/,
      }
    case 'global':
      return {
        from: match.from,
        options: GLOBAL_COMPLETIONS,
        validFor: /[\w.]*/,
      }
  }
}

export function createFluxCompletionSource(
  getSchema: FluxAutocompleteSchemaProvider,
): CompletionSource {
  return async (context: CompletionContext) => {
    const document = context.state.doc.toString()
    const match = resolveFluxCompletionContext(
      document,
      context.pos,
      context.explicit,
    )

    if (!match) {
      return null
    }

    const schema = await getSchema({
      document,
      position: context.pos,
      match,
      references: resolveFluxCompletionReferences(document, context.pos, match),
    })

    return resolveFluxCompletionResult(
      document,
      context.pos,
      schema,
      context.explicit,
    )
  }
}
