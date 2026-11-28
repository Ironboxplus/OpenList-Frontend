import { BoxWithFullScreen } from "~/components"
import { objStore } from "~/store"
import { convertURL, asPreview } from "~/utils"
import { Component, createMemo } from "solid-js"
import { useLink } from "~/hooks"
import { TbExternalLink } from "solid-icons/tb"
import { Tooltip } from "~/components/overlay"
import { Button } from "~/components/ui/button"

const IframePreview = (props: { scheme: string }) => {
  const { currentPreviewLink } = useLink()
  const iframeSrc = createMemo(() => {
    return convertURL(props.scheme, {
      raw_url: asPreview(objStore.raw_url),
      name: objStore.obj.name,
      d_url: currentPreviewLink(true),
      ts: true,
    })
  })
  return (
    <BoxWithFullScreen
      h="70vh"
      extraButtons={
        <Tooltip label="Open in new tab" withArrow>
          <Button
            aria-label="Open in new tab"
            variant="secondary"
            size="icon-sm"
            onClick={() => {
              window.open(iframeSrc(), "_blank")
            }}
          >
            <TbExternalLink />
          </Button>
        </Tooltip>
      }
    >
      <iframe class="h-full w-full" src={iframeSrc()} />
    </BoxWithFullScreen>
  )
}

export const generateIframePreview = (scheme: string): Component => {
  return () => {
    return <IframePreview scheme={scheme} />
  }
}
