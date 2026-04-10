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
      color: 'var(--influx-editor-token-keyword)',
      fontWeight: '700',
    },
    {
      tag: tags.atom,
      color: 'var(--influx-editor-token-atom)',
      fontWeight: '600',
    },
    {
      tag: tags.string,
      color: 'var(--influx-editor-token-string)',
    },
    {
      tag: tags.number,
      color: 'var(--influx-editor-token-number)',
    },
    {
      tag: tags.comment,
      color: 'var(--influx-editor-token-comment)',
      fontStyle: 'italic',
    },
    {
      tag: tags.operator,
      color: 'var(--influx-editor-token-operator)',
    },
    {
      tag: tags.propertyName,
      color: 'var(--influx-editor-token-property)',
    },
    {
      tag: tags.variableName,
      color: 'var(--influx-editor-token-variable)',
    },
    {
      tag: tags.bracket,
      color: 'var(--influx-editor-token-bracket)',
    },
  ],
)

export const fluxLanguageSupport = [
  StreamLanguage.define(fluxStreamParser),
  syntaxHighlighting(fluxHighlightStyle),
]
