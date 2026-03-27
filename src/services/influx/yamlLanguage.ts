import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const yamlHighlightStyle = HighlightStyle.define(
  [
    {
      tag: tags.string,
      color: '#86efac',
    },
    {
      tag: tags.number,
      color: '#fbbf24',
    },
    {
      tag: tags.bool,
      color: '#f9a8d4',
      fontWeight: '600',
    },
    {
      tag: tags.null,
      color: '#fda4af',
      fontStyle: 'italic',
    },
    {
      tag: tags.atom,
      color: '#c4b5fd',
    },
    {
      tag: tags.propertyName,
      color: '#7dd3fc',
      fontWeight: '700',
    },
    {
      tag: tags.punctuation,
      color: '#cbd5e1',
    },
    {
      tag: tags.comment,
      color: '#94a3b8',
      fontStyle: 'italic',
    },
  ],
  { themeType: 'dark' },
)

export const yamlLanguageSupport = [
  yaml(),
  syntaxHighlighting(yamlHighlightStyle),
]
