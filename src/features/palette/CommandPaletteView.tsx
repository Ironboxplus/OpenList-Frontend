import * as Dialog from "@kobalte/core/dialog"
import { TbSearch } from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  on,
  Show,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { focusRing } from "~/components/ui/focus"
import { cn } from "~/utils/cn"
import { emptyQueryList, type PaletteItem } from "./items"
import { rankAll } from "./rank"

export interface PaletteLabels {
  title: string
  placeholder: string
  empty: (query: string) => string
  count: (n: number) => string
  group: Record<PaletteItem["group"] | "recent", string>
  close: string
}

export interface CommandPaletteViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PaletteItem[]
  recentIds: string[]
  /** Entries that exist only for the text typed so far, listed after the matches. */
  extraItems?: (query: string) => PaletteItem[]
  /** Called after the palette closed, with the chosen entry. */
  onRun: (item: PaletteItem) => void
  /** Phones get a full-screen sheet from the bottom, others a centered dialog. */
  phone: boolean
  labels: PaletteLabels
}

/**
 * Presentation and keyboard handling of the palette: a combobox input driving
 * a listbox (aria-activedescendant keeps DOM focus in the input). Which items
 * exist, and what they do, is decided by the caller.
 */
export const CommandPaletteView = (props: CommandPaletteViewProps) => {
  const uid = createUniqueId()
  const listId = `palette-list-${uid}`
  const optionId = (i: number) => `palette-opt-${uid}-${i}`
  const [query, setQuery] = createSignal("")
  const [active, setActive] = createSignal(0)

  const rows = createMemo(() => {
    const q = query().trim()
    if (q === "") return emptyQueryList(props.items, props.recentIds)
    return [...rankAll(q, props.items), ...(props.extraItems?.(q) ?? [])].map(
      (item) => ({ item, recent: false }),
    )
  })

  // A new query starts at the top; reopening starts clean.
  createEffect(on(query, () => setActive(0)))
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          setQuery("")
          setActive(0)
        }
      },
    ),
  )

  let list: HTMLUListElement | undefined
  createEffect(() => {
    const el = list?.children[active()] as HTMLElement | undefined
    el?.scrollIntoView?.({ block: "nearest" })
  })

  const run = (index: number) => {
    const row = rows()[index]
    if (!row) return
    props.onOpenChange(false)
    props.onRun(row.item)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const n = rows().length
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (n > 0) setActive((active() + 1) % n)
        break
      case "ArrowUp":
        e.preventDefault()
        if (n > 0) setActive((active() - 1 + n) % n)
        break
      case "Home":
        if (n > 0) {
          e.preventDefault()
          setActive(0)
        }
        break
      case "End":
        if (n > 0) {
          e.preventDefault()
          setActive(n - 1)
        }
        break
      case "Enter":
        // Ignore Enter while an IME is composing a candidate.
        if (e.isComposing) break
        e.preventDefault()
        run(active())
        break
    }
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[1500] bg-background/80 backdrop-blur-sm data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
        <Dialog.Content
          data-palette={props.phone ? "sheet" : "dialog"}
          class={cn(
            "fixed z-[1500] flex flex-col overflow-hidden border bg-background text-foreground shadow-lg outline-none! duration-200 data-[expanded]:animate-in data-[closed]:animate-out",
            props.phone
              ? "inset-0 data-[closed]:slide-out-to-bottom data-[expanded]:slide-in-from-bottom"
              : "left-1/2 top-[12vh] max-h-[70vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95",
          )}
        >
          <Dialog.Title class="sr-only">{props.labels.title}</Dialog.Title>
          <div
            class="flex items-center gap-2 border-b px-3"
            style={
              props.phone
                ? { "padding-top": "env(safe-area-inset-top)" }
                : undefined
            }
          >
            <TbSearch class="size-4 shrink-0 text-muted-foreground" />
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                rows().length > 0 ? optionId(active()) : undefined
              }
              aria-label={props.labels.title}
              autocomplete="off"
              spellcheck={false}
              placeholder={props.labels.placeholder}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              class="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none! placeholder:text-muted-foreground"
            />
            <Show when={props.phone}>
              <Dialog.CloseButton
                aria-label={props.labels.close}
                class={cn(
                  "rounded-md bg-transparent px-2 py-1 text-sm text-muted-foreground hover:text-foreground",
                  focusRing,
                )}
              >
                {props.labels.close}
              </Dialog.CloseButton>
            </Show>
          </div>

          <ul
            id={listId}
            ref={list}
            role="listbox"
            aria-label={props.labels.title}
            class="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1.5"
          >
            <For each={rows()}>
              {(row, i) => (
                <li
                  id={optionId(i())}
                  role="option"
                  aria-selected={i() === active()}
                  data-palette-id={row.item.id}
                  class={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                    i() === active() && "bg-accent text-accent-foreground",
                  )}
                  onMouseMove={() => active() !== i() && setActive(i())}
                  onClick={() => run(i())}
                >
                  <Dynamic
                    component={row.item.icon}
                    class="size-4 shrink-0 text-muted-foreground"
                  />
                  <span class="min-w-0 flex-1 truncate">{row.item.title}</span>
                  <Show when={row.item.hint}>
                    <span class="hidden shrink-0 truncate text-xs text-muted-foreground sm:inline">
                      {row.item.hint}
                    </span>
                  </Show>
                  <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {row.recent
                      ? props.labels.group.recent
                      : props.labels.group[row.item.group]}
                  </span>
                </li>
              )}
            </For>
          </ul>
          <Show when={rows().length === 0}>
            <p class="px-4 py-8 text-center text-sm text-muted-foreground">
              {props.labels.empty(query().trim())}
            </p>
          </Show>
          <div role="status" aria-live="polite" class="sr-only">
            {props.labels.count(rows().length)}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
