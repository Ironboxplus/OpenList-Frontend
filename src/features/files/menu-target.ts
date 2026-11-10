// A row says "the context menu is for me" when it is right-clicked; the menu's
// trigger, which sees the same event afterwards, opens only if one did. (Rows
// are not all `.viselect-item`s, and a blank spot must not open the row menu.)
let pending = false

export const markMenuTarget = () => {
  pending = true
}

/** Whether a row claimed the event being handled; resets for the next one. */
export const takeMenuTarget = () => {
  const claimed = pending
  pending = false
  return claimed
}
