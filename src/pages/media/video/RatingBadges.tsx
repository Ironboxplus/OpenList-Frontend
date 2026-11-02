import { For } from "solid-js"
import { useT } from "~/hooks"
import { ratingBadges } from "~/features/media/logic"

/**
 * Every rating source the backend has for a work, one chip each, in the fixed
 * order of ratingBadges (empty sources dropped). Nothing is rendered without a
 * source, so the caller falls back to the single `rating` itself.
 */
export const RatingBadges = (props: {
  ratings: Record<string, unknown> | undefined
}) => {
  const t = useT()
  return (
    <For each={ratingBadges(props.ratings)}>
      {(b) => (
        <span
          style={{
            background: "rgba(251,191,36,0.15)",
            border: "1px solid rgba(251,191,36,0.3)",
            "border-radius": "6px",
            padding: "3px 8px",
            color: "#fbbf24",
            "font-size": "14px",
            "font-weight": "600",
          }}
        >
          {t(`media.rating.${b.key}`)} {b.text}
        </span>
      )}
    </For>
  )
}
