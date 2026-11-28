import { BoxWithFullScreen } from "~/components"
import { objStore } from "~/store"
import { hope, IconButton } from "@hope-ui/solid"
import { convertURL, asPreview } from "~/utils"
import { Component, createMemo } from "solid-js"
import { useLink } from "~/hooks"
import { TbExternalLink } from "solid-icons/tb"
import { Tooltip } from "~/components/overlay"

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
          <IconButton
            aria-label="Open in new tab"
            icon={<TbExternalLink />}
            onClick={() => {
              window.open(iframeSrc(), "_blank")
            }}
            colorScheme="neutral"
            size="sm"
          />
        </Tooltip>
      }
    >
      <hope.iframe w="$full" h="$full" src={iframeSrc()} />
    </BoxWithFullScreen>
  )
}

export const generateIframePreview = (scheme: string): Component => {
  return () => {
    return <IframePreview scheme={scheme} />
  }
}
