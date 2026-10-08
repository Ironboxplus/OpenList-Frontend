import { TbBooks } from "solid-icons/tb"
import { Show } from "solid-js"
import { DropdownMenuItem } from "~/components/ui/dropdown-menu"
import { useRouter, useT } from "~/hooks"
import { me } from "~/store"
import { UserMethods } from "~/types"
import {
  isLibrary,
  libraryCounts,
  mediaReady,
  toggleLibrary,
} from "../media/state"

/** Admin: mark this folder as a video library, or remove the mark. */
export const LibraryMenuItem = () => {
  const t = useT()
  const { pathname } = useRouter()
  return (
    <Show when={UserMethods.is_admin(me()) && mediaReady()}>
      <DropdownMenuItem
        data-library-toggle
        onSelect={() => void toggleLibrary(pathname(), isLibrary())}
        class="gap-2"
      >
        <TbBooks class="size-4" />
        {isLibrary() ? t("media.library.unset") : t("media.library.set")}
      </DropdownMenuItem>
    </Show>
  )
}

/** "Video library" badge with the title counts, shown next to the folder crumbs. */
export const LibraryBadge = () => {
  const t = useT()
  return (
    <Show when={isLibrary()}>
      <span
        data-library-badge
        title={t("media.library.counts", libraryCounts())}
        class="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
      >
        <TbBooks class="size-3.5" />
        <span>{t("media.library.badge")}</span>
        <span class="sm:hidden">
          {libraryCounts().done}/{libraryCounts().total}
        </span>
        <span class="hidden sm:inline">
          · {t("media.library.counts", libraryCounts())}
        </span>
      </span>
    </Show>
  )
}
