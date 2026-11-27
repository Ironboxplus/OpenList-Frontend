import { useRouter } from "~/hooks"
import { objStore, viewerPath } from "~/store"
import { MoviCore } from "./movi_core"

// movi as a preview among others: a video inside an archive, or one opened
// with "Open with" in the document viewer. A video of a folder plays in the
// docked player (features/viewer/Dock.tsx), on its own MoviCore.
const Preview = () => {
  const { pathname } = useRouter()
  return (
    <MoviCore
      path={viewerPath() ?? pathname()}
      rawUrl={objStore.raw_url}
      provider={objStore.provider}
    />
  )
}

export default Preview
