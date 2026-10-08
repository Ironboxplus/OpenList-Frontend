import type { JSX } from "solid-js"
import { useRouter } from "~/hooks"
import { joinBase } from "~/utils/path"

/** Anchor that navigates through the app router but keeps real-link semantics. */
export const NavLink = (
  props: Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    path: string
  },
) => {
  const { to } = useRouter()
  return (
    <a
      {...props}
      href={joinBase(props.path)}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        to(props.path)
      }}
    />
  )
}
