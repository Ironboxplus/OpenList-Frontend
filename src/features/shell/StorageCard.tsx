import { TbDatabase } from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
  untrack,
} from "solid-js"
import { useRouter, useT } from "~/hooks"
import { objStore, State } from "~/store"
import { nearlyFull, toReadableUsage, usedPercentage } from "~/utils"
import { cn } from "~/utils/cn"
import { currentSpot } from "./files-memory"
import {
  COLLAPSED_COUNT,
  mountNameFor,
  rememberMounts,
  storageEntries,
  type MountNames,
} from "./storage-entries"

/**
 * Storage space, as Cloudreve's card at the foot of its sidebar: the usage of
 * the storage being browsed, or of the mount points at the storages root. The
 * numbers are the ones fs/list already sends (`mount_details`); the card is
 * hidden when there are none.
 */
export const StorageCard = (props: { class?: string }) => {
  const t = useT()
  const { pathname } = useRouter()
  // Names of the mount points listed so far; the folder being browsed is named after its mount.
  const mounts: MountNames = new Map()
  createEffect(() => {
    if (objStore.state === State.Folder) {
      rememberMounts(mounts, untrack(pathname), objStore.objs)
    }
  })
  const entries = createMemo(() => {
    const path = currentSpot()?.path ?? pathname()
    return storageEntries(
      objStore.mountDetails,
      objStore.objs,
      mountNameFor(mounts, path),
    )
  })
  const [all, setAll] = createSignal(false)
  const shown = () => (all() ? entries() : entries().slice(0, COLLAPSED_COUNT))
  return (
    <Show when={entries().length > 0}>
      <section
        data-storage-card
        class={cn(
          "flex flex-col gap-3 rounded-xl bg-muted/60 p-3",
          props.class,
        )}
      >
        <h3 class="flex items-center gap-2 text-sm font-medium">
          <TbDatabase class="size-4 shrink-0" />
          {t("shell.storage.title")}
        </h3>
        <For each={shown()}>
          {(entry) => (
            <div class="flex min-w-0 flex-col gap-1">
              <Show when={entry.name}>
                <span class="truncate text-xs font-medium" title={entry.name}>
                  {entry.name}
                </span>
              </Show>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
                <div
                  class={cn(
                    "h-full rounded-full",
                    nearlyFull(entry.details) ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${usedPercentage(entry.details)}%` }}
                />
              </div>
              <span class="truncate text-xs text-muted-foreground">
                {toReadableUsage(entry.details)}
              </span>
            </div>
          )}
        </For>
        <Show when={entries().length > COLLAPSED_COUNT}>
          <button
            type="button"
            class="self-start text-xs text-primary hover:underline"
            onClick={() => setAll(!all())}
          >
            {all() ? t("shell.storage.show_less") : t("shell.storage.show_all")}
          </button>
        </Show>
      </section>
    </Show>
  )
}
