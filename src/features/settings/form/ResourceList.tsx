import { TbArrowDown, TbArrowUp, TbDots, TbRefresh } from "solid-icons/tb"
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useT } from "~/hooks"
import { createViewport } from "~/features/shell/viewport"
import { cn } from "~/utils/cn"
import { DataState } from "~/components/ui/data-state"

export interface ResourceColumn<T> {
  id: string
  /** Translated header text. */
  header: string
  cell: (row: T) => JSX.Element
  /** Makes the header a sort button; compares what this returns. */
  sort?: (row: T) => string | number
  class?: string
}

export interface RowAction<T> {
  id: string
  label: string
  onSelect: (row: T) => void
  destructive?: boolean
  disabled?: boolean
}

export interface ToolbarAction {
  id: string
  label: string
  onSelect: () => void
  variant?: "default" | "outline" | "secondary"
  disabled?: boolean
  /** Why it is disabled, shown as the tooltip text. */
  hint?: string
  icon?: JSX.Element
}

export interface ResourceListProps<T> {
  rows: readonly T[]
  rowKey: (row: T) => string | number
  columns: ResourceColumn<T>[]
  /** What one record looks like on a phone: title, status badges, details. */
  card: {
    title: (row: T) => JSX.Element
    badges?: (row: T) => JSX.Element
    body?: (row: T) => JSX.Element
  }
  /** The "..." menu of a row; an empty list hides the menu. */
  actions?: (row: T) => RowAction<T>[]
  /** One action shown as a button beside the menu (usually Edit). */
  primary?: (row: T) => RowAction<T> | undefined
  loading?: boolean
  error?: string
  emptyText?: string
  onRefresh?: () => void
  toolbarActions?: ToolbarAction[]
  /** Left side of the toolbar (filters, search). */
  toolbar?: JSX.Element
  /** Heading (and what the list is for) when the list is one part of a larger page. */
  title?: string
  description?: string
  class?: string
}

/** Headers stay under the top bar while the page scrolls. */
const STICKY = "sticky top-[var(--shell-top,0px)] z-[1] bg-card"

