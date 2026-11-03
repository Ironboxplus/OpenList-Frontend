import { createMemo, createSignal } from "solid-js"
import { useRouter } from "~/hooks"
import { objStore } from "~/store"
import { ObjType } from "~/types"
import { pathDir, pathJoin } from "~/utils"
import { VideoBox } from "./video_box"
import { useNavigate } from "@solidjs/router"
import { MoviCore } from "./movi_core"

// The file page's movi preview: the siblings, the router and the stores stay
// here; the player itself is MoviCore, which the media library overlay shares.
const Preview = () => {
  const { pathname } = useRouter()
  const navigate = useNavigate()

  const videos = createMemo(() =>
    objStore.objs.filter((obj) => obj.type === ObjType.VIDEO),
  )

  const next_video = () => {
    const index = videos().findIndex((f) => f.name === objStore.obj.name)
    if (index < videos().length - 1) {
      navigate(pathJoin(pathDir(location.pathname), videos()[index + 1].name))
    }
  }

  const [autoNext, setAutoNext] = createSignal(false)

  return (
    <VideoBox onAutoNextChange={setAutoNext}>
      <MoviCore
        path={pathname()}
        rawUrl={objStore.raw_url}
        provider={objStore.provider}
        autoNext={autoNext()}
        onNext={next_video}
      />
    </VideoBox>
  )
}

export default Preview
