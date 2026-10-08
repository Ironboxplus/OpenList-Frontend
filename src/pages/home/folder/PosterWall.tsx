import { createMemo } from "solid-js"
import type { GridDecor } from "~/features/files/grid-decor"
import { assetSrc, cardRating, cleanTitle } from "~/features/media/logic"
import { cardFor, isLibrary } from "~/features/media/state"
import { objStore } from "~/store"
import type { StoreObj } from "~/types"
import type { MediaCard } from "~/features/media/types"
import { useT } from "~/hooks"
import { api } from "~/utils/config"
import GridLayout from "./Grid"

/** A collection has no poster of its own: its members' posters, or a placeholder. */
const collectionArt = (card: MediaCard, tag: string): Partial<GridDecor> => {
  const posters = (card.child_posters ?? [])
    .map((u) => assetSrc(u, api))
    .filter(Boolean)
  return posters.length
    ? { mosaic: posters.slice(0, 4), tag }
    : { placeholder: card.title || cleanTitle(card.path), tag }
}

const makeDecorate =
  (collectionTag: string) =>
  (obj: StoreObj): GridDecor | undefined => {
    const card = cardFor(obj.name)
    if (!card || card.kind === "ignore") {
      // In a library the folders still waiting for media info get a placeholder
      // poster, so the wall stays uniform.
      return isLibrary() && obj.is_dir
        ? { placeholder: cleanTitle(obj.name) }
        : undefined
    }
    return {
      // A collection is a title card: its members are on the wall below it.
      cover:
        card.kind === "collection"
          ? undefined
          : assetSrc(card.poster_url, api) || undefined,
      ...(card.kind === "collection" ? collectionArt(card, collectionTag) : {}),
      label: card.title || undefined,
      sub: card.year ? String(card.year) : undefined,
      badge: cardRating(card.ratings)?.text,
    }
  }

/**
 * The media poster wall: the grid, with each entry that has media info shown
 * as its poster, title, year and rating, and the rest (plain folders, loose
 * files) as ordinary icon cards after them. It reuses the grid completely, so
 * selection, virtualization and the context menu behave as in any grid.
 */
const PosterWall = () => {
  const t = useT()
  const decorate = makeDecorate(t("media.kind.collection"))
  const order = createMemo(() => {
    const withInfo: number[] = []
    const rest: number[] = []
    objStore.objs.forEach((o, i) =>
      (cardFor(o.name)?.kind && cardFor(o.name)!.kind !== "ignore"
        ? withInfo
        : rest
      ).push(i),
    )
    return [...withInfo, ...rest]
  })
  return <GridLayout poster order={order} decorate={decorate} />
}

export default PosterWall
