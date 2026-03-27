import { EditorView } from '@codemirror/view'

export const codeEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#e2e8f0',
      fontSize: '0.94rem',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      minHeight: '300px',
      padding: '12px 14px',
      caretColor: '#f8fafc',
      fontFamily: "'SFMono-Regular', 'Consolas', 'Menlo', monospace",
      lineHeight: '1.6',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: "'SFMono-Regular', 'Consolas', 'Menlo', monospace",
    },
    '.cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(56, 189, 248, 0.26)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(148, 163, 184, 0.08)',
    },
    '.cm-cursor': {
      borderLeftColor: '#f8fafc',
    },
    '.cm-tooltip-autocomplete': {
      border: '1px solid rgba(148, 163, 184, 0.24)',
      backgroundColor: 'rgba(15, 23, 42, 0.98)',
      color: '#e2e8f0',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'rgba(14, 165, 233, 0.22)',
      color: '#f8fafc',
    },
    '.cm-completionDetail': {
      color: 'rgba(148, 163, 184, 0.94)',
    },
    '.cm-completionLabel': {
      color: '#f8fafc',
    },
    '.cm-diagnostic': {
      padding: '4px 8px',
      borderRadius: '10px',
      backgroundColor: 'rgba(15, 23, 42, 0.98)',
      color: '#e2e8f0',
      border: '1px solid rgba(148, 163, 184, 0.24)',
    },
    '.cm-diagnostic-error': {
      borderLeft: '3px solid rgba(248, 113, 113, 0.9)',
    },
    '.cm-diagnosticText': {
      color: '#e2e8f0',
    },
    '.cm-panels': {
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      color: '#e2e8f0',
    },
  },
  { dark: true },
)
