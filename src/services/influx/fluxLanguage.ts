import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'

interface FluxStreamState {
  inString: boolean
}

const FLUX_KEYWORDS = new Set([
  'import',
  'from',
  'range',
  'filter',
  'aggregateWindow',
  'group',
  'keep',
  'drop',
  'limit',
  'sort',
  'yield',
  'pivot',
  'map',
  'window',
  'schema.measurements',
  'schema.fieldKeys',
  'schema.tagKeys',
  'schema.tagValues',
  'time',
])

const FLUX_ATOMS = new Set(['and', 'or', 'not', 'true', 'false'])

const FLUX_PROPERTIES = new Set([
  'bucket',
  'start',
  'stop',
  'fn',
  'every',
  'createEmpty',
  'columns',
  'n',
  'tag',
  'predicate',
  'name',
  'rowKey',
  'columnKey',
  'valueColumn',
])

const fluxStreamParser: StreamParser<FluxStreamState> = {
  startState() {
    return { inString: false }
  },
  token(stream, state) {
    if (stream.eatSpace()) {
      return null
    }

    if (!state.inString && stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }

    if (state.inString) {
      let isEscaped = false
      while (!stream.eol()) {
        const char = stream.next()
        if (char === '"' && !isEscaped) {
          state.inString = false
          break
        }
        isEscaped = char === '\\' && !isEscaped
      }
      return 'string'
    }

    if (stream.peek() === '"') {
      state.inString = true
      stream.next()
      return 'string'
    }

    if (stream.match('|>')) {
      return 'operator'
    }

    if (stream.match(/[()[\]{}]/)) {
      return 'bracket'
    }

    if (stream.match(/-?\d+(?:\.\d+)?(?:ns|us|ms|s|m|h|d|w)?\b/)) {
      return 'number'
    }

    if (stream.match(/[=,:]/)) {
      return 'operator'
    }

    if (stream.match(/[A-Za-z_][\w.]*/)) {
      const token = stream.current()

      if (FLUX_KEYWORDS.has(token)) {
        return 'keyword'
      }

      if (FLUX_ATOMS.has(token)) {
        return 'atom'
      }

      if (FLUX_PROPERTIES.has(token) && stream.match(/(?=\s*:)/, false)) {
        return 'propertyName'
      }

      if (token.startsWith('_')) {
        return 'propertyName'
      }

      return 'variableName'
    }

    stream.next()
    return null
  },
}

const fluxHighlightStyle = HighlightStyle.define(
  [
    {
      tag: tags.keyword,
      color: '#7dd3fc',
      fontWeight: '700',
    },
    {
      tag: tags.atom,
      color: '#f9a8d4',
      fontWeight: '600',
    },
    {
      tag: tags.string,
      color: '#86efac',
    },
    {
      tag: tags.number,
      color: '#fbbf24',
    },
    {
      tag: tags.comment,
      color: '#94a3b8',
      fontStyle: 'italic',
    },
    {
      tag: tags.operator,
      color: '#fda4af',
    },
    {
      tag: tags.propertyName,
      color: '#c4b5fd',
    },
    {
      tag: tags.variableName,
      color: '#e2e8f0',
    },
    {
      tag: tags.bracket,
      color: '#cbd5e1',
    },
  ],
  { themeType: 'dark' },
)

export const fluxLanguageSupport = [
  StreamLanguage.define(fluxStreamParser),
  syntaxHighlighting(fluxHighlightStyle),
]
