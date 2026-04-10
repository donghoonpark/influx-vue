import { EditorView } from '@codemirror/view'

export const codeEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--influx-editor-fg)',
      fontSize: '0.94rem',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      minHeight: '300px',
      padding: '12px 14px',
      caretColor: 'var(--influx-editor-caret)',
      fontFamily: "'SFMono-Regular', 'Consolas', 'Menlo', monospace",
      lineHeight: '1.6',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: "'SFMono-Regular', 'Consolas', 'Menlo', monospace",
    },
    '.cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--influx-editor-selection)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--influx-editor-active-line)',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--influx-editor-caret)',
    },
    '.cm-tooltip-autocomplete': {
      border: '1px solid var(--influx-editor-popover-border)',
      backgroundColor: 'var(--influx-editor-popover-bg)',
      color: 'var(--influx-editor-fg)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--influx-editor-popover-selected-bg)',
      color: 'var(--influx-editor-popover-selected-fg)',
    },
    '.cm-completionDetail': {
      color: 'var(--influx-editor-muted)',
    },
    '.cm-completionLabel': {
      color: 'var(--influx-editor-fg)',
    },
    '.cm-diagnostic': {
      padding: '4px 8px',
      borderRadius: '10px',
      backgroundColor: 'var(--influx-editor-popover-bg)',
      color: 'var(--influx-editor-fg)',
      border: '1px solid var(--influx-editor-popover-border)',
    },
    '.cm-diagnostic-error': {
      borderLeft: '3px solid var(--influx-editor-error)',
    },
    '.cm-diagnosticText': {
      color: 'var(--influx-editor-fg)',
    },
    '.cm-panels': {
      backgroundColor: 'var(--influx-editor-panels-bg)',
      color: 'var(--influx-editor-fg)',
    },
  },
)
