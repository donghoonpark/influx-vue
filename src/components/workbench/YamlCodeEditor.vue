<script setup lang="ts">
import { EditorState } from '@codemirror/state'
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view'
import { minimalSetup } from 'codemirror'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useThemeVars } from 'naive-ui'

import { codeEditorTheme } from '@/components/workbench/codeEditorTheme'
import { yamlLanguageSupport } from '@/services/influx/yamlLanguage'
import { isDarkColor, withAlpha } from '@/utils/themeColor'

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
const themeVars = useThemeVars()
const editorThemeStyle = computed(() => {
  const dark = isDarkColor(themeVars.value.bodyColor)

  return {
    '--influx-editor-fg': themeVars.value.textColor1,
    '--influx-editor-caret': themeVars.value.textColor1,
    '--influx-editor-muted': themeVars.value.textColor3,
    '--influx-editor-selection': withAlpha(themeVars.value.infoColor, dark ? 0.3 : 0.18),
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
    '--influx-yaml-shell-border': withAlpha(
      themeVars.value.borderColor,
      dark ? 0.82 : 0.92,
    ),
    '--influx-yaml-shell-bg': dark
      ? `linear-gradient(180deg, ${withAlpha(themeVars.value.baseColor, 0.98)}, ${withAlpha(themeVars.value.modalColor, 0.98)})`
      : `linear-gradient(180deg, ${withAlpha(themeVars.value.baseColor, 0.98)}, ${withAlpha(themeVars.value.cardColor, 0.98)})`,
    '--influx-yaml-gutter-bg': dark
      ? withAlpha(themeVars.value.baseColor, 0.72)
      : withAlpha(themeVars.value.actionColor, 0.9),
    '--influx-yaml-gutter-fg': themeVars.value.textColor3,
    '--influx-yaml-gutter-border': withAlpha(
      themeVars.value.borderColor,
      dark ? 0.72 : 0.82,
    ),
    '--influx-yaml-gutter-active-bg': dark
      ? withAlpha(themeVars.value.modalColor, 0.92)
      : withAlpha(themeVars.value.actionColor, 0.95),
    '--influx-yaml-panels-bg': dark
      ? withAlpha(themeVars.value.baseColor, 0.96)
      : withAlpha(themeVars.value.baseColor, 0.96),
  }
})

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
  <div ref="editorRoot" class="yaml-editor-root" :style="editorThemeStyle" />
</template>

<style scoped>
.yaml-editor-root {
  min-height: 300px;
  border: 1px solid var(--influx-yaml-shell-border);
  border-radius: 16px;
  overflow: hidden;
  background: var(--influx-yaml-shell-bg);
}

.yaml-editor-root :deep(.cm-editor) {
  min-height: 300px;
  background: transparent;
}

.yaml-editor-root :deep(.cm-gutters) {
  background: var(--influx-yaml-gutter-bg);
  color: var(--influx-yaml-gutter-fg);
  border-right: 1px solid var(--influx-yaml-gutter-border);
}

.yaml-editor-root :deep(.cm-activeLineGutter) {
  background: var(--influx-yaml-gutter-active-bg);
}

.yaml-editor-root :deep(.cm-panels) {
  background: var(--influx-yaml-panels-bg);
}
</style>
