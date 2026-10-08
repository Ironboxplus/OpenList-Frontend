import { createMemo } from "solid-js"
import type { GridDecor } from "~/features/files/grid-decor"
import { assetSrc, cardRating } from "~/features/media/logic"
import { cardFor } from "~/features/media/state"
import { objStore } from "~/store"
import type { StoreObj } from "~/types"
import { api } from "~/utils/config"
import GridLayout from "./Grid"

/**
 * The media poster wall: the grid, with each entry that has media info shown
 * as its poster, title, year and rating, and the rest (plain folders, loose
 * files) as ordinary icon cards after them. It reuses the grid completely, so
 * selection, virtualization and the context menu behave as in any grid.
 */
const decorate = (obj: StoreObj): GridDecor | undefined => {
  const card = cardFor(obj.name)
  if (!card || card.kind === "ignore") return undefined
  return {
    // A collection is a title card: its members are on the wall below it.
    cover:
      card.kind === "collection"
        ? undefined
        : assetSrc(card.poster_url, api) || undefined,
    label: card.title || undefined,
    sub: card.year ? String(card.year) : undefined,
    badge: cardRating(card.ratings)?.text,
  }
}

const PosterWall = () => {
  const order = createMemo(() => {
    const withInfo: number[] = []
    const rest: number[] = []
    objStore.objs.forEach((o, i) => (decorate(o) ? withInfo : rest).push(i))
    return [...withInfo, ...rest]
  })
  return <GridLayout poster order={order} decorate={decorate} />
}

export default PosterWall
