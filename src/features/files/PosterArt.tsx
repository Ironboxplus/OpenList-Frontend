import { type JSX, Show } from "solid-js"
import type { GridDecor } from "./grid-decor"
import { PosterMosaic, PosterPlaceholder } from "./GridBadges"
import { GridCover } from "./GridCover"

/**
 * The picture of a poster card, by what the decor has: a mosaic of posters,
 * else the cover (the icon in `fallback` if it fails to load), else a drawn
 * placeholder titled `placeholder`, else `fallback` alone. Shared by the file
 * grid and the media library so both draw a poster the same way.
 */
export const PosterArt = (props: {
  decor?: GridDecor
  /** Overrides `decor.cover` (the grid's own cover prop). */
  cover?: string
  /** Colours the placeholder; a name that stays the same for the card. */
  seed: string
  alt: string
  fallback: JSX.Element
}) => {
  const cover = () => props.cover ?? props.decor?.cover
  return (
    <Show
      when={props.decor?.mosaic?.length}
      fallback={
        <Show
          when={cover()}
          fallback={
            <Show when={props.decor?.placeholder} fallback={props.fallback}>
              <PosterPlaceholder
                title={props.decor!.placeholder!}
                seed={props.seed}
              />
            </Show>
          }
        >
          <GridCover src={cover()} fallback={props.fallback} alt={props.alt} />
        </Show>
      }
    >
      <PosterMosaic urls={props.decor!.mosaic!} />
    </Show>
  )
}
