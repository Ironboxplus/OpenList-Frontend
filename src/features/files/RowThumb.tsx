import { createSignal, type JSX, Show } from "solid-js"
import type { StoreObj } from "~/types"

/**
 * A list row's leading picture: the small thumbnail of an image or video, or
 * the caller's type icon when the file has none (or it fails to load).
 */
export const RowThumb = (props: {
  obj: StoreObj
  fallback: JSX.Element
  onClick?: (e: MouseEvent) => void
}) => {
  const [failed, setFailed] = createSignal(false)
  return (
    <Show when={props.obj.thumb && !failed()} fallback={props.fallback}>
      <img
        src={props.obj.thumb}
        alt=""
        loading="lazy"
        draggable={false}
        class="mr-1 size-7 shrink-0 rounded-md bg-muted object-cover"
        style={{ cursor: props.onClick ? "pointer" : undefined }}
        on:click={(e: MouseEvent) => props.onClick?.(e)}
        onError={() => setFailed(true)}
      />
    </Show>
  )
}
