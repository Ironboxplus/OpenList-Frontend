import { Show } from "solid-js"
import { CardBadge, CardTag, PosterPlaceholder } from "../files/GridBadges"
import { PosterArt } from "../files/PosterArt"
import { NavLink } from "../shell/NavLink"
import { focusRing } from "~/components/ui/focus"
import { cn } from "~/utils/cn"
import { cardDecor, cleanTitle } from "./logic"
import type { MediaCard } from "./types"

/**
 * A poster card for one scraped item, linking to its folder in Files (where
 * the media detail lives). It only needs the card; the file grid draws its
 * posters from the same `cardDecor` and `PosterArt`.
 */
export const MediaPosterCard = (props: {
  card: MediaCard
  /** Shown on a collection's poster (translated by the caller). */
  collectionTag: string
  apiBase: string
}) => {
  const decor = () => cardDecor(props.card, props.collectionTag, props.apiBase)
  const title = () => props.card.title || cleanTitle(props.card.path)
  return (
    <NavLink
      path={props.card.path}
      data-testid="library-card"
      data-kind={props.card.kind}
      title={title()}
      class={cn(
        focusRing,
        "flex min-w-0 flex-col gap-1 rounded-lg p-1 text-foreground no-underline transition-transform hover:scale-[1.04]",
      )}
    >
      <div class="relative">
        <Show when={decor().badge}>
          {(text) => <CardBadge text={text()} />}
        </Show>
        <Show when={decor().tag}>{(text) => <CardTag text={text()} />}</Show>
        <PosterArt
          decor={decor()}
          seed={props.card.path}
          alt={title()}
          fallback={
            <PosterPlaceholder title={title()} seed={props.card.path} />
          }
        />
      </div>
      <span class="truncate text-center text-sm">{title()}</span>
      <Show when={decor().sub}>
        {(year) => (
          <span class="text-center text-xs text-muted-foreground">
            {year()}
          </span>
        )}
      </Show>
    </NavLink>
  )
}
