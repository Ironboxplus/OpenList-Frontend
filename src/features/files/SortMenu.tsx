import { TbArrowsSort } from "solid-icons/tb"
import { createMemo } from "solid-js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { SortMenuItems } from "~/components/ui/sort-menu"
import { useRouter, useT } from "~/hooks"
import { OrderBy, sortObjs } from "~/store"
import { loadSortState, saveSortState } from "~/pages/home/folder/sort-state"

const KEYS: OrderBy[] = ["name", "modified", "size"]

/**
 * The folder's sort state for every view: the same per-path state the list's
 * column headers read and write (sort-state.ts), so the two never disagree.
 */
export const useFolderSort = () => {
  const t = useT()
  const { pathname } = useRouter()
  const state = createMemo(() => loadSortState(pathname()))
  return {
    options: KEYS.map((k) => ({ key: k, label: t(`home.obj.${k}`) })),
    labels: {
      by: t("files.sort.by"),
      asc: t("files.sort.asc"),
      desc: t("files.sort.desc"),
    },
    value: () => state()?.orderBy,
    reverse: () => state()?.reverse ?? false,
    change: (key: string | undefined, reverse: boolean) => {
      const orderBy = (key ?? "name") as OrderBy
      saveSortState(pathname(), { orderBy, reverse })
      sortObjs(orderBy, reverse)
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
    />
  )
}

export const FolderSortMenu = (props: { class: string }) => {
  const t = useT()
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenuTrigger
        aria-label={t("files.sort.title")}
        data-files-sort
        class={props.class}
      >
        <TbArrowsSort class="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <FolderSortItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
