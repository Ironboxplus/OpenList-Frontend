import { createMemo } from "solid-js"
import { haveSelected, selectAll } from "~/store"
import { phoneShell } from "../shell/topbar-slot"

/**
 * Phone selection mode: entered by long-pressing a row, left by cancelling or
 * deselecting everything. The store's per-item `selected` flag stays the single
 * source of truth, so batch actions, select-all and the context menu keep
 * working unchanged; "in the mode" is simply "on a phone with a selection".
 */
export const selectionMode = createMemo(() => phoneShell() && haveSelected())

export const cancelSelection = () => selectAll(false)
