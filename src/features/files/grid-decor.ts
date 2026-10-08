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
}
