import { useColorMode } from "@hope-ui/solid"
import { createEffect } from "solid-js"

// The index.html meta only covers first paint. From then on the UA's own
// colours (form fields, scrollbars) must follow the app's mode, not the OS.
// The Tailwind `dark` class lives here too so pages outside the shell (login)
// get the dark tokens.
export const ColorSchemeSync = () => {
  const { colorMode } = useColorMode()
  createEffect(() => {
    const root = document.documentElement
    root.style.colorScheme = colorMode()
    root.classList.toggle("dark", colorMode() === "dark")
  })
  return null
}
