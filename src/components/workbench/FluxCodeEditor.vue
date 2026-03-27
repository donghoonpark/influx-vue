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
  <div ref="editorRoot" class="flux-editor-root" />
</template>

<style scoped>
.flux-editor-root {
  min-height: 300px;
}

.flux-editor-root :deep(.cm-editor) {
  min-height: 300px;
}
</style>