const RowMenu = <T,>(props: { row: T; actions: RowAction<T>[] }) => {
  const t = useT()
  const normal = () => props.actions.filter((a) => !a.destructive)
  const danger = () => props.actions.filter((a) => a.destructive)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        as={Button}
        variant="ghost"
        size="icon"
        aria-label={t("common.more_actions")}
        data-testid="row-actions"
      >
        <TbDots class="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <For each={normal()}>
          {(a) => (
            <DropdownMenuItem
              disabled={a.disabled}
              onSelect={() => a.onSelect(props.row)}
            >
              {a.label}
            </DropdownMenuItem>
          )}
        </For>
        <Show when={normal().length > 0 && danger().length > 0}>
          <DropdownMenuSeparator />
        </Show>
        <For each={danger()}>
          {(a) => (
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              disabled={a.disabled}
              onSelect={() => a.onSelect(props.row)}
            >
              {a.label}
            </DropdownMenuItem>
          )}
        </For>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The skeleton shared by storages, users, shares, metas and similar lists: a
 * toolbar (create, refresh, filters), then a card holding a table with sticky
 * headers and per-row menus on wide screens, or one card per record on phones.
 * Loading, empty and failed states come from DataState.
 */
export const ResourceList = <T,>(props: ResourceListProps<T>) => {
  const t = useT()
  const viewport = createViewport()
  const [sort, setSort] = createSignal<{ id: string; dir: 1 | -1 }>()

  const rows = createMemo(() => {
    const s = sort()
    const col = s && props.columns.find((c) => c.id === s.id)
    if (!s || !col?.sort) return props.rows
    const key = col.sort
    return [...props.rows].sort((a, b) => {
      const x = key(a)
      const y = key(b)
      return (x < y ? -1 : x > y ? 1 : 0) * s.dir
    })
  })

  const toggleSort = (id: string) =>
    setSort((s) =>
      s?.id !== id ? { id, dir: 1 } : s.dir === 1 ? { id, dir: -1 } : undefined,
    )

  const actionsOf = (row: T) => props.actions?.(row) ?? []

  return (
    <div class={cn("flex w-full flex-col gap-3", props.class)}>
      <Show when={props.title}>
        <div>
          <h2 class="text-base font-semibold leading-tight">{props.title}</h2>
          <Show when={props.description}>
            <p class="mt-1 text-sm text-muted-foreground">
              {props.description}
            </p>
          </Show>
        </div>
      </Show>
      <div
        data-testid="resource-toolbar"
        class="flex flex-wrap items-center gap-2 empty:hidden"
      >
        <For each={props.toolbarActions}>
          {(a) => (
            <Button
              variant={a.variant ?? "default"}
              disabled={a.disabled}
              title={a.disabled ? a.hint : undefined}
              onClick={a.onSelect}
              data-action={a.id}
            >
              {a.icon}
              {a.label}
            </Button>
          )}
        </For>
        <Show when={props.onRefresh}>
          <Button
            variant="outline"
            onClick={props.onRefresh}
            disabled={props.loading}
            data-action="refresh"
          >
            <TbRefresh
              class={cn("mr-1.5 size-4", props.loading && "animate-spin")}
            />
            {t("global.refresh")}
          </Button>
        </Show>
        {props.toolbar}
      </div>
      <DataState
        loading={props.loading}
        error={props.error}
        onRetry={props.onRefresh}
        empty={props.rows.length === 0}
        emptyText={props.emptyText}
      >
        <Switch>
          <Match when={viewport() === "phone"}>
            <div data-layout="cards" class="flex flex-col gap-3">
              <For each={rows()}>
                {(row) => (
                  <Card
                    data-row={props.rowKey(row)}
                    class="flex flex-col gap-2 p-4"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 break-all font-medium">
                        {props.card.title(row)}
                      </div>
                      <Show when={actionsOf(row).length > 0}>
                        <RowMenu row={row} actions={actionsOf(row)} />
                      </Show>
                    </div>
                    <Show when={props.card.badges}>
                      <div class="flex flex-wrap gap-1.5">
                        {props.card.badges!(row)}
                      </div>
                    </Show>
                    <Show when={props.card.body}>
                      <div class="text-sm text-muted-foreground">
                        {props.card.body!(row)}
                      </div>
                    </Show>
                    <Show when={props.primary?.(row)}>
                      {(a) => (
                        <Button
                          variant="outline"
                          size="sm"
                          class="self-start"
                          disabled={a().disabled}
                          onClick={() => a().onSelect(row)}
                        >
                          {a().label}
                        </Button>
                      )}
                    </Show>
                  </Card>
                )}
              </For>
            </div>
          </Match>
          <Match when>
            <Card data-layout="table" class="overflow-clip">
              <Table container={false}>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <For each={props.columns}>
                      {(col) => (
                        <TableHead
                          class={cn(STICKY, col.class)}
                          aria-sort={
                            sort()?.id === col.id
                              ? sort()!.dir === 1
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                        >
                          <Show when={col.sort} fallback={col.header}>
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 bg-transparent font-medium text-inherit hover:text-foreground"
                              onClick={() => toggleSort(col.id)}
                            >
                              {col.header}
                              <Show when={sort()?.id === col.id}>
                                <Show
                                  when={sort()!.dir === 1}
                                  fallback={<TbArrowDown class="size-3" />}
                                >
                                  <TbArrowUp class="size-3" />
                                </Show>
                              </Show>
                            </button>
                          </Show>
                        </TableHead>
                      )}
                    </For>
                    <TableHead class={cn(STICKY, "w-px text-right")}>
                      <span class="sr-only">{t("global.operations")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <For each={rows()}>
                    {(row) => (
                      <TableRow data-row={props.rowKey(row)}>
                        <For each={props.columns}>
                          {(col) => (
                            <TableCell class={col.class}>
                              {col.cell(row)}
                            </TableCell>
                          )}
                        </For>
                        <TableCell class="whitespace-nowrap text-right">
                          <div class="flex items-center justify-end gap-1">
                            <Show when={props.primary?.(row)}>
                              {(a) => (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={a().disabled}
                                  onClick={() => a().onSelect(row)}
                                >
                                  {a().label}
                                </Button>
                              )}
                            </Show>
                            <Show when={actionsOf(row).length > 0}>
                              <RowMenu row={row} actions={actionsOf(row)} />
                            </Show>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </Card>
          </Match>
        </Switch>
      </DataState>
    </div>
  )
}
