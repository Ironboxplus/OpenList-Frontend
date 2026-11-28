import { Show, createSignal, onCleanup } from "solid-js"
import { FiArrowUp } from "solid-icons/fi"
import { MotionDiv, MotionTokens } from "~/platform/motion"
import { isMobile } from "~/utils/compatibility"
import { getMainColor } from "~/store"
import { BackToTop } from "~/features/files/BackToTop"
import { shellActive } from "~/features/shell/topbar-slot"

export const useScrollListener = (
  callback: (e?: Event) => void,
  options?: { immediate?: boolean },
) => {
  if (options?.immediate) callback()
  window.addEventListener("scroll", callback, { passive: true })
  onCleanup(() => window.removeEventListener("scroll", callback))
}

export const BackTop = () => (
  <Show when={shellActive()} fallback={<ClassicBackTop />}>
    <BackToTop />
  </Show>
)

const ClassicBackTop = () => {
  if (isMobile) return null

  const [visible, setVisible] = createSignal(false)

  useScrollListener(() => setVisible(window.scrollY > 100))

  return (
    <Show when={visible()}>
      <MotionDiv
        initial={{ y: -999 }}
        animate={{ y: 0 }}
        timing={MotionTokens.options.pane}
        class="fixed top-0 right-5 z-[1300] overflow-hidden rounded-b-[50%] bg-white/92 text-(--back-top) shadow-lg hover:bg-(--back-top) hover:text-white dark:bg-(--back-top) dark:text-white"
        style={{ "--back-top": getMainColor() }}
      >
        <FiArrowUp
          class="size-7 cursor-pointer rounded-lg p-1 outline-none"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
        />
      </MotionDiv>
    </Show>
  )
}
