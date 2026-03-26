<script setup lang="ts">
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  createFluxCompletionSource,
  type FluxAutocompleteSchema,
} from '@/services/influx/fluxAutocomplete'

const props = withDefaults(
  defineProps<{
    modelValue: string
    completionSchema: FluxAutocompleteSchema
    placeholder?: string
  }>(),
  {
    placeholder: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRoot = ref<HTMLDivElement | null>(null)

const fluxEditorTheme = EditorView.theme(
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
    '.cm-panels': {
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      color: '#e2e8f0',
    },
  },
  { dark: true },
)

let editorView: EditorView | null = null
let isSyncingFromProps = false

function createExtensions() {
  const completionSource = createFluxCompletionSource(
    () => props.completionSchema,
  )

  return [
    minimalSetup,
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
    fluxEditorTheme,
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
  },
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
