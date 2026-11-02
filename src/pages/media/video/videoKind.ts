/** Label of a video_type (movie, tv, anime, collection); anything else prints as is. */
export const videoKindLabel = (
  t: (key: string) => string,
  kind: string | undefined,
): string => {
  switch (kind) {
    case "movie":
    case "tv":
    case "anime":
    case "collection":
      return t(`media.kind.${kind}`)
    default:
      return kind ?? ""
  }
}
