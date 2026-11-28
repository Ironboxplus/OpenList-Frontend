import { Show } from "solid-js"
import { BsHddFill } from "solid-icons/bs"
import { shellActive } from "~/features/shell/topbar-slot"
import { objStore, State } from "~/store"
import {
  nearlyFull,
  showDiskUsage,
  toReadableUsage,
  usedPercentage,
} from "~/utils"
import type { Plugin } from "../registry"
import { Progress } from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/utils/cn"
import { Tooltip } from "~/components/overlay"

/**
 * Compact storage-usage indicator for the current directory's mount. Reads the
 * reactive `objStore.mountDetails`, which usePath keeps in sync on every
 * navigation (both the fs/get and fs/list paths) — so it updates live when you
 * enter/leave a storage and clears (hides) at the virtual storages-root instead
 * of showing the previous folder's data. The backend piggybacks the usage on the
 * list response (cache-backed + singleflight), so navigation costs no extra
 * request and cannot cause provider 429s under concurrent users.
 *
 * Inside the app shell the sidebar's storage card says the same (and more), so
 * the widget stays for the classic header only (guests).
 */
const DiskUsageWidget = () => {
  const details = () => objStore.mountDetails
  // The current mount's storage type, e.g. "BaiduNetdisk". driver_name is the
  // reliable source; the list endpoint's provider can be "unknown" — treat that
  // as no type.
  const storageType = () => {
    const t = details()?.driver_name ?? ""
    return t.toLowerCase() === "unknown" ? "" : t
  }
  const loading = () =>
    objStore.state === State.FetchingObj ||
    objStore.state === State.FetchingObjs
  const full = () => nearlyFull(details()!)

  return (
    <Show when={!shellActive()}>
      {/* First load (no data yet): show a skeleton placeholder. Subsequent
          navigations keep the existing bar (dimmed) so it never flashes. */}
      <Show when={loading() && !showDiskUsage(details())}>
        <Skeleton class="hidden h-[26px] w-[150px] rounded-full sm:block" />
      </Show>
      <Show when={showDiskUsage(details())}>
        <Tooltip
          label={`${storageType() ? storageType() + " · " : ""}${toReadableUsage(
            details()!,
          )}`}
          placement="bottom"
          withArrow
        >
          <div
            class="header-disk-usage hidden items-center gap-x-2 rounded-full bg-muted px-2.5 py-1 transition-[opacity,background-color] duration-200 hover:bg-accent sm:flex"
            classList={{ "opacity-55": loading() }}
          >
            <BsHddFill
              class={cn(
                "size-3.5",
                full() ? "text-destructive" : "text-primary",
              )}
            />
            <Show when={storageType()}>
              <p class="hidden whitespace-nowrap text-xs font-semibold text-foreground md:block">
                {storageType()}
              </p>
            </Show>
            <Progress
              class="w-20"
              trackClass="bg-border"
              fillClass={cn(
                "transition-[width] duration-500",
                full()
                  ? "bg-destructive data-[progress=complete]:bg-destructive"
                  : "bg-primary",
              )}
              value={usedPercentage(details()!)}
            />
            <p class="whitespace-nowrap text-xs text-muted-foreground">
              {toReadableUsage(details()!)}
            </p>
          </div>
        </Tooltip>
      </Show>
    </Show>
  )
}

export const diskUsagePlugin: Plugin = {
  id: "builtin.disk-usage",
  name: "Disk Usage",
  contributions: [
    { slot: "header-right", component: DiskUsageWidget, order: -10 },
  ],
}
