import { TbCircle, TbCircleCheckFilled } from "solid-icons/tb"
import { createSignal, type JSX, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import type { StoreObj } from "~/types"
import { getIconByObj } from "~/utils/icon"

/**
 * The type icon of a card; while selecting (and for a selected card) a check
 * takes its place, as in Cloudreve.
 */
const CardIcon = (props: {
  obj: StoreObj
  selected?: boolean
  selecting?: boolean
}) => (
  <Show
    when={props.selected}
    fallback={
      <Show
        when={props.selecting}
        fallback={
          <Dynamic
            component={getIconByObj(props.obj)}
            class={
              props.obj.is_dir
                ? "size-5 shrink-0 text-muted-foreground"
                : "size-5 shrink-0 text-primary"
            }
          />
        }
      >
        <TbCircle class="size-5 shrink-0 text-muted-foreground" />
      </Show>
    }
  >
    <TbCircleCheckFilled class="size-5 shrink-0 text-primary" />
  </Show>
)

/** Name row of a card. `checkbox` (given in the classic checkbox mode) replaces the icon. */
const CardHead = (props: {
  obj: StoreObj
  selected?: boolean
  selecting?: boolean
  checkbox?: () => JSX.Element
  extra?: JSX.Element
}) => (
  <div class="flex min-h-8 w-full min-w-0 items-center gap-2 px-1">
    <Show
      when={props.checkbox}
      fallback={
        <CardIcon
          obj={props.obj}
          selected={props.selected}
          selecting={props.selecting}
        />
      }
    >
      {props.checkbox!()}
    </Show>
    <span
      class="name min-w-0 flex-1 truncate text-left text-sm"
      title={props.obj.name}
    >
      {props.obj.name}
    </span>
    {props.extra}
  </div>
)

/** A folder: a flat chip with its icon and name. */
export const FolderChip = (props: {
  obj: StoreObj
  selected?: boolean
  selecting?: boolean
  checkbox?: () => JSX.Element
  extra?: JSX.Element
}) => <CardHead {...props} />

/** The picture of a file card: its thumbnail, or the type icon when it has none. */
const CardThumb = (props: { obj: StoreObj }) => {
  const [failed, setFailed] = createSignal(false)
  return (
    <Show
      when={props.obj.thumb && !failed()}
      fallback={
        <div class="flex size-full items-center justify-center text-muted-foreground/40">
          <Dynamic component={getIconByObj(props.obj)} class="size-14" />
        </div>
      }
    >
      <img
        src={props.obj.thumb}
        alt=""
        loading="lazy"
        draggable={false}
        class="size-full object-cover"
        onError={() => setFailed(true)}
      />
    </Show>
  )
}

/** A file: the name row over its thumbnail. `onThumbClick` lets images open the gallery. */
export const FileCard = (props: {
  obj: StoreObj
  selected?: boolean
  selecting?: boolean
  checkbox?: () => JSX.Element
  extra?: JSX.Element
  onThumbClick?: (e: MouseEvent) => void
}) => (
  <>
    <CardHead {...props} />
    <div
      data-card-thumb
      class="aspect-[5/4] w-full overflow-hidden rounded-lg bg-background"
      style={{ cursor: props.onThumbClick ? "pointer" : undefined }}
      on:click={(e: MouseEvent) => props.onThumbClick?.(e)}
    >
      <CardThumb obj={props.obj} />
    </div>
  </>
)
