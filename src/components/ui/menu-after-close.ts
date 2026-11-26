// A menu item that closes its menu acts once the menu has closed.
//
// Kobalte's root menu content traps focus while it is open and, when it
// unmounts, calls `onCloseAutoFocus` (focus-scope, `setTimeout(0)`). An action
// that opens a modal from inside `onSelect` starts the modal's own focus trap
// while the menu's is still alive; the two pull focus back and forth through
// each other's focusin handlers until the stack overflows and the page freezes.
// Radix and Kobalte recommend the same order for "open a dialog from a menu":
// remember the choice on select, act in the content's `onCloseAutoFocus` and
// prevent its default there. The menu's trap is gone by then, so the dialog's
// own trap takes focus without a fight.
//
// Deviation from Radix (2026-11-26): Kobalte's DropdownMenu.Content focuses
// its trigger in onCloseAutoFocus whether or not the default was prevented
// (@kobalte/core 0.13.14, dist/chunk/VPR4IPXB.js 38-45; Radix skips it). So
// after a dropdown item the trigger has focus for a moment before the dialog
// takes it; the context menu (RVJUZJKY.js 42-48) and the focus scope honour
// the prevented default and leave focus to the dialog.
//
// The choice belongs to one root content (items in its submenus included,
// since choosing one closes the whole menu): each content holds at most one
// and drops it when it opens again. A content held open by a controlled `open`
// keeps its trap, so its item's action waits until it really closes.
import { createContext, useContext } from "solid-js"

export type MenuCloseQueue = {
  /** Called by an item that closes the menu: run `action` once it has closed. */
  defer: (action: () => void) => void
}

export const MenuCloseContext = createContext<MenuCloseQueue>()

/** The queue of the root menu content around the caller, if any. */
export const useMenuCloseQueue = () => useContext(MenuCloseContext)

type AutoFocusHandlers = {
  onOpenAutoFocus?: (e: Event) => void
  onCloseAutoFocus?: (e: Event) => void
}

/**
 * For a root menu content: its queue (to provide to its items) and its
 * auto-focus handlers, which wrap the caller's own.
 */
export const createMenuCloseQueue = (own: AutoFocusHandlers) => {
  let pending: (() => void) | undefined
  const queue: MenuCloseQueue = {
    defer: (action) => {
      pending = action
    },
  }
  return {
    queue,
    onOpenAutoFocus: (e: Event) => {
      pending = undefined
      own.onOpenAutoFocus?.(e)
    },
    onCloseAutoFocus: (e: Event) => {
      own.onCloseAutoFocus?.(e)
      const action = pending
      pending = undefined
      if (!action) return
      e.preventDefault()
      // after the focus scope has left Kobalte's stack
      queueMicrotask(action)
    },
  }
}
