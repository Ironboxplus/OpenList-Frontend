import { Button } from "~/components/ui/button"
import { SwitchColorMode } from "./SwitchColorMode"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Show, JSXElement, createSignal, onMount, onCleanup } from "solid-js"
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from "solid-icons/ai"
import { BsFullscreen, BsFullscreenExit } from "solid-icons/bs"
import { useT } from "~/hooks"
import { createDisclosure, Tooltip } from "~/components/overlay"

export const Error = (props: {
  msg: string
  disableColor?: boolean
  /** A CSS height; the parent's by default. */
  h?: string
  actions?: JSXElement
}) => {
  return (
    <div
      class="flex flex-col items-center justify-center p-2"
      style={{ height: props.h ?? "100%" }}
    >
      <div class="flex flex-col items-center gap-4 rounded-lg bg-card px-4 py-6">
        <h2 class="font-semibold break-all">{props.msg}</h2>
        <Show when={props.actions}>
          <div class="mt-4 flex justify-center">{props.actions}</div>
        </Show>
        <Show when={!props.disableColor}>
          <div class="mt-2 flex justify-end">
            <SwitchColorMode />
          </div>
        </Show>
      </div>
    </div>
  )
}

export const BoxWithFullScreen = (props: {
  /** A CSS height. */
  h: string
  extraButtons?: JSXElement
  children?: JSXElement
}) => {
  const { isOpen: isFullView, onToggle } = createDisclosure()
  const [isFullScreen, setIsFullScreen] = createSignal(false)
  let containerRef: HTMLDivElement
  const t = useT()

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef!.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  onMount(() => {
    const fsHandler = () => setIsFullScreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", fsHandler)
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", fsHandler)
    })
  })

  return (
    <div
      ref={containerRef!}
      class="top-0 left-0 transition-all duration-200 ease-in-out"
      classList={{
        "fixed z-[1400] backdrop-blur-[5px]": isFullView(),
        "relative w-full": !isFullView(),
      }}
      style={{
        width: isFullView() ? "100vw" : undefined,
        height: isFullView() ? "100vh" : props.h,
      }}
    >
      {props.children}
      <div class="pointer-events-auto absolute right-2 bottom-2 z-10 flex flex-col items-center gap-y-2 opacity-70 transition-opacity duration-300 ease-in hover:opacity-100">
        {props.extraButtons}
        <Show when={!isFullScreen()}>
          {/* Full view toggle */}
          <Tooltip
            label={
              isFullView()
                ? t("home.preview.exit_fullview")
                : t("home.preview.fullview")
            }
            withArrow
          >
            <Button
              aria-label={
                isFullView()
                  ? t("home.preview.exit_fullview")
                  : t("home.preview.fullview")
              }
              variant="secondary"
              size="icon-sm"
              onClick={onToggle}
            >
              {isFullView() ? <BsFullscreenExit /> : <BsFullscreen />}
            </Button>
          </Tooltip>
        </Show>

        {/* Native fullscreen toggle */}
        <Tooltip
          label={
            isFullScreen()
              ? t("home.preview.exit_fullscreen")
              : t("home.preview.fullscreen")
          }
          withArrow
        >
          <Button
            aria-label={
              isFullScreen()
                ? t("home.preview.exit_fullscreen")
                : t("home.preview.fullscreen")
            }
            variant="secondary"
            size="icon-sm"
            onClick={toggleFullscreen}
          >
            {isFullScreen() ? (
              <AiOutlineFullscreenExit />
            ) : (
              <AiOutlineFullscreen />
            )}
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}

/**
 * A select of plain options, on the kit's Select (Kobalte), so it works
 * inside the kit's dialogs and sheets: a hope Select portals its list out
 * of the dialog, where Kobalte's modal layer makes it unclickable
 * (PLAN_FE_UNIFY_OVERLAYS_1126 §2.2 E).
 */
export function SelectWrapper<T extends string | number>(props: {
  value: T | undefined
  onChange: (v: T) => void
  options: {
    value: T
    label?: string
  }[]
  placeholder?: string
  id?: string
}) {
  type Option = { value: T; label?: string }
  const text = (o: Option | undefined) =>
    o ? (o.label ?? String(o.value)) : ""
  return (
    <Select<Option>
      options={props.options}
      optionValue={(o) => String(o.value)}
      optionTextValue={text}
      value={props.options.find((o) => o.value === props.value)}
      onChange={(o) => {
        if (o) props.onChange(o.value)
      }}
      disallowEmptySelection
      placeholder={props.placeholder}
      itemComponent={(p) => (
        <SelectItem item={p.item}>{text(p.item.rawValue)}</SelectItem>
      )}
    >
      <SelectTrigger id={props.id}>
        <SelectValue<Option>>{(s) => text(s.selectedOption())}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )
}
