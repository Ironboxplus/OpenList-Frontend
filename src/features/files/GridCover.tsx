import { createSignal, type JSX, Show } from "solid-js"

/**
 * 2:3 poster for a grid card. Lazy-loaded; when the image fails the caller's
 * fallback (the file icon) takes its place. Nothing here knows where the URL
 * comes from: the media API is wired in a later batch.
 */
export const GridCover = (props: {
  src?: string
  fallback: JSX.Element
  alt?: string
}) => {
  const [failed, setFailed] = createSignal(false)
  return (
    <Show when={props.src && !failed()} fallback={props.fallback}>
      <div
        data-grid-cover
        class="aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted"
      >
        <img
          src={props.src}
          alt={props.alt ?? ""}
          loading="lazy"
          class="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    </Show>
  )
}
