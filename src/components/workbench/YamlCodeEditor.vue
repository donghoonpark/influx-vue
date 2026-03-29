<script setup lang="ts">
import { EditorState } from '@codemirror/state'
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { codeEditorTheme } from '@/components/workbench/codeEditorTheme'
import { yamlLanguageSupport } from '@/services/influx/yamlLanguage'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    readOnly?: boolean
  }>(),
  {
    placeholder: '',
    readOnly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRoot = ref<HTMLDivElement | null>(null)

let editorView: EditorView | null = null
let isSyncingFromProps = false

function createExtensions() {
  return [
    minimalSetup,
    ...yamlLanguageSupport,
    EditorView.lineWrapping,
    EditorState.readOnly.of(props.readOnly),
    EditorView.editable.of(!props.readOnly),
    cmPlaceholder(props.placeholder),
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
  <div ref="editorRoot" class="yaml-editor-root" />
</template>

<style scoped>
.yaml-editor-root {
  min-height: 300px;
}

.yaml-editor-root :deep(.cm-editor) {
  min-height: 300px;
}
</style>
