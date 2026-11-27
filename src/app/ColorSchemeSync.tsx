import { useColorMode } from "@hope-ui/solid"
import { createEffect } from "solid-js"
import { colorMode } from "~/store/color-mode"

// The store is the one colour mode. The index.html meta only covers first
// paint; from then on the UA's own colours (form fields, scrollbars) follow the
// app's mode, not the OS, and the Tailwind `dark` class on <html> is the single
// switch the styles key on (login and the shell alike).
// The hope components still on the page read their own mode: hand it the
// store's until B6 removes the provider (PLAN_FE_SYSTEM_UX_1127 P5).
export const ColorSchemeSync = () => {
  const hope = useColorMode()
  createEffect(() => {
    const root = document.documentElement
    root.style.colorScheme = colorMode()
    root.classList.toggle("dark", colorMode() === "dark")
    hope.setColorMode(colorMode())
  })
  return null
}
