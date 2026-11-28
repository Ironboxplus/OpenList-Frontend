import {
  BsArrowClockwise,
  BsArrowCounterclockwise,
  BsInfoCircle,
  BsZoomIn,
  BsZoomOut,
} from "solid-icons/bs"
import { FaSolidAngleLeft, FaSolidAngleRight } from "solid-icons/fa"
import {
  TbArrowAutofitHeight,
  TbArrowAutofitWidth,
  TbArrowAutofitContent,
} from "solid-icons/tb"
import {
  createEffect,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js"
import {
  BoxWithFullScreen,
  Error,
  FullLoading,
  ImageWithError,
} from "~/components"
import { useCDN, useRouter, useT } from "~/hooks"
import { objStore } from "~/store"
import { Obj, ObjType } from "~/types"
import {
  ext,
  formatDate,
  getFileSize,
  loadScriptIIFE,
  asPreview,
} from "~/utils"
import { Tooltip } from "~/components/overlay"
import { Button } from "~/components/ui/button"
import { cn } from "~/utils/cn"

const HEIF_EXTS = new Set(["heic", "heif", "avif", "vvc", "avc"])
const isHeif = (name: string) => HEIF_EXTS.has(ext(name).toLowerCase())
const ZOOM_MIN = 0.1
const ZOOM_MAX = 10
const ZOOM_WHEEL_FACTOR = 1.08
const ZOOM_BTN_STEP = 0.25

interface PreviewProps {
  images?: Obj[]
  navigate?: (name: string) => void
}

// ── HEIF decoder ────────────────────────────────────────────────────
const HeifView = (props: {
  src: string
  onLoad?: (w: number, h: number) => void
  style?: any
}) => {
  const t = useT()
  const { libHeifPath } = useCDN()
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal(false)
  let canvas: HTMLCanvasElement | undefined
  let libheif: any
  let decoder: any

  const decode = async (url: string) => {
    try {
      setLoading(true)
      setError(false)
      if (!window.libheif) {
        await loadScriptIIFE(`${libHeifPath()}/libheif.js`, "libheif-script")
      }
      if (!libheif) {
        const wasm = await fetch(`${libHeifPath()}/libheif.wasm`).then((r) => {
          if (!r.ok) throw "WASM load failed"
          return r.arrayBuffer()
        })
        libheif = window.libheif({ wasmBinary: wasm })
        decoder = new libheif.HeifDecoder()
      }
      const buffer = await fetch(url).then((r) => {
        if (!r.ok) throw "File fetch failed"
        return r.arrayBuffer()
      })
      const images = decoder.decode(buffer)
      if (!images?.length) throw "No decodable image"
      const img = images[0]
      const w = img.get_width()
      const h = img.get_height()
      if (!canvas) return
      canvas.width = w
      canvas.height = h
      const imageData = new ImageData(w, h)
      await new Promise<void>((resolve) => {
        img.display(imageData, (data: ImageData | null) => {
          if (!data || !canvas) return resolve()
          canvas.getContext("2d")?.putImageData(data, 0, 0)
          resolve()
        })
      })
      props.onLoad?.(w, h)
      setLoading(false)
    } catch (e) {
      console.error("HEIF decode failed:", e)
      setError(true)
      setLoading(false)
    }
  }

  createEffect(() => {
    if (props.src) decode(props.src)
  })
  onCleanup(() => {
    decoder = null
    libheif = null
  })

  return (
    <>
      <canvas
        ref={canvas}
        style={{
          ...props.style,
          display: loading() || error() ? "none" : "block",
        }}
      />
      <Show when={loading()}>
        <FullLoading />
      </Show>
      <Show when={error()}>
        <Error msg={t("home.preview.failed_load_img")} />
      </Show>
    </>
  )
}

// ── Preview ─────────────────────────────────────────────────────────
const Preview = (props: PreviewProps) => {
  const t = useT()
  const { replace } = useRouter()

  const [scale, setScale] = createSignal(1)
  const [rotation, setRotation] = createSignal(0)
  const [fitMode, setFitMode] = createSignal<"contain" | "height" | "width">(
    "contain",
  )
  const [tx, setTx] = createSignal(0)
  const [ty, setTy] = createSignal(0)
  const [dragging, setDragging] = createSignal(false)
  const [showInfo, setShowInfo] = createSignal(false)
  const [imgSize, setImgSize] = createSignal({ w: 0, h: 0 })
  const [isFullscreen, setIsFullscreen] = createSignal(false)

  let containerRef!: HTMLDivElement
  let areaRef!: HTMLDivElement
  let dragOX = 0
  let dragOY = 0
  let startTx = 0
  let startTy = 0

  let images =
    props.images ||
    objStore.objs.filter((o) => o.type === ObjType.IMAGE || isHeif(o.name))
  if (images.length === 0) images = [objStore.obj]

  const curIdx = () => images.findIndex((f) => f.name === objStore.obj.name)

  // ── reset on image change ──
  createEffect(() => {
    objStore.obj.name
    setScale(1)
    setRotation(0)
    setTx(0)
    setTy(0)
    setImgSize({ w: 0, h: 0 })
  })

  // ── navigation ──
  const goTo = (obj: Obj) => {
    if (props.navigate) props.navigate(obj.name)
    else replace(obj.name)
  }
  const prev = () => {
    const i = curIdx()
    if (i > 0) goTo(images[i - 1])
  }
  const next = () => {
    const i = curIdx()
    if (i < images.length - 1) goTo(images[i + 1])
  }

  // ── transforms ──
  const resetTransform = () => {
    setScale(1)
    setRotation(0)
    setTx(0)
    setTy(0)
  }
  const zoomIn = () => setScale((s) => Math.min(s + ZOOM_BTN_STEP, ZOOM_MAX))
  const zoomOut = () => setScale((s) => Math.max(s - ZOOM_BTN_STEP, ZOOM_MIN))
  const rotL = () => setRotation((r) => r - 90)
  const rotR = () => setRotation((r) => r + 90)
  const fitPage = () => {
    setFitMode("contain")
    setScale(1)
    setTx(0)
    setTy(0)
  }
  const fitHeight = () => {
    setFitMode("height")
    setScale(1)
    setTx(0)
    setTy(0)
  }
  const fitWidth = () => {
    setFitMode("width")
    setScale(1)
    setTx(0)
    setTy(0)
  }

  // ── wheel zoom (towards cursor) ──
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = areaRef.getBoundingClientRect()
    const cx = e.clientX - rect.left - rect.width / 2
    const cy = e.clientY - rect.top - rect.height / 2
    const oldS = scale()
    const factor = e.deltaY < 0 ? ZOOM_WHEEL_FACTOR : 1 / ZOOM_WHEEL_FACTOR
    const newS = Math.min(Math.max(oldS * factor, ZOOM_MIN), ZOOM_MAX)
    const r = newS / oldS
    setTx(cx - r * (cx - tx()))
    setTy(cy - r * (cy - ty()))
    setScale(newS)
  }

  // ── drag ──
  const onMouseDown = (e: MouseEvent) => {
    if (scale() <= 1 || e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    dragOX = e.clientX
    dragOY = e.clientY
    startTx = tx()
    startTy = ty()
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging()) return
    setTx(startTx + (e.clientX - dragOX))
    setTy(startTy + (e.clientY - dragOY))
  }
  const onMouseUp = () => setDragging(false)
  const onDblClick = () => (scale() === 1 ? setScale(2) : resetTransform())

  // ── image load ──
  const onImgLoad = (e: Event) => {
    const img = e.target as HTMLImageElement
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
  }
  const onHeifLoad = (w: number, h: number) => setImgSize({ w, h })

  // ── keyboard ──
  const onKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        return prev()
      case "ArrowRight":
        return next()
      case "+":
      case "=":
        return zoomIn()
      case "-":
        return zoomOut()
      case "r":
        return rotL()
      case "R":
        return rotR()
      case "0":
        return resetTransform()
      case "i":
        return setShowInfo((v) => !v)
      case "c":
        return fitPage()
      case "h":
        return fitHeight()
      case "w":
        return fitWidth()
      case "f":
      // TODO toggleFs()
    }
  }

  // ── fullscreen detection ──
  const updateFullscreen = () => {
    const native = !!document.fullscreenElement
    setIsFullscreen(native)
  }

  onMount(() => {
    window.addEventListener("keydown", onKey)
    areaRef?.addEventListener("wheel", onWheel, { passive: false })
    document.addEventListener("fullscreenchange", updateFullscreen)
    updateFullscreen()
  })
  onCleanup(() => {
    window.removeEventListener("keydown", onKey)
    areaRef?.removeEventListener("wheel", onWheel)
    document.removeEventListener("fullscreenchange", updateFullscreen)
  })

  const imgTransform = () =>
    `translate(${tx()}px,${ty()}px) scale(${scale()}) rotate(${rotation()}deg)`
  const cursor = () =>
    scale() > 1 ? (dragging() ? "grabbing" : "grab") : "default"

  // ── render ──────────────────────────────────────────────────────
  return (
    <BoxWithFullScreen h="70vh">
      <div class="flex flex-col items-center w-full h-full" ref={containerRef}>
        {/* ── Toolbar ── */}
        <div
          class={cn(
            "z-10 flex w-full bg-card p-2 transition-opacity duration-300",
            isFullscreen()
              ? "absolute top-0 left-0 opacity-70 hover:opacity-100"
              : "relative",
          )}
        >
          <div class="flex flex-row items-center gap-x-1">
            <Show when={curIdx() > 0}>
              <Tooltip label="Previous (←)">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Previous"
                  onClick={prev}
                >
                  <FaSolidAngleLeft />
                </Button>
              </Tooltip>
            </Show>
            <Show when={curIdx() < images.length - 1}>
              <Tooltip label="Next (→)">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Next"
                  onClick={next}
                >
                  <FaSolidAngleRight />
                </Button>
              </Tooltip>
            </Show>
            <p class="ml-1 hidden max-w-[280px] truncate text-sm sm:block">
              {objStore.obj.name}
            </p>
            <Show when={images.length > 1}>
              <p class="text-muted-foreground text-xs leading-4">
                {curIdx() + 1}/{images.length}
              </p>
            </Show>
          </div>
          <div class="flex-1 self-stretch" />
          <div class="flex flex-row items-center gap-x-1">
            <Tooltip label="Info (I)">
              <Button
                aria-label="Info"
                variant={showInfo() ? "subtle" : "ghost"}
                size="icon-sm"
                onClick={() => setShowInfo((v) => !v)}
              >
                <BsInfoCircle />
              </Button>
            </Tooltip>

            <Tooltip label="Zoom out (−)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Zoom out"
                onClick={zoomOut}
              >
                <BsZoomOut />
              </Button>
            </Tooltip>
            <Tooltip label="Zoom in (+)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Zoom in"
                onClick={zoomIn}
              >
                <BsZoomIn />
              </Button>
            </Tooltip>
            <Tooltip label="Fit page (C)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Fit page"
                onClick={fitPage}
              >
                <TbArrowAutofitContent />
              </Button>
            </Tooltip>
            <Tooltip label="Fit height (H)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Fit height"
                onClick={fitHeight}
              >
                <TbArrowAutofitHeight />
              </Button>
            </Tooltip>
            <Tooltip label="Fit width (W)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Fit width"
                onClick={fitWidth}
              >
                <TbArrowAutofitWidth />
              </Button>
            </Tooltip>
            <Tooltip label="Rotate left (R)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Rotate left"
                onClick={rotL}
              >
                <BsArrowCounterclockwise />
              </Button>
            </Tooltip>
            <Tooltip label="Rotate right (Shift+R)">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Rotate right"
                onClick={rotR}
              >
                <BsArrowClockwise />
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* ── Image area ── */}
        <div
          ref={areaRef}
          class={cn(
            "flex w-full flex-1 items-center justify-center overflow-hidden bg-muted",
            isFullscreen() && "h-full",
          )}
          style={{ cursor: cursor() }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDblClick={onDblClick}
        >
          <div
            class={cn(
              "flex items-center justify-center",
              fitMode() === "contain" && "h-full w-full",
              fitMode() === "height" && "h-full w-fit",
              fitMode() === "width" && "h-fit w-full",
            )}
            style={{
              transform: imgTransform(),
              transition: dragging() ? "none" : "transform 0.15s ease",
              "transform-origin": "center center",
            }}
          >
            <Switch
              fallback={
                <ImageWithError
                  src={asPreview(objStore.raw_url)}
                  fallback={<FullLoading />}
                  fallbackErr={
                    <Error msg={t("home.preview.failed_load_img")} />
                  }
                  onLoad={onImgLoad}
                  class={
                    fitMode() === "contain"
                      ? "h-full w-full object-contain"
                      : fitMode() === "height"
                        ? "h-full w-auto max-w-none"
                        : "h-auto max-h-none w-full"
                  }
                />
              }
            >
              <Match when={isHeif(objStore.obj.name)}>
                <HeifView
                  src={asPreview(objStore.raw_url)}
                  onLoad={onHeifLoad}
                  style={
                    fitMode() === "contain"
                      ? {
                          width: "100%",
                          height: "100%",
                          "object-fit": "contain",
                        }
                      : fitMode() === "height"
                        ? { height: "100%", width: "auto" }
                        : { width: "100%", height: "auto" }
                  }
                />
              </Match>
            </Switch>
          </div>

          {/* ── Info overlay ── */}
          <Show when={showInfo()}>
            <div class="absolute bottom-2 left-2 z-10 rounded-md bg-black/70 p-2 text-sm backdrop-blur-sm">
              <p class="font-semibold text-white">{objStore.obj.name}</p>
              <p class="text-white/80">{getFileSize(objStore.obj.size)}</p>
              <Show when={imgSize().w > 0}>
                <p class="text-white/80">
                  {imgSize().w} × {imgSize().h}px
                </p>
              </Show>
              <p class="text-white/80">{formatDate(objStore.obj.modified)}</p>
            </div>
          </Show>
        </div>
      </div>
    </BoxWithFullScreen>
  )
}

export default Preview
