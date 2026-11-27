// A figure that counts to its new value (plan §P4: dashboard numbers), with
// what is around the number (a unit, an arrow) left as it is. When the words
// around it change, or there is no number, the new text shows at once.
import { createEffect, createSignal, on, onCleanup } from "solid-js"
import { countTo, MotionTokens } from "~/platform/motion"
import { cn } from "~/utils/cn"

export interface SplitNumber {
  prefix: string
  value: number
  decimals: number
  suffix: string
}

/** The first number in `text` and what is before and after it. */
export const splitNumber = (text: string): SplitNumber | null => {
  const m = /^(.*?)(-?\d[\d,]*(?:\.(\d+))?)(.*)$/s.exec(text)
  if (!m) return null
  const value = Number(m[2].replace(/,/g, ""))
  if (!Number.isFinite(value)) return null
  return { prefix: m[1], value, decimals: m[3]?.length ?? 0, suffix: m[4] }
}

const format = (v: number, decimals: number, grouped: boolean) =>
  grouped
    ? v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : v.toFixed(decimals)

export const AnimatedNumber = (props: {
  value: string | number
  class?: string
}) => {
  const text = () => String(props.value)
  const [shown, setShown] = createSignal(text())
  /** The number on screen now, also partway through a count. */
  let current: number | undefined
  let stop: (() => void) | undefined
  createEffect(
    on(text, (next, prev) => {
      stop?.()
      const to = splitNumber(next)
      const was = prev === undefined ? null : splitNumber(prev)
      if (!to || !was || to.prefix !== was.prefix || to.suffix !== was.suffix) {
        setShown(next)
        current = to?.value
        return
      }
      const grouped = /\d,\d/.test(next)
      stop = countTo(
        current ?? was.value,
        to.value,
        (v) => {
          current = v
          setShown(to.prefix + format(v, to.decimals, grouped) + to.suffix)
        },
        MotionTokens.options.count,
        () => {
          current = to.value
          setShown(next)
        },
      )
    }),
  )
  onCleanup(() => stop?.())
  return <span class={cn("tabular-nums", props.class)}>{shown()}</span>
}
