export type Favorite = {
  id: number
  path: string
  name: string
  is_dir: boolean
  tag: string
  created_at: number
}

/** Pure: whether the given path is already in the favorites list. */
export const isFavorited = (favorites: Favorite[], path: string): boolean =>
  favorites.some((f) => f.path === path)

/**
 * Pure: sort favorites with directories first, then files, each group ordered
 * by name (case-insensitive, locale-aware). Returns a new array.
 */
export const sortFavorites = (favs: Favorite[]): Favorite[] =>
  [...favs].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
