// A menu item's action runs after its menu has closed and handed focus back.
//
// Kobalte's menu content traps focus while it is open and, when it unmounts,
// restores focus in `onCloseAutoFocus` (focus-scope, `setTimeout(0)`). An action
// that opens a modal from inside `onSelect` starts the modal's own focus trap
// while the menu's is still alive; the two pull focus back and forth through
// each other's focusin handlers until the stack overflows and the page freezes.
// Radix and Kobalte's docs recommend the same order: remember the choice on
// select, act once the content has closed (their "open a dialog from a menu"
// pattern).
let pending: (() => void) | undefined

/** Called by the menu items: run `action` once the menu content has closed. */
export const afterMenuClose = (action: () => void) => {
  pending = action
}

/** Called by the menu contents from `onCloseAutoFocus`, after focus is restored. */
export const runAfterMenuClose = () => {
  const action = pending
  pending = undefined
  if (action) queueMicrotask(action)
}
