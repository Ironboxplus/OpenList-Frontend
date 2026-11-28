import {
  type ComponentProps,
  createSignal,
  JSXElement,
  Show,
  splitProps,
} from "solid-js"

/**
 * An <img> that shows `fallbackErr` when it fails to load and, with no `loading`
 * attribute, `fallback` until it has loaded (hope's Image did the same: with
 * `loading` set it drew the image at once and ignored the placeholder).
 */
export const ImageWithError = (
  props: ComponentProps<"img"> & {
    fallback?: JSXElement
    fallbackErr?: JSXElement
  },
) => {
  const [local, img] = splitProps(props, [
    "fallback",
    "fallbackErr",
    "onError",
    "onLoad",
  ])
  const [err, setErr] = createSignal(false)
  const [loaded, setLoaded] = createSignal(false)
  const waiting = () =>
    local.fallback !== undefined && img.loading == null && !loaded()
  return (
    <Show when={!err()} fallback={local.fallbackErr}>
      <Show when={waiting()}>{local.fallback}</Show>
      <img
        {...img}
        classList={{ ...img.classList, hidden: waiting() }}
        onLoad={(e) => {
          setLoaded(true)
          if (typeof local.onLoad === "function") local.onLoad(e)
        }}
        onError={(e) => {
          setErr(true)
          if (typeof local.onError === "function") local.onError(e)
        }}
      />
    </Show>
  )
}
