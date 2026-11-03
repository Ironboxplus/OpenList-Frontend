import { For } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import type { EpisodeRow } from "./episodes"
import { versionLabels } from "./versions"

/**
 * The choice between the files of one film, or of one episode that exists in
 * several release folders. Rows are told apart by file name (the versions of an
 * episode share its index). Each chip carries `data-version={index}`.
 */
export const VersionPicker = (props: {
  rows: readonly EpisodeRow[]
  /** File name of the chosen row. */
  value: string | undefined
  onChange: (row: EpisodeRow) => void
}) => {
  const t = useT()
  const labels = () =>
    versionLabels(
      props.rows.map((r) => r.file_name),
      t("media.video.version_original"),
    )
  return (
    <div data-version-picker class="flex flex-wrap items-center gap-1.5">
      <For each={props.rows}>
        {(row, i) => (
          <button
            type="button"
            data-version={row.index}
            title={row.file_name}
            aria-pressed={props.value === row.file_name}
            class={cn(
              focusRing,
              "inline-flex h-8 max-w-[260px] items-center rounded-full border px-3 text-xs transition-colors",
              props.value === row.file_name
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-accent",
            )}
            onClick={() => props.onChange(row)}
          >
            <span class="truncate">{labels()[i()]}</span>
          </button>
        )}
      </For>
    </div>
  )
}
