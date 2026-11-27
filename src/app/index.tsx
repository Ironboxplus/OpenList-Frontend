import { HopeProvider } from "@hope-ui/solid"
import { ErrorBoundary, Suspense } from "solid-js"
import { Error, FullScreenLoading } from "~/components"
import { ToastRegion } from "~/components/ui/toast"
import { phoneShell } from "~/features/shell/topbar-slot"
import { TAB_BAR_HEIGHT } from "~/features/shell/viewport"
import App from "./App"
import { ColorSchemeSync } from "./ColorSchemeSync"
import { globalStyles, theme } from "./theme"

const Index = () => {
  globalStyles()
  return (
    <HopeProvider config={theme}>
      <ColorSchemeSync />
      <ErrorBoundary
        fallback={(err) => {
          console.error("error", err)
          return <Error msg={`System error: ${err}`} h="100vh" />
        }}
      >
        <Suspense fallback={<FullScreenLoading />}>
          <App />
        </Suspense>
      </ErrorBoundary>
      {/* toasts (utils/notify): above the phone's tab bar */}
      <ToastRegion bottom={phoneShell() ? TAB_BAR_HEIGHT : "0px"} />
    </HopeProvider>
  )
}

export { Index }
