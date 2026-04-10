<script setup lang="ts">
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete'
import { setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { codeEditorTheme } from '@/components/workbench/codeEditorTheme'
import {
  createFluxCompletionSource,
  type FluxAutocompleteSchemaProvider,
} from '@/services/influx/fluxAutocomplete'
import { fluxLanguageSupport } from '@/services/influx/fluxLanguage'
import type { FluxValidationIssue } from '@/services/influx/fluxValidation'
import { useThemeVars } from 'naive-ui'
import { computed } from 'vue'
import { isDarkColor, withAlpha } from '@/utils/themeColor'

const props = withDefaults(
  defineProps<{
    modelValue: string
    completionSchemaProvider: FluxAutocompleteSchemaProvider
    validationIssues?: FluxValidationIssue[]
    placeholder?: string
  }>(),
  {
    placeholder: '',
    validationIssues: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRoot = ref<HTMLDivElement | null>(null)
const themeVars = useThemeVars()
const editorThemeStyle = computed(() => {
  const dark = isDarkColor(themeVars.value.bodyColor)

  return {
    '--influx-editor-fg': themeVars.value.textColor1,
    '--influx-editor-caret': themeVars.value.textColor1,
    '--influx-editor-muted': themeVars.value.textColor3,
    '--influx-editor-selection': withAlpha(themeVars.value.infoColor, dark ? 0.3 : 0.2),
    '--influx-editor-active-line': withAlpha(
      themeVars.value.textColor3,
      dark ? 0.12 : 0.08,
    ),
    '--influx-editor-popover-bg': dark
      ? withAlpha(themeVars.value.modalColor, 0.98)
      : withAlpha(themeVars.value.baseColor, 0.98),
    '--influx-editor-popover-border': withAlpha(
      themeVars.value.borderColor,
      dark ? 0.64 : 0.9,
    ),
    '--influx-editor-popover-selected-bg': withAlpha(
      themeVars.value.infoColor,
      dark ? 0.24 : 0.14,
    ),
    '--influx-editor-popover-selected-fg': themeVars.value.textColor1,
    '--influx-editor-panels-bg': dark
      ? withAlpha(themeVars.value.modalColor, 0.96)
      : withAlpha(themeVars.value.baseColor, 0.96),
    '--influx-editor-error': themeVars.value.errorColor,
    '--influx-editor-token-keyword': dark ? '#7dd3fc' : '#0369a1',
    '--influx-editor-token-atom': dark ? '#f9a8d4' : '#be185d',
    '--influx-editor-token-string': dark ? '#86efac' : '#15803d',
    '--influx-editor-token-number': dark ? '#fbbf24' : '#b45309',
    '--influx-editor-token-comment': dark ? '#94a3b8' : '#64748b',
    '--influx-editor-token-operator': dark ? '#fda4af' : '#be123c',
    '--influx-editor-token-property': dark ? '#c4b5fd' : '#6d28d9',
    '--influx-editor-token-variable': themeVars.value.textColor1,
    '--influx-editor-token-bracket': dark ? '#cbd5e1' : '#475569',
  }
})

let editorView: EditorView | null = null
let isSyncingFromProps = false

function toCodeMirrorDiagnostics(
  issues: readonly FluxValidationIssue[],
): Diagnostic[] {
  return issues.map((issue) => ({
    from: issue.from,
    to: issue.to,
    severity: issue.severity,
    message: issue.message,
    source: issue.source,
  }))
}

function applyDiagnostics() {
  if (!editorView) {
    return
  }

  editorView.dispatch(
    setDiagnostics(
      editorView.state,
      toCodeMirrorDiagnostics(props.validationIssues),
    ),
  )
}

function createExtensions() {
  const completionSource = createFluxCompletionSource(
    props.completionSchemaProvider,
  )

  return [
    minimalSetup,
    ...fluxLanguageSupport,
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
    EditorView.lineWrapping,
    cmPlaceholder(props.placeholder),
    autocompletion({
      override: [completionSource],
      activateOnTyping: true,
      maxRenderedOptions: 14,
      icons: false,
    }),
    codeEditorTheme,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || isSyncingFromProps) {
        return
      }

      emit('update:modelValue', update.state.doc.toString())
    }),
  ]
}

function mountEditor() {
  if (!editorRoot.value) {
    return
  }

  editorView = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: createExtensions(),
    }),
    parent: editorRoot.value,
  })

  applyDiagnostics()
}

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!editorView) {
      return
    }

    const currentValue = editorView.state.doc.toString()
    if (nextValue === currentValue) {
      return
    }

    isSyncingFromProps = true
    editorView.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: nextValue,
      },
    })
    isSyncingFromProps = false
    applyDiagnostics()
  },
)

watch(
  () => props.validationIssues,
  () => {
    applyDiagnostics()
  },
  { deep: true },
)

onMounted(() => {
  mountEditor()
})

onBeforeUnmount(() => {
  editorView?.destroy()
  editorView = null
})
</script>

<template>
  <div ref="editorRoot" class="flux-editor-root" :style="editorThemeStyle" />
</template>

<style scoped>
.flux-editor-root {
  min-height: 300px;
}

.flux-editor-root :deep(.cm-editor) {
  min-height: 300px;
}
</style>
