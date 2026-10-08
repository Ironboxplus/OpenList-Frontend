import { createSignal } from "solid-js"

/** Whether the command palette is open; the hotkey and the buttons toggle it. */
export const [paletteOpen, setPaletteOpen] = createSignal(false)

/** Ctrl+K on Windows/Linux, Cmd+K on macOS. */
export const isPaletteHotkey = (e: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}): boolean =>
  (e.ctrlKey || e.metaKey) &&
  !e.altKey &&
  !e.shiftKey &&
  e.key.toLowerCase() === "k"

export const hotkeyLabel = (): string =>
  /mac|iphone|ipad/i.test(navigator.platform) ? "⌘K" : "Ctrl K"
