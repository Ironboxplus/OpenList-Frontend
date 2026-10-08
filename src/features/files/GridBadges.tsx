import { TbCheck } from "solid-icons/tb"
import { Show } from "solid-js"
import { cn } from "~/utils/cn"
import { nameHue } from "../media/logic"

// These live in features/ because Tailwind only scans features/ and
// components/ui: classes written in pages/ would not be generated.

/** Round check in the corner of a grid card while selecting on a phone. */
export const SelectCheck = (props: { selected?: boolean }) => (
  <span
    data-row-check
    class={cn(
      "absolute left-1 top-1 z-10 inline-flex size-6 items-center justify-center rounded-full border-2",
      props.selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-white/80 bg-black/20",
    )}
  >
    <Show when={props.selected}>
      <TbCheck class="size-4" />
    </Show>
  </span>
)

/** Small label on a poster's top-right corner (a rating). */
export const CardBadge = (props: { text: string }) => (
  <span
    data-card-rating
    class="absolute right-1 top-1 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-amber-300"
  >
    {props.text}
  </span>
)

/** 2:3 stand-in for a folder without a poster: a gradient per name, with the cleaned title. */
export const PosterPlaceholder = (props: { title: string; seed: string }) => (
  <div
    data-poster-placeholder
    class="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg p-2 text-center text-sm font-medium text-white shadow-md"
    style={{
      background: `linear-gradient(160deg, hsl(${nameHue(props.seed)} 55% 42%), hsl(${(nameHue(props.seed) + 40) % 360} 60% 26%))`,
    }}
  >
    <span class="line-clamp-4 break-words">{props.title}</span>
  </div>
)

/** Small label on a poster's bottom-left corner (the collection tag). */
export const CardTag = (props: { text: string }) => (
  <span
    data-card-tag
    class="absolute bottom-1 left-1 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white"
  >
    {props.text}
  </span>
)

/**
 * 2:3 mosaic of up to four posters: one fills the card, two or three split it
 * (two side by side, three as a tall one plus two stacked), four make a 2x2.
 */
export const PosterMosaic = (props: { urls: string[] }) => {
  const urls = () => props.urls.slice(0, 4)
  const cell = (u: string, extra = "") => (
    <img
      src={u}
      alt=""
      loading="lazy"
      class={cn("size-full object-cover", extra)}
    />
  )
  return (
    <div
      data-poster-mosaic
      data-count={urls().length}
      class="grid aspect-[2/3] w-full gap-px overflow-hidden rounded-lg bg-muted"
      classList={{
        "grid-cols-1": urls().length === 1,
        "grid-cols-2": urls().length > 1,
        "grid-rows-2": urls().length > 2,
      }}
    >
      {urls().map((u, i) => (
        <div
          class={cn(
            "min-h-0 overflow-hidden",
            urls().length === 3 && i === 0 && "row-span-2",
          )}
        >
          {cell(u)}
        </div>
      ))}
    </div>
  )
}
