/** Per-card overrides a view can give the grid (the media poster wall uses them). */
export interface GridDecor {
  /** Poster image URL (2:3). */
  cover?: string
  /** Replaces the file name. */
  label?: string
  /** Replaces the size line (e.g. the year). */
  sub?: string
  /** Small badge on the poster's top-right corner (e.g. a rating). */
  badge?: string
  /** Several posters shown as one 2:3 mosaic (a collection); wins over `cover`. */
  mosaic?: string[]
  /** Small tag on the poster's bottom-left corner (e.g. "Collection"). */
  tag?: string
  /** No poster: draw a gradient 2:3 card with this title instead of the folder icon. */
  placeholder?: string
}
