import EmbedPDF from "@embedpdf/snippet"
import pdfiumWasmUrl from "@embedpdf/snippet/dist/pdfium.wasm?url"
import { onMount } from "solid-js"
import { currentLang } from "~/app/i18n"
import { BoxWithFullScreen } from "~/components"
import { objStore } from "~/store"
import { base_path, asPreview } from "~/utils"
import { colorMode } from "~/store/color-mode"

const PDFViewer = () => {
  let ref: HTMLDivElement | undefined
  onMount(() => {
    const src = asPreview(objStore.raw_url)
    // wasm url must be absolute
    const absolutePdfiumWasmUrl = new URL(
      pdfiumWasmUrl,
      location.href + base_path,
    ).href
    if (ref && src) {
      EmbedPDF.init({
        type: "container",
        target: ref,
        src,
        theme: { preference: colorMode() },
        i18n: {
          defaultLocale: currentLang(),
          fallbackLocale: "en",
        },
        wasmUrl: absolutePdfiumWasmUrl,
      })
    }
  })
  return (
    <BoxWithFullScreen h="60vh">
      <div class="w-full h-full" ref={ref} />
    </BoxWithFullScreen>
  )
}

export default PDFViewer
