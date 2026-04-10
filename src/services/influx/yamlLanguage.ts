import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const yamlHighlightStyle = HighlightStyle.define(
  [
    {
      tag: tags.string,
      color: 'var(--influx-editor-token-string)',
    },
    {
      tag: tags.number,
      color: 'var(--influx-editor-token-number)',
    },
    {
      tag: tags.bool,
      color: 'var(--influx-editor-token-atom)',
      fontWeight: '600',
    },
    {
      tag: tags.null,
      color: 'var(--influx-editor-token-operator)',
      fontStyle: 'italic',
    },
    {
      tag: tags.atom,
      color: 'var(--influx-editor-token-property)',
    },
    {
      tag: tags.propertyName,
      color: 'var(--influx-editor-token-keyword)',
      fontWeight: '700',
    },
    {
      tag: tags.punctuation,
      color: 'var(--influx-editor-token-bracket)',
    },
    {
      tag: tags.comment,
      color: 'var(--influx-editor-token-comment)',
      fontStyle: 'italic',
    },
  ],
)

export const yamlLanguageSupport = [
  yaml(),
  syntaxHighlighting(yamlHighlightStyle),
]
