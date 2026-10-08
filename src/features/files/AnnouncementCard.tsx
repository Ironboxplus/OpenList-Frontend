import { TbSpeakerphone, TbX } from "solid-icons/tb"
import { createSignal, Show } from "solid-js"
import { Markdown } from "~/components"
import { Card } from "~/components/ui/card"
import { focusRing } from "~/components/ui/focus"
import { useT } from "~/hooks"
import { getSetting } from "~/store"
import { cn } from "~/utils/cn"

// Dismissed for the rest of the session, not per folder.
const [dismissed, setDismissed] = createSignal(false)

/**
 * Site announcement as a card at the top of the content. Inside the shell it
 * replaces the floating toast, which covered the TopBar on phones.
 */
export const AnnouncementCard = () => {
  const t = useT()
  const text = () => getSetting("announcement")
  return (
    <Show when={text() && !dismissed()}>
      <Card
        data-announcement
        class="flex items-start gap-3 p-3 text-sm sm:p-4"
        role="note"
      >
        <TbSpeakerphone class="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1 [&_p]:m-0">
          <Markdown children={text()} />
        </div>
        <button
          type="button"
          aria-label={t("files.dismiss")}
          onClick={() => setDismissed(true)}
          class={cn(
            focusRing,
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <TbX class="size-4" />
        </button>
      </Card>
    </Show>
  )
}
