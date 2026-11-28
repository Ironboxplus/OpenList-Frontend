import { createEffect } from "solid-js"
import { colorMode } from "~/store/color-mode"

// The store is the one colour mode. The index.html meta only covers first
// paint; from then on the UA's own colours (form fields, scrollbars) follow the
// app's mode, not the OS, and the Tailwind `dark` class on <html> is the single
// switch the styles key on (login and the shell alike).
export const ColorSchemeSync = () => {
  createEffect(() => {
    const root = document.documentElement
    root.style.colorScheme = colorMode()
    root.classList.toggle("dark", colorMode() === "dark")
  })
  return null
}
