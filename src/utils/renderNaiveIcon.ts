import { h, type Component } from 'vue'

import { NIcon } from 'naive-ui'

export function renderNaiveIcon(icon: Component) {
  return () =>
    h(NIcon, null, {
      default: () => h(icon),
    })
}
