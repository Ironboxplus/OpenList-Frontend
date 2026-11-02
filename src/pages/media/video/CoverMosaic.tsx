import { For } from "solid-js"

/**
 * A collection has no poster of its own: its members' covers make a 2x2 mosaic
 * (child_posters, at most four, already signed urls from the backend).
 */
export const CoverMosaic = (props: {
  urls: readonly string[]
  width: string
  height: string
  radius?: string
}) => (
  <div
    style={{
      display: "grid",
      "grid-template-columns": "1fr 1fr",
      "grid-template-rows": "1fr 1fr",
      gap: "2px",
      width: props.width,
      height: props.height,
      overflow: "hidden",
      "border-radius": props.radius ?? "12px",
      "box-shadow": "0 20px 60px rgba(0,0,0,0.5)",
    }}
  >
    <For each={props.urls.slice(0, 4)}>
      {(u) => (
        <img
          src={u}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", "object-fit": "cover" }}
        />
      )}
    </For>
  </div>
)
