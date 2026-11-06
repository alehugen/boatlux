import { computed } from 'vue'
import { useTheme } from './useTheme'

// As duas primeiras cores são azuis da marca Boat Lux; as demais diferenciam séries extras.
const SERIES = {
  light: ['#0b4976', '#4b9fd8', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#e34948'],
  dark: ['#12bff9', '#5b86c0', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767'],
}

const CHROME = {
  light: {
    surface: '#ffffff',
    text: '#00244f',
    textMuted: '#586b80',
    axis: '#b6c9da',
    grid: '#e6eef5',
    tooltipBorder: '#dae4ed',
  },
  dark: {
    surface: '#0a2f5e',
    text: '#eef5fb',
    textMuted: '#93abc3',
    axis: '#22507f',
    grid: '#0f3566',
    tooltipBorder: '#22507f',
  },
}

export function useChartTheme() {
  const { isDark } = useTheme()

  return computed(() => {
    const mode = isDark.value ? 'dark' : 'light'
    const chrome = CHROME[mode]
    const series = SERIES[mode]
    const tooltip = {
      backgroundColor: chrome.surface,
      borderColor: chrome.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: chrome.text, fontSize: 13 },
      extraCssText: 'border-radius: 4px; box-shadow: 0 12px 28px -14px rgb(0 0 0 / 0.35);',
    }

    return {
      series,
      chrome,
      fontFamily: "'WeezerFont', 'Century Gothic', ui-sans-serif, system-ui, sans-serif",
      axisTooltip: {
        ...tooltip,
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const, shadowStyle: { color: `${chrome.grid}99` } },
      },
    }
  })
}
