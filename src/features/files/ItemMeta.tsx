import { For, type JSX, Show } from "solid-js"
import { getSettingBool } from "~/store"
import type { MountDetails, StoreObj } from "~/types"
import {
  formatDate,
  formatDateCompact,
  getFileSize,
  nearlyFull,
  showDiskUsage,
  toReadableUsage,
  usedPercentage,
} from "~/utils"
import { cn } from "~/utils/cn"
import { episodeFor } from "../media/state"

/**
 * What a list row and a grid card say about an entry besides its name: the
 * episode, driver badges, size (or a mount point's disk usage) and the
 * modified time. Both layouts are built from these, so they cannot drift.
 */

/** "12.3 MB" for a file, the usage text for a mount point, "" for a plain folder. */
export const sizeText = (obj: StoreObj): string =>
  obj.mount_details
    ? toReadableUsage(obj.mount_details)
    : obj.is_dir
      ? ""
      : getFileSize(obj.size)

export const EpisodeText = (props: { name: string; class?: string }) => (
  <Show when={episodeFor(props.name)}>
    {(ep) => (
      <span
        class={cn(
          "episode shrink-0 whitespace-nowrap text-xs text-muted-foreground",
          props.class,
        )}
      >
        {ep().text}
      </span>
    )}
  </Show>
)

/** Compact time, the full timestamp on hover. */
export const ModifiedText = (props: { modified?: string; class?: string }) => (
  <span
    class={cn("modified whitespace-nowrap", props.class)}
    title={props.modified ? formatDate(props.modified) : undefined}
  >
    {formatDateCompact(props.modified)}
  </span>
)

/** A storage's usage as a bar with its text over it, or as plain text (a setting). */
export const UsageBar = (props: { details: MountDetails; class?: string }) => (
  <Show
    when={!getSettingBool("show_disk_usage_in_plain_text")}
    fallback={
      <span class={cn("size whitespace-nowrap", props.class)}>
        {toReadableUsage(props.details)}
      </span>
    }
  >
    <div
      class={cn(
        "disk-usage-percentage relative h-5 w-full min-w-24 overflow-hidden rounded-full bg-primary/15",
        props.class,
      )}
    >
      <div
        class={cn(
          "absolute inset-y-0 left-0 rounded-full",
          nearlyFull(props.details) ? "bg-destructive/50" : "bg-primary/35",
        )}
        style={{ width: `${usedPercentage(props.details)}%` }}
      />
      <span class="disk-usage-text relative flex h-full items-center justify-center whitespace-nowrap px-2 text-xs">
        {toReadableUsage(props.details)}
      </span>
    </div>
  </Show>
)

/** The mount point usage of an entry, when its driver reports one. */
const usageOf = (obj: StoreObj): MountDetails | undefined =>
  showDiskUsage(obj.mount_details) ? obj.mount_details : undefined

/** The size column of a list row: usage bar for mount points, size otherwise. */
export const SizeOrUsage = (props: { obj: StoreObj }) => (
  <Show
    when={usageOf(props.obj)}
    fallback={<span class="size">{getFileSize(props.obj.size)}</span>}
  >
    {(d) => <UsageBar details={d()} />}
  </Show>
)

/**
 * The second line of a card: episode, size and modified time (dot separated),
 * or, for a mount point, its usage bar. Badges are the caller's to place.
 */
export const CardMeta = (props: { obj: StoreObj }) => {
  const usage = () => usageOf(props.obj)
  const parts = (): JSX.Element[] => {
    const out: JSX.Element[] = []
    if (episodeFor(props.obj.name))
      out.push(<EpisodeText name={props.obj.name} />)
    const size = props.obj.is_dir ? "" : getFileSize(props.obj.size)
    if (size) out.push(<span class="size whitespace-nowrap">{size}</span>)
    if (props.obj.modified)
      out.push(<ModifiedText modified={props.obj.modified} />)
    return out
  }
  return (
    <Show
      when={usage()}
      fallback={
        <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <For each={parts()}>
            {(part, i) => (
              <>
                <Show when={i() > 0}>
                  <span aria-hidden="true">·</span>
                </Show>
                {part}
              </>
            )}
          </For>
        </div>
      }
    >
      {(d) => <UsageBar details={d()} />}
    </Show>
  )
}
