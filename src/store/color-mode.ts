import { createSignal } from "solid-js"

export type ColorMode = "light" | "dark"

// hope-ui's key, so the choice users already made carries over
const KEY = "hope-ui-color-mode"

const initial = (): ColorMode => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === "light" || saved === "dark") return saved
  } catch {
    /* storage may be unavailable */
  }
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

const [colorMode, setMode] = createSignal<ColorMode>(initial())

const setColorMode = (mode: ColorMode) => {
  setMode(mode)
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* the choice just does not outlive the page */
  }
}

const toggleColorMode = () =>
  setColorMode(colorMode() === "dark" ? "light" : "dark")

/** A value per mode, as an accessor (hope's useColorModeValue). */
const colorModeValue =
  <T>(light: T, dark: T) =>
  () =>
    colorMode() === "dark" ? dark : light

export { colorMode, colorModeValue, setColorMode, toggleColorMode }
