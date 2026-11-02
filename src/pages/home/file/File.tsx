import { HStack, Text, VStack } from "@hope-ui/solid"
import { createMemo, ErrorBoundary, onCleanup, Show, Suspense } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Error, FullLoading, SelectWrapper } from "~/components"
import { ObjStore, objStore, previewDenied } from "~/store"
import { useRouter, useT } from "~/hooks"
import { asPreview, isShareContentUrl, probeStatus } from "~/utils"
import { Download } from "../previews/download"
import { OpenWith } from "./open-with"
import { getPreviews } from "../previews"

const File = () => {
  const t = useT()
  const { searchParams, setSearchParams } = useRouter()
  // Read again when a share turns out to refuse previews (onMediaError).
  const previews = createMemo(() =>
    getPreviews({ ...objStore.obj, provider: objStore.provider }),
  )
  const cur = createMemo(() => {
    if (!previews().length) return undefined
    const selected = searchParams["preview"]
    if (selected) {
      const found = previews().find((item) => item.key === selected)
      if (found) return found
    }
    return previews()[0]
  })

  // A player or viewer of a share failed to load: ask the link whether the
  // owner switched preview off (423; a HEAD is never counted), and if so show
  // that instead of the player's own error.
  let checking = false
  const onMediaError = async () => {
    if (checking || previewDenied() || !isShareContentUrl(objStore.raw_url))
      return
    checking = true
    const status = await probeStatus(asPreview(objStore.raw_url))
    checking = false
    if (status === 423) ObjStore.setShareLimits(false, objStore.allow_download)
  }
  let box: HTMLDivElement | undefined
  const watch = (el: HTMLDivElement) => {
    box = el
    // Media errors do not bubble: listen while they travel down.
    el.addEventListener("error", onMediaError, true)
  }
  onCleanup(() => box?.removeEventListener("error", onMediaError, true))

  return (
    <Show when={previews().length > 1} fallback={<Download openWith />}>
      <VStack w="$full" spacing="$2" ref={watch}>
        <Show when={previewDenied()}>
          <Text color="$neutral11">{t("shares.preview_disabled")}</Text>
        </Show>
        <HStack w="$full" spacing="$2">
          <SelectWrapper
            alwaysShowBorder
            value={cur()?.key || ""}
            onChange={(key) => {
              setSearchParams({ preview: key }, { replace: true })
            }}
            options={previews().map((item) => ({
              value: item.key,
              label: item.name,
            }))}
          />
          <OpenWith />
        </HStack>
        <ErrorBoundary fallback={(err) => <Error msg={String(err)} />}>
          <Suspense fallback={<FullLoading />}>
            <Dynamic component={cur()?.component} />
          </Suspense>
        </ErrorBoundary>
      </VStack>
    </Show>
  )
}

export default File
