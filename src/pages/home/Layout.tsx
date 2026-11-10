import { Markdown } from "~/components"
import { useTitle } from "~/hooks"
import { getSetting, haveSelected, me } from "~/store"
import { UserMethods } from "~/types"
import { notify } from "~/utils"
import { Body } from "./Body"
import { Footer } from "./Footer"
import { Header } from "./header/Header"
import { onMount, Show } from "solid-js"
import {
  FilesToolbar,
  FilesTopLeft,
  FilesTopRight,
} from "~/features/files/FilesTopBar"
import { useFilesLinkage } from "~/features/files/linkage"
import { PhoneBatchBar } from "~/features/files/PhoneActions"
import { useRestoreSpot } from "~/features/files/restore-spot"
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
    // shellActive() is still false on first mount (the shell flips it in an
    // effect), so decide from who is signed in: only guests get the toast.
    if (announcement && UserMethods.is_guest(me())) {
      notify.render(<Markdown children={announcement} />)
    }
  })
  // Inside the shell the top bar carries the New menu (or the selection's
  // actions) and the toolbar row the breadcrumb with the view and sort
  // buttons. Guests have no shell and keep the classic header, which also
  // holds their login entry.
  useTopBarSlots(() => ({
    left: () => <FilesTopLeft />,
    right: () => <FilesTopRight />,
    toolbar: (ctx) => <FilesToolbar phone={ctx.phone} />,
    hideSearch: haveSelected(),
  }))
  // Refresh on finished transfers; scroll to ?highlight= files.
  useFilesLinkage()
  // Remember folder and scroll; coming back from another section restores them.
  useRestoreSpot()
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
