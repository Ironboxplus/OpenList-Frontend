import { Link } from "@solidjs/router"
import { createMemo, For, Show } from "solid-js"
import { usePath, useRouter, useT } from "~/hooks"
import { getSetting, local } from "~/store"
import { encodePath, joinBase } from "~/utils"

export const Nav = () => {
  const { pathname, isShare } = useRouter()
  const paths = createMemo(() => {
    if (!isShare()) {
      return ["", ...pathname().split("/").filter(Boolean)]
    } else {
      const p = pathname().split("/").filter(Boolean)
      return [`@s/${p[1] ?? ""}`, ...p.slice(2)]
    }
  })
  const t = useT()
  const { setPathAs } = usePath()

  // The sticky modes put a mask behind the bar, as wide as the window, so what
  // scrolls under it does not show at its sides.
  const sticky = () => local["position_of_header_navbar"]
  const stickyBar = () =>
    sticky() === "only_navbar_sticky" || sticky() === "sticky"

  return (
    <nav
      aria-label="breadcrumb"
      class="nav block w-full bg-canvas text-base leading-6"
      classList={{
        "sticky z-[1100] after:absolute after:top-0 after:left-1/2 after:-z-1 after:h-full after:w-[99vw] after:-translate-x-1/2 after:bg-canvas after:content-['']":
          stickyBar(),
        "top-0": sticky() === "only_navbar_sticky",
        "top-[60px]": sticky() === "sticky",
      }}
    >
      <ol class="m-0 flex list-none items-center gap-x-2 p-0">
        <For each={paths()}>
          {(name, i) => {
            const isLast = createMemo(() => i() === paths().length - 1)
            const path = paths()
              .slice(0, i() + 1)
              .join("/")
            const href = encodePath(path)
            let text = () => name
            if (!isShare() && text() === "") {
              text = () => getSetting("home_icon") + t("manage.sidemenu.home")
            } else if (isShare() && i() === 0) {
              text = () =>
                getSetting("share_icon") + t("manage.sidemenu.shares")
            }
            return (
              <li class="nav-item inline-flex items-center gap-x-2">
                <Show
                  when={!isLast()}
                  fallback={
                    <span
                      aria-current="page"
                      class="nav-link relative inline-flex cursor-default items-center rounded-lg p-1 break-all outline-none"
                    >
                      {text()}
                    </span>
                  }
                >
                  <Link
                    class="nav-link relative inline-flex cursor-pointer items-center rounded-lg p-1 break-all no-underline outline-none transition-[color,text-decoration] duration-250 hover:bg-accent active:scale-95"
                    href={joinBase(href)}
                    onMouseEnter={() => setPathAs(path)}
                  >
                    {text()}
                  </Link>
                  <span
                    aria-hidden="true"
                    class="nav-separator inline-flex items-center justify-center"
                  >
                    /
                  </span>
                </Show>
              </li>
            )
          }}
        </For>
      </ol>
    </nav>
  )
}
