import { createSignal } from "solid-js"
import { getMainColor } from "./settings"

export interface AccentPreset {
  name: string
  color: string
}

/**
 * Curated accent presets.
 * Default follows the site main color (OpenList blue); presets are refined
 * mid-tone colors that read well on both light and dark surfaces.
 */
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Blue", color: "#2563eb" },
  { name: "Indigo", color: "#4f46e5" },
  { name: "Sky", color: "#0284c7" },
  { name: "Teal", color: "#0d9488" },
  { name: "Emerald", color: "#059669" },
  { name: "Olive", color: "#65a30d" },
  { name: "Amber", color: "#b45309" },
  { name: "Rose", color: "#be123c" },
  { name: "Violet", color: "#7c3aed" },
  { name: "Slate", color: "#475569" },
]

const STORAGE_KEY = "openlist-accent-color"
// 是否允许媒体主题色覆盖站点主色（默认开启，但只在媒体库页面生效）
const ENABLED_KEY = "openlist-media-accent-enabled"

const stored =
  typeof localStorage !== "undefined"
    ? (localStorage.getItem(STORAGE_KEY) ?? "")
    : ""

const storedEnabled =
  typeof localStorage !== "undefined" ? localStorage.getItem(ENABLED_KEY) : null

const [accentColor, setAccentColorRaw] = createSignal(stored)

const [mediaAccentEnabledRaw, setMediaAccentEnabledRaw] = createSignal(
  storedEnabled === null ? true : storedEnabled === "true",
)

/** 媒体主题色是否启用（关闭后媒体页同样使用站点默认色板） */
export const mediaAccentEnabled = mediaAccentEnabledRaw

export const setMediaAccentEnabled = (enabled: boolean) => {
  setMediaAccentEnabledRaw(enabled)
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled))
  } catch {
    /* ignore */
  }
}

/** Current accent: user selection first, otherwise the site main color. */
export const accent = () => accentColor() || getMainColor()

export { accentColor }

// ==================== color helpers ====================

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))

const hexToRgb = (hex: string): [number, number, number] => {
  let h = hex.replace("#", "").trim()
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  }
  const num = parseInt(h, 16)
  if (Number.isNaN(num)) return [37, 99, 235]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

const rgbToHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")

export const hexToHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      break
    case g:
      h = ((b - r) / d + 2) / 6
      break
    default:
      h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s, l]
}

export const hslToHex = (h: number, s: number, l: number): string => {
  h = ((h % 360) + 360) % 360
  s = clamp(s)
  l = clamp(l)
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255)
}

/** Shift lightness by delta (-1..1), keeping hue and saturation. */
export const shiftLightness = (hex: string, delta: number): string => {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, s, clamp(l + delta))
}

/**
 * Write the media colour to CSS variables: the kit's primary buttons, chips
 * and focus rings follow it.
 */
export const applyAccentPalette = (color: string) => {
  if (typeof document === "undefined") return
  ;[document.documentElement, document.body].forEach((el) => {
    Object.entries(kitVars(color)).forEach(([key, value]) => {
      el.style.setProperty(key, value)
    })
  })
}

const kitVars = (color: string): Record<string, string> => ({
  "--primary": color,
  "--ring": color,
  "--primary-foreground": "#fff",
})

/** Remove the inline overrides so the site's own colours (e.g. login page) are used. */
export const clearAccentPalette = () => {
  if (typeof document === "undefined") return
  ;[document.documentElement, document.body].forEach((el) => {
    Object.keys(kitVars("")).forEach((key) => el.style.removeProperty(key))
  })
}

/**
 * Set and persist the accent color.
 * 这里不直接写全局 CSS 变量：由 App 的 effect 根据当前路由决定是否生效，
 * 避免在文件页/管理页选色时污染整站配色。
 */
export const setAccentColor = (color: string) => {
  setAccentColorRaw(color)
  try {
    localStorage.setItem(STORAGE_KEY, color)
  } catch {
    /* ignore */
  }
}

/** Restore the site default color. */
export const resetAccentColor = () => {
  setAccentColorRaw("")
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
