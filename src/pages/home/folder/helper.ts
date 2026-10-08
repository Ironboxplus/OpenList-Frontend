import { Checkbox, hope } from "@hope-ui/solid"
import { batch, createEffect, onCleanup } from "solid-js"
import { useContextMenu } from "solid-contextmenu"
import SelectionArea from "@viselect/vanilla"
import {
  checkboxOpen,
  haveSelected,
  local,
  objStore,
  oneChecked,
  selectAll,
  selectedObjs,
  selectIndex,
} from "~/store"
import { usePath, useRouter } from "~/hooks"
import { isMobile } from "~/utils/compatibility"
import { createLongPress } from "~/utils/touch"
import { selectionMode } from "~/features/files/selection-mode"
import { phoneShell } from "~/features/shell/topbar-slot"
import { StoreObj } from "~/types"

let selectedCache: StoreObj[] | null = null

export function useSelectWithMouse() {
  const isMouseSupported = () => !isMobile && checkboxOpen()
  const openWithDoubleClick = () =>
    isMouseSupported() && local["open_item_on_checkbox"] === "dblclick"
  const toggleWithClick = () =>
    isMouseSupported() &&
    local["open_item_on_checkbox"] === "disable_while_checked" &&
    haveSelected()

  const saveSelectionCache = () => {
    selectedCache = selectedObjs()
  }

  const restoreSelectionCache = () => {
    if (selectedCache === null) return false
    for (let i = 0; i < objStore.objs.length; ++i) {
      selectIndex(i, selectedCache.indexOf(objStore.objs[i]) >= 0)
    }
    return true
  }

  const clearSelectionCache = () => {
    selectedCache = null
  }

  const registerSelectContainer = () => {
    createEffect(() => {
      if (!isMouseSupported()) {
        const area = document.querySelector(".viselect-container")
        area?.addEventListener("mousedown", saveSelectionCache)
        onCleanup(() =>
          area?.removeEventListener("mousedown", saveSelectionCache),
        )
        return
      }
      const selection = new SelectionArea({
        selectionAreaClass: "viselect-selection-area",
        startAreas: [".viselect-container"],
        boundaries: [".viselect-container"],
        selectables: [".viselect-item"],
      })
      selection.on("beforestart", () => {
        saveSelectionCache()
        selection.clearSelection(true, true)
        selection.select(".viselect-item.selected", true)
      })
      selection.on("start", ({ event }) => {
        const ev = event as MouseEvent
        if (ev.type === "mousemove") {
          clearSelectionCache()
        }
        if (!ev.shiftKey && !ev.ctrlKey && !ev.metaKey) {
          selectAll(false)
          selection.clearSelection(true)
        }
      })
      selection.on(
        "move",
        ({
          store: {
            changed: { added, removed },
          },
        }) => {
          for (const el of added) {
            selectIndex(Number(el.getAttribute("data-index")), true)
          }
          for (const el of removed) {
            selectIndex(Number(el.getAttribute("data-index")), false)
          }
        },
      )
      onCleanup(() => selection.destroy())
    })
  }

  const { show } = useContextMenu({ id: 1 })

  const captureContentMenu = (e: MouseEvent) => {
    e.preventDefault()

    if (haveSelected() && !oneChecked()) {
      const $target = e.target as Element
      const $selectedItem = $target.closest(".viselect-item")
      const index = Number($selectedItem?.getAttribute("data-index"))

      const isClickOnContainer = Number.isNaN(index)
      const isClickOnSelectedItems = () => !!objStore.objs[index].selected
      if (isClickOnContainer || !isClickOnSelectedItems()) return

      e.stopPropagation()
      show(e, { props: objStore.obj })
    }
  }

  return {
    isMouseSupported,
    openWithDoubleClick,
    toggleWithClick,
    restoreSelectionCache,
    registerSelectContainer,
    captureContentMenu,
  }
}

/**
 * Row behaviour shared by every file-list row, regardless of how it looks.
 *
 * `ListItem` (table row) and `MediaListItem` (two-line media row) differ only in
 * presentation; selection, open-on-click vs open-on-dblclick, modifier-key
 * handling, the context menu and path prefetch are identical. Keeping them here
 * means a change to "how clicking a row behaves" is one edit, not two that must
 * stay in sync (REFACTOR_PLAN §3 principle 8, §7.13).
 *
 * Returns handlers rather than a spreadable props object on purpose: Solid's
 * `on:click` / `on:dblclick` are compile-time namespaced directives and do not
 * work when spread from an object, so the row must bind them literally.
 */
export function useFileRowInteraction(
  obj: () => StoreObj,
  index: () => number,
) {
  const { setPathAs } = usePath()
  const { pushHref, to } = useRouter()
  const { show } = useContextMenu({ id: 1 })
  const { openWithDoubleClick, toggleWithClick, restoreSelectionCache } =
    useSelectWithMouse()

  /** Rows are links, so the pointer only becomes a hand when a click navigates. */
  const cursor = () =>
    openWithDoubleClick() || toggleWithClick() ? "default" : "pointer"

  const onDblClick = () => {
    if (!openWithDoubleClick()) return
    selectIndex(index(), true, true)
    to(pushHref(obj().name))
  }

  // Phone selection mode: a long press selects the row, after which taps
  // toggle rows instead of opening them.
  const press = createLongPress(() => {
    if (!phoneShell()) return
    if (!obj().selected) selectIndex(index(), true)
  })

  const onClick = (e: MouseEvent) => {
    // The row renders as an anchor for middle-click / copy-link / a11y, but
    // in-app navigation goes through the router instead of a full page load.
    e.preventDefault()
    if (phoneShell()) {
      if (press.consumeClick()) return
      if (selectionMode()) return selectIndex(index(), !obj().selected)
    }
    if (openWithDoubleClick()) return
    // Let the browser/selection layer own modifier-clicks.
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    if (!restoreSelectionCache()) return
    if (toggleWithClick()) return selectIndex(index(), !obj().selected)
    to(pushHref(obj().name))
  }

  /** Warms the path store so the next view has its parent context already. */
  const onMouseEnter = () => setPathAs(obj().name, obj().is_dir, true)

  const onContextMenu = (e: MouseEvent) => {
    // On phones the long press is the selection gesture, not a menu.
    if (phoneShell()) return e.preventDefault()
    batch(() => {
      selectIndex(index(), true, true)
    })
    show(e, { props: obj() })
  }

  const onCheckboxChange = (e: any) => selectIndex(index(), e.target.checked)

  /** Checkbox clicks must not bubble into the row's navigate-on-click. */
  const stopPropagation = (e: MouseEvent) => e.stopPropagation()

  return {
    cursor,
    onClick,
    onDblClick,
    onMouseEnter,
    onContextMenu,
    onPointerDown: press.onPointerDown,
    onPointerMove: press.onPointerMove,
    onPointerEnd: press.onPointerEnd,
    onCheckboxChange,
    stopPropagation,
    /**
     * Exposed for row-specific affordances that also need to settle the pending
     * drag-selection first (e.g. the table row's image-icon opens the gallery
     * rather than navigating).
     */
    restoreSelectionCache,
  }
}

export const ItemCheckbox = hope(Checkbox, {
  baseStyle: {
    // expand the range of click
    _before: {
      content: "",
      pos: "absolute",
      top: -10,
      right: -2,
      bottom: -10,
      left: -10,
    },
  },
})
