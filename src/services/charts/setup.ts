import { use } from 'echarts/core'
import { CustomChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

let chartsRegistered = false

export function ensureChartsRegistered() {
  if (chartsRegistered) {
    return
  }

  use([
    LineChart,
    ScatterChart,
    CustomChart,
    CanvasRenderer,
    DataZoomComponent,
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
  ])

  chartsRegistered = true
}
