import { Markdown } from "~/components"
import { useTitle } from "~/hooks"
import { getSetting } from "~/store"
import { notify } from "~/utils"
import { Body } from "./Body"
import { Footer } from "./Footer"
import { Header } from "./header/Header"
import { onMount, Show } from "solid-js"
import { FilesTopLeft, FilesTopRight } from "~/features/files/FilesTopBar"
import { useFilesLinkage } from "~/features/files/linkage"
import { PhoneBatchBar } from "~/features/files/PhoneActions"
import { selectionMode } from "~/features/files/selection-mode"
import {
  shellActive,
  useBottomBar,
  useTopBarSlots,
} from "~/features/shell/topbar-slot"
import { Toolbar } from "./toolbar/Toolbar"

const Index = () => {
  useTitle(getSetting("site_title"))
  // Guests have no shell and keep the toast; inside the shell the announcement
  // is a card at the top of the content (see AnnouncementCard).
  const announcement = getSetting("announcement")
  onMount(() => {
    if (announcement && !shellActive()) {
      notify.render(<Markdown children={announcement} />)
    }
  })
  // Inside the shell the TopBar carries the breadcrumb, search and view
  // switch (account and site name live in the sidebar). Guests have no shell
  // and keep the classic header, which also holds their login entry.
  useTopBarSlots(() => ({
    left: (ctx) => <FilesTopLeft phone={ctx.phone} />,
    right: (ctx) => <FilesTopRight phone={ctx.phone} />,
  }))
  // Refresh on finished transfers; scroll to ?highlight= files.
  useFilesLinkage()
  // On phones, selection mode swaps the tab bar for the batch actions.
  useBottomBar({
    when: selectionMode,
    render: () => <PhoneBatchBar />,
  })
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
