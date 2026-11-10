import { TbArrowsSort } from "solid-icons/tb"
import { createMemo } from "solid-js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { SortMenuItems } from "~/components/ui/sort-menu"
import { usePath, useRouter, useT } from "~/hooks"
import { OrderBy, sortObjs } from "~/store"
import {
  clearSortState,
  loadSortState,
  saveSortState,
} from "~/pages/home/folder/sort-state"

const KEYS: OrderBy[] = ["name", "modified", "size"]

/**
 * The folder's sort state for every view: the same per-path state the list's
 * column headers read and write (sort-state.ts), so the two never disagree.
 */
export const useFolderSort = () => {
  const t = useT()
  const { pathname } = useRouter()
  const { refresh } = usePath()
  const state = createMemo(() => loadSortState(pathname()))
  return {
    options: KEYS.map((k) => ({ key: k, label: t(`home.obj.${k}`) })),
    labels: {
      by: t("files.sort.by"),
      asc: t("files.sort.asc"),
      desc: t("files.sort.desc"),
    },
    defaultLabel: t("files.sort.default"),
    // no remembered choice: the list is in the storage's own order
    value: (): OrderBy | undefined => state()?.orderBy as OrderBy | undefined,
    reverse: () => state()?.reverse ?? false,
    change: (key: string | undefined, reverse: boolean) => {
      const orderBy = (key ?? "name") as OrderBy
      saveSortState(pathname(), { orderBy, reverse })
      sortObjs(orderBy, reverse)
    },
    // "Sort: Name ↑" / "Sort: Default (storage order)"
    summary: () => {
      const v = state()?.orderBy
      const value = v
        ? `${t(`home.obj.${v}`)} ${state()?.reverse ? "↓" : "↑"}`
        : t("files.sort.default")
      return t("files.sort.current", { value })
    },
    // the objects were sorted here; list again to get the storage's order back
    reset: () => {
      clearSortState(pathname())
      void refresh(undefined, true)
    },
  }
}

export const FolderSortItems = () => {
  const s = useFolderSort()
  return (
    <SortMenuItems
      options={s.options}
      value={s.value()}
      reverse={s.reverse()}
      labels={s.labels}
      onChange={s.change}
      defaultLabel={s.defaultLabel}
      onReset={s.reset}
    />
  )
}

/**
 * The sort button of the Files toolbar row: the same button as its neighbours,
 * icon and the current choice. `labelClass` lets the bar hide the text where
 * there is no room.
 */
export const FolderSortMenu = (props: {
  class: string
  /** Replaces the visible text (the full choice stays in the tooltip). */
  label?: string
  labelClass?: string
  placement?: "bottom-start" | "bottom-end"
}) => {
  const s = useFolderSort()
  return (
    <DropdownMenu placement={props.placement ?? "bottom-start"}>
      <DropdownMenuTrigger
        aria-label={s.summary()}
        title={s.summary()}
        data-files-sort
        class={props.class}
      >
        <TbArrowsSort class="size-4" />
        <span class={props.labelClass}>{props.label ?? s.summary()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <FolderSortItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
