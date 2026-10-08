import { TbEdit, TbLock, TbMovie } from "solid-icons/tb"
import { createSignal, For, Show } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { useRouter, useT } from "~/hooks"
import { me } from "~/store"
import { UserMethods } from "~/types"
import { api } from "~/utils/config"
import { cn } from "~/utils/cn"
import { assetSrc, ratingBadges } from "./logic"
import { mediaFs, mediaPath, openMediaEditor } from "./state"
import type { MediaItem } from "./types"

const OVERVIEW_FOLD = 90

/** Poster, or a plain placeholder when there is none (or it fails to load). */
const Poster = (props: { item: MediaItem; class: string }) => {
  const t = useT()
  const [failed, setFailed] = createSignal(false)
  const src = () => assetSrc(props.item.poster_url, api)
  return (
    <div
      data-media-poster
      class={cn(
        "aspect-[2/3] shrink-0 overflow-hidden rounded-lg bg-muted shadow-md",
        props.class,
      )}
    >
      <Show
        when={src() && !failed()}
        fallback={
          <div
            data-media-poster-empty
            class="flex size-full items-center justify-center text-muted-foreground"
          >
            <TbMovie class="size-8" />
          </div>
        }
      >
        <img
          src={src()}
          alt={t("media.poster_alt", { title: props.item.title })}
          loading="lazy"
          class="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </Show>
    </div>
  )
}

export const MediaHeaderCard = (props: { item: MediaItem }) => {
  const t = useT()
  const [open, setOpen] = createSignal(false)
  const backdrop = () => assetSrc(props.item.backdrop_url, api)
  const isCollection = () => props.item.kind === "collection"
  const badges = () => ratingBadges(props.item.ratings)
  const overview = () => props.item.overview?.trim() ?? ""
  const admin = () => UserMethods.is_admin(me())
  const muted = () => (backdrop() ? "text-white/75" : "text-muted-foreground")
  return (
    <section
      data-media-header
      data-has-backdrop={backdrop() ? "" : undefined}
      class={cn(
        "relative w-full overflow-hidden rounded-xl border bg-card text-card-foreground",
        backdrop() && "text-white",
      )}
    >
      <Show when={backdrop()}>
        <img
          data-media-backdrop
          src={backdrop()}
          alt=""
          aria-hidden="true"
          class="absolute inset-0 size-full scale-110 object-cover blur-xl"
        />
        <div class="absolute inset-0 bg-black/60" />
      </Show>
      <div
        class={cn(
          "relative grid gap-x-4 gap-y-3 p-4 sm:p-6",
          isCollection() ? "grid-cols-1" : "grid-cols-[auto_1fr]",
        )}
      >
        <Show when={!isCollection()}>
          <Poster item={props.item} class="w-20 sm:row-span-2 sm:w-36" />
        </Show>
        <div class="flex min-w-0 flex-col gap-1.5">
          <div class="flex items-start gap-2">
            <h1 class="m-0 min-w-0 flex-1 text-lg font-semibold leading-tight sm:text-2xl">
              {props.item.title}
              <Show when={props.item.year}>
                <span class={cn("ml-2 text-base font-normal", muted())}>
                  {props.item.year}
                </span>
              </Show>
            </h1>
            <Show when={props.item.locked}>
              <TbLock class={cn("mt-1 size-4 shrink-0", muted())} />
            </Show>
            <Show when={admin()}>
              <button
                type="button"
                data-media-edit
                aria-label={t("media.edit")}
                title={t("media.edit")}
                onClick={() => openMediaEditor(mediaPath() ?? "")}
                class={cn(
                  focusRing,
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-transparent hover:bg-white/15",
                  backdrop()
                    ? "text-white"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <TbEdit class="size-4" />
              </button>
            </Show>
          </div>
          <Show
            when={
              props.item.original_title &&
              props.item.original_title !== props.item.title
            }
          >
            <div class={cn("truncate text-sm", muted())}>
              {props.item.original_title}
            </div>
          </Show>
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              data-media-kind
              class={cn(
                "rounded-md px-2 py-0.5 text-xs font-medium",
                backdrop()
                  ? "bg-white/20 text-white"
                  : "bg-primary/15 text-primary",
              )}
            >
              {t(`media.kind.${props.item.kind}`)}
            </span>
            <For each={props.item.genres?.slice(0, 4)}>
              {(g) => (
                <span
                  class={cn(
                    "rounded-md border px-2 py-0.5 text-xs",
                    backdrop() ? "border-white/30" : "border-border",
                  )}
                >
                  {g}
                </span>
              )}
            </For>
          </div>
          <Show when={badges().length > 0}>
            <div class="flex flex-wrap gap-1.5" data-media-ratings>
              <For each={badges()}>
                {(b) => (
                  <span
                    data-rating={b.key}
                    class={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                      backdrop() ? "bg-white/20" : "bg-muted",
                    )}
                  >
                    <span class={muted()}>{t(`media.rating.${b.key}`)}</span>
                    <span class="font-semibold">{b.text}</span>
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>
        <Show when={overview()}>
          <div
            class={cn(
              "min-w-0 text-sm leading-relaxed",
              isCollection()
                ? ""
                : "col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-2",
            )}
          >
            <p data-media-overview class={cn("m-0", !open() && "line-clamp-3")}>
              {overview()}
            </p>
            <Show when={overview().length > OVERVIEW_FOLD}>
              <button
                type="button"
                data-media-more
                onClick={() => setOpen(!open())}
                class={cn(
                  focusRing,
                  "mt-1 rounded bg-transparent p-0 text-xs font-medium",
                  backdrop() ? "text-white/90 underline" : "text-primary",
                )}
              >
                {open() ? t("media.collapse") : t("media.expand")}
              </button>
            </Show>
          </div>
        </Show>
      </div>
    </section>
  )
}

/** The detail card above the file list; nothing when there is no usable item. */
export const MediaHeader = () => {
  const { pathname } = useRouter()
  const item = () => {
    const it = mediaFs()?.item
    return it &&
      it.kind !== "ignore" &&
      it.kind !== "library" &&
      mediaPath() === pathname()
      ? it
      : undefined
  }
  return <Show when={item()}>{(it) => <MediaHeaderCard item={it()} />}</Show>
}
