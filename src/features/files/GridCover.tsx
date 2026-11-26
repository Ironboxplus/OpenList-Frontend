import { createSignal, type JSX, Show } from "solid-js"

/**
 * 2:3 poster for a grid card. Lazy-loaded; when the image fails the caller's
 * fallback (the file icon) is drawn in the same 2:3 frame, so the card keeps
 * its height whether or not the image could be loaded. Nothing here knows
 * where the URL comes from.
 */
export const GridCover = (props: {
  src?: string
  fallback: JSX.Element
  alt?: string
}) => {
  const [failed, setFailed] = createSignal(false)
  return (
    <Show when={props.src} fallback={props.fallback}>
      <div
        data-grid-cover
        data-failed={failed() ? "" : undefined}
        class="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg bg-muted"
      >
        <Show when={!failed()} fallback={props.fallback}>
          <img
            src={props.src}
            alt={props.alt ?? ""}
            loading="lazy"
            class="size-full object-cover"
            onError={() => setFailed(true)}
          />
        </Show>
      </div>
    </Show>
  )
}
