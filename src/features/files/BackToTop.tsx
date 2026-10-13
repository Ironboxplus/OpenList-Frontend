import { TbArrowUp } from "solid-icons/tb"
import { createSignal, onCleanup, Show } from "solid-js"
import { phoneShell } from "../shell/topbar-slot"
import { TAB_BAR_HEIGHT } from "../shell/viewport"

/**
 * Back-to-top inside the shell: a round button at the bottom right (above the
 * FAB on phones). The classic version hangs from the top edge and would sit on
 * the TopBar's own icons.
 */
export const BackToTop = () => {
  const [visible, setVisible] = createSignal(false)
  const onScroll = () => setVisible(window.scrollY > 100)
  window.addEventListener("scroll", onScroll, { passive: true })
  onCleanup(() => window.removeEventListener("scroll", onScroll))
  return (
    <Show when={visible()}>
      <button
        type="button"
        data-back-top
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        class="fixed z-[1100] inline-flex size-10 items-center justify-center rounded-full border bg-card text-foreground shadow-md"
        style={{
          right: "calc(var(--shell-content-right, 0px) + 1.25rem)",
          bottom: phoneShell()
            ? `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom) + 5.25rem)`
            : "calc(var(--shell-gap, 0px) + 1.5rem)",
        }}
      >
        <TbArrowUp class="size-5" />
      </button>
    </Show>
  )
}
