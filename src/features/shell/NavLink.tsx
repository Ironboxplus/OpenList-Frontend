import type { JSX } from "solid-js"
import { useRouter } from "~/hooks"
import { joinBase } from "~/utils/path"
import { currentSpot, goingTo, resolveNavPath } from "./files-memory"

/** Anchor that navigates through the app router but keeps real-link semantics. */
export const NavLink = (
  props: Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    path: string
  },
) => {
  const { to, pathname } = useRouter()
  return (
    <a
      {...props}
      href={joinBase(resolveNavPath(props.path, pathname(), currentSpot()))}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        to(goingTo(props.path, pathname()))
      }}
    />
  )
}
