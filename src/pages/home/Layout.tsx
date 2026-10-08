import { Markdown } from "~/components"
import { useTitle } from "~/hooks"
import { getSetting } from "~/store"
import { notify } from "~/utils"
import { Body } from "./Body"
import { Footer } from "./Footer"
import { Header } from "./header/Header"
import { Show } from "solid-js"
import { FilesTopLeft, FilesTopRight } from "~/features/files/FilesTopBar"
import { shellActive, useTopBarSlots } from "~/features/shell/topbar-slot"
import { Toolbar } from "./toolbar/Toolbar"

const Index = () => {
  useTitle(getSetting("site_title"))
  const announcement = getSetting("announcement")
  if (announcement) {
    notify.render(<Markdown children={announcement} />)
  }
  // Inside the shell the TopBar carries the breadcrumb, search and view
  // switch (account and site name live in the sidebar). Guests have no shell
  // and keep the classic header, which also holds their login entry.
  useTopBarSlots(() => ({
    left: (ctx) => <FilesTopLeft phone={ctx.phone} />,
    right: (ctx) => <FilesTopRight phone={ctx.phone} />,
  }))
  return (
    <>
      <Show when={!shellActive()}>
        <Header />
      </Show>
      <Toolbar />
      <Body />
      <Footer />
    </>
  )
}

export default Index
