function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clampAlpha(value: number) {
  return Math.max(0, Math.min(1, value))
}

function parseHexColor(value: string) {
  const normalized = value.replace('#', '').trim()

  if (![3, 4, 6, 8].includes(normalized.length)) {
    return null
  }

  const expanded =
    normalized.length <= 4
      ? normalized
          .split('')
          .map((part) => part + part)
          .join('')
      : normalized

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)
  const alpha =
    expanded.length === 8
      ? Number.parseInt(expanded.slice(6, 8), 16) / 255
      : 1

  if ([red, green, blue, alpha].some((channel) => Number.isNaN(channel))) {
    return null
  }

  return {
    red,
    green,
    blue,
    alpha,
  }
}

function parseRgbColor(value: string) {
  const match = value
    .trim()
    .match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
    )

  if (!match) {
    return null
  }

  const red = Number.parseFloat(match[1] ?? '')
  const green = Number.parseFloat(match[2] ?? '')
  const blue = Number.parseFloat(match[3] ?? '')
  const alpha = Number.parseFloat(match[4] ?? '1')

  if ([red, green, blue, alpha].some((channel) => Number.isNaN(channel))) {
    return null
  }

  return {
    red,
    green,
    blue,
    alpha,
  }
}

function parseColor(value: string) {
  if (value.startsWith('#')) {
    return parseHexColor(value)
  }

  if (value.startsWith('rgb')) {
    return parseRgbColor(value)
  }

  return null
}

export function withAlpha(value: string, alpha: number) {
  const parsed = parseColor(value)

  if (!parsed) {
    return value
  }

  return `rgba(${clampChannel(parsed.red)}, ${clampChannel(parsed.green)}, ${clampChannel(parsed.blue)}, ${clampAlpha(alpha)})`
}

export function isDarkColor(value: string) {
  const parsed = parseColor(value)

  if (!parsed) {
    return false
  }

  const luminance =
    (0.2126 * parsed.red + 0.7152 * parsed.green + 0.0722 * parsed.blue) / 255

  return luminance < 0.55
}
