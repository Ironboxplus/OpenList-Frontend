import {
  For,
  Match,
  Show,
  Switch,
  batch,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { CenterLoading, ImageWithError, LinkWithPush } from "~/components"
import { useLink, useT, useUtil } from "~/hooks"
import { openListed } from "~/features/viewer/state"
import {
  getMainColor,
  local,
  objStore,
  selectIndex,
  smartCountMsg,
} from "~/store"
import { ObjType, StoreObj } from "~/types"
import { getIconByObj } from "~/utils/icon"
import { BsPlayCircleFill } from "solid-icons/bs"
import { selectForMenu } from "./helper"
import {
  clampPreview,
  masonryCardKind,
  masonryNameAlwaysVisible,
} from "./masonry-card"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/utils/cn"

// Lazily fetch a text file's head once the card is visible, so a folder full
// of text files doesn't fire a request storm on mount.
const TextPreview = (props: { obj: StoreObj }) => {
  const { previewLink } = useLink()
  const [content, setContent] = createSignal<string>()
  const [failed, setFailed] = createSignal(false)
  let el: HTMLDivElement | undefined
  let io: IntersectionObserver | undefined
  const load = async () => {
    try {
      const resp = await fetch(previewLink(props.obj, true), {
        headers: { Range: "bytes=0-8191" },
      })
      const text = await resp.text()
      setContent(clampPreview(text))
    } catch {
      setFailed(true)
    }
  }
  onMount(() => {
    if (!el) return
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io?.disconnect()
          load()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
  })
  onCleanup(() => io?.disconnect())
  return (
    <div class="w-full h-[220px] relative bg-muted" ref={el}>
      <Show
        when={content() !== undefined}
        fallback={
          <div class="flex flex-col w-full h-full p-3 items-stretch gap-y-2">
            <Show when={!failed()} fallback={<CenterLoading size="lg" />}>
              <Skeleton class="h-[12px]" />
              <Skeleton class="h-[12px]" />
              <Skeleton class="h-[12px] w-[80%]" />
              <Skeleton class="h-[12px]" />
              <Skeleton class="h-[12px] w-[60%]" />
            </Show>
          </div>
        }
      >
        <pre class="m-0 h-full w-full overflow-hidden p-3 font-mono text-[11px] leading-[1.5] break-words whitespace-pre-wrap text-muted-foreground">
          {content()}
        </pre>
      </Show>
      {/* fade the bottom so truncation looks intentional */}
      <div class="absolute right-0 bottom-0 left-0 h-12 bg-linear-to-t from-muted to-transparent" />
    </div>
  )
}

const MasonryItem = (props: { obj: StoreObj; index: number }) => {
  const { isHide } = useUtil()
  if (isHide(props.obj)) {
    return null
  }
  const obj = props.obj
  const kind = masonryCardKind(obj)
  const isImage = kind === "image"
  const { previewLink } = useLink()
  const typeIcon = (size: string) => (
    <Dynamic
      component={getIconByObj(obj)}
      style={{ color: getMainColor(), "font-size": size }}
    />
  )
  return (
    <div style={{ "break-inside": "avoid", "margin-bottom": "0.6rem" }}>
      <LinkWithPush
        href={obj.name}
        data-row-name={obj.name}
        class="group/masonry relative block w-full cursor-pointer overflow-hidden rounded-lg bg-muted shadow-sm transition-[translate,box-shadow] duration-250 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-8px_var(--masonry-glow)] [&:hover_img]:brightness-105"
        style={{ "--masonry-glow": `${getMainColor()}66` }}
        onContextMenu={() => selectForMenu(props.index)}
        on:click={(e: MouseEvent) => {
          e.preventDefault()
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          // a folder is entered; a file (an image too) opens over the folder
          openListed(obj, e.currentTarget as Element)
        }}
      >
        <Switch>
          {/* image: the image itself */}
          <Match when={isImage}>
            <ImageWithError
              class="block w-full object-cover transition-[filter] duration-250 ease-in-out"
              fallback={<CenterLoading size="lg" class="h-40 w-full" />}
              fallbackErr={
                <div class="flex justify-center items-center h-[160px]">
                  {typeIcon("48px")}
                </div>
              }
              src={obj.thumb || previewLink(obj)}
              loading="lazy"
            />
          </Match>

          {/* video with a thumbnail */}
          <Match when={kind === "video-thumb"}>
            <div class="relative w-full">
              <ImageWithError
                class="block w-full object-cover transition-[filter] duration-250 ease-in-out"
                fallback={<CenterLoading size="lg" class="h-40 w-full" />}
                fallbackErr={
                  <div class="flex justify-center items-center h-[160px]">
                    {typeIcon("48px")}
                  </div>
                }
                src={obj.thumb}
                loading="lazy"
              />
              <div class="flex justify-center items-center absolute top-0 left-0 right-0 bottom-0">
                <BsPlayCircleFill class="size-[44px] text-white opacity-[0.92] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
              </div>
            </div>
          </Match>

          {/* video without a thumbnail: a video skeleton placeholder */}
          <Match when={kind === "video-skeleton"}>
            <div class="relative aspect-video w-full">
              <Skeleton class="h-full w-full" />
              <div class="absolute top-0 right-0 bottom-0 left-0 flex items-center justify-center">
                <BsPlayCircleFill
                  class="size-[44px] opacity-80"
                  style={{ color: getMainColor() }}
                />
              </div>
            </div>
          </Match>

          {/* text: its actual content */}
          <Match when={kind === "text"}>
            <TextPreview obj={obj} />
          </Match>

          {/* folders & everything else: a clean icon card */}
          <Match when={true}>
            <div class="flex h-[140px] w-full items-center justify-center bg-linear-to-br from-muted to-accent">
              {typeIcon("52px")}
            </div>
          </Match>
        </Switch>

        {/* filename bar — always readable, brightens on hover */}
        <div
          class={cn(
            "masonry-overlay absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/70 to-black/0 px-2 py-1 transition-opacity duration-250 ease-in-out group-hover/masonry:opacity-100",
            masonryNameAlwaysVisible(obj) ? "opacity-95" : "opacity-0",
          )}
        >
          <p class="text-white line-clamp-1 text-xs leading-4" title={obj.name}>
            {obj.name}
          </p>
        </div>
      </LinkWithPush>
    </div>
  )
}

const MasonryLayout = (props: { images: StoreObj[] }) => {
  const t = useT()
  return (
    <div class="flex flex-col items-center w-full gap-y-2">
      <Show when={local["show_count_msg"] === "visible"}>
        <div class="w-full text-left pl-2">
          <p class="text-muted-foreground text-sm leading-5">
            {smartCountMsg()}
          </p>
        </div>
      </Show>
      <Show
        when={objStore.objs.length > 0}
        fallback={
          <div class="flex justify-center items-center w-full p-8 text-muted-foreground">
            {t("home.empty_folder")}
          </div>
        }
      >
        {/* Responsive CSS-column waterfall. Mobile-first: 2 → 6 columns. */}
        <div class="masonry-images w-full columns-2 gap-x-[0.6rem] min-[480px]:columns-3 md:columns-4 min-[1200px]:columns-5 min-[1600px]:columns-6">
          <For each={objStore.objs}>
            {(obj, i) => <MasonryItem obj={obj} index={i()} />}
          </For>
        </div>
      </Show>
    </div>
  )
}

export default MasonryLayout
