import { cn } from "~/utils/cn"
import type { JSX } from "solid-js"

// hope's Spinner sizes (docs/FE_HOPE_TOKEN_MAP.md)
const SIZE = {
  xs: "size-3",
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
  xl: "size-12",
}

/**
 * A ring with one coloured quarter, turning: hope's Spinner (2px ring by
 * default, 0.45s a turn). `color` is any CSS colour, the primary by default.
 */
export const Spinner = (props: {
  size?: keyof typeof SIZE
  /** CSS length of the ring, "2px" by default. */
  thickness?: string
  /** CSS time of a turn, "0.45s" by default. */
  speed?: string
  color?: string
  class?: string
  style?: JSX.CSSProperties
}) => (
  <span
    role="status"
    aria-label="loading"
    class={cn(
      "inline-block animate-spin rounded-full border-solid border-border",
      SIZE[props.size ?? "md"],
      props.class,
    )}
    style={{
      "border-width": props.thickness ?? "2px",
      "border-top-color": props.color ?? "var(--primary)",
      "animation-duration": props.speed ?? "0.45s",
      ...props.style,
    }}
  />
)
