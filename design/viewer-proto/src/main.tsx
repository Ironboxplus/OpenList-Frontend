/* @refresh reload */
import "./styles.css"
import "~/app/index.css"
import { render } from "solid-js/web"
import { HopeProvider } from "@hope-ui/solid"
import { ColorSchemeSync } from "~/app/ColorSchemeSync"
import { globalStyles, theme } from "~/app/theme"
import { App } from "./App"
import { installMotionLog } from "./motion"
import { installReadOnly } from "./readonly"

installMotionLog()
installReadOnly()

// The app's provider, theme and colour-mode sync (src/app/index.tsx), so the
// base styles and the light/dark switch are the real ones.
render(
  () => {
    globalStyles()
    return (
      <HopeProvider config={theme}>
        <ColorSchemeSync />
        <App />
      </HopeProvider>
    )
  },
  document.getElementById("root") as HTMLElement,
)
