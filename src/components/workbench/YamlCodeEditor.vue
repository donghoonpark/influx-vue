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
  border: 1px solid rgba(51, 65, 85, 0.88);
  border-radius: 16px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.98));
}

.yaml-editor-root :deep(.cm-editor) {
  min-height: 300px;
  background: transparent;
}

.yaml-editor-root :deep(.cm-gutters) {
  background: rgba(2, 6, 23, 0.72);
  color: rgba(148, 163, 184, 0.84);
  border-right: 1px solid rgba(51, 65, 85, 0.7);
}

.yaml-editor-root :deep(.cm-activeLineGutter) {
  background: rgba(15, 23, 42, 0.92);
}

.yaml-editor-root :deep(.cm-panels) {
  background: rgba(2, 6, 23, 0.96);
}
</style>
