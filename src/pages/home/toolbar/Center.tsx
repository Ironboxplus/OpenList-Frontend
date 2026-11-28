import { createMemo, For, Show } from "solid-js"
import {
  checkboxOpen,
  haveSelected,
  objStore,
  selectAll,
  selectedMsg,
  selectedObjs,
  State,
  userCan,
} from "~/store"
import { CopyLink } from "./CopyLink"
import { CenterIcon } from "./Icon"
import { bus, isTouchDevice } from "~/utils"
import { Download } from "./Download"
import { createPresence, MotionTokens } from "~/platform/motion"
import { useRouter } from "~/hooks"
import { cn } from "~/utils/cn"

export const Center = () => {
  const show = createMemo(
    () =>
      [State.Folder, State.FetchingMore].includes(objStore.state) &&
      checkboxOpen() &&
      haveSelected(),
  )
  const { isShare } = useRouter()
  const selectedCount = createMemo(() => selectedObjs().length)
  const isTouch = isTouchDevice()
  // the bar stays mounted through its exit
  const presence = createPresence(show)
  const bar = presence.part({
    enter: [
      {
        opacity: [0, 1],
        transform: ["translateY(10px) scale(0.9)", "translateY(0px) scale(1)"],
      },
      MotionTokens.options.barEnter,
    ],
    exit: [
      { opacity: [null, 0], transform: [null, "scale(0.9)"] },
      MotionTokens.options.barExit,
    ],
  })
  return (
    <Show when={presence.present()}>
      <div
        class={cn(
          "center-toolbar fixed w-max -translate-x-1/2 text-muted-foreground",
          isTouch && "max-w-[calc(100vw-2rem)]",
        )}
        style={{
          bottom: "calc(var(--shell-gap, 0px) + 1rem)",
          // Centred on the content panel, not on the window.
          left: "calc((var(--shell-content-left, 0px) + 100% - var(--shell-content-right, 0px)) / 2)",
        }}
      >
        <div ref={bar}>
          <div class="rounded-lg bg-white p-2 shadow-[0px_10px_30px_-5px_rgba(0,0,0,0.3)] backdrop-blur-sm dark:bg-[#000000d0]">
            {/* Selection count indicator */}
            <div class="flex flex-row items-center mb-1.5 px-1 gap-x-2">
              <div class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-primary-foreground">
                <p class="text-xs leading-none font-semibold">
                  {selectedCount()}
                </p>
              </div>
              <p class="text-sm text-muted-foreground">{selectedMsg()}</p>
            </div>
            {/* Action buttons — wrappable on touch so labels don't overflow */}
            <div
              class={cn(
                "flex items-center gap-x-1",
                isTouch
                  ? "flex-wrap justify-center"
                  : "flex-nowrap justify-start",
              )}
            >
              <Show when={!isShare() && objStore.write}>
                <For
                  each={
                    ["rename", "move", "copy", "delete", "decompress"] as const
                  }
                >
                  {(name) => {
                    return userCan(name) ? (
                      <CenterIcon
                        name={name}
                        onClick={() => {
                          bus.emit("tool", name)
                        }}
                      />
                    ) : null
                  }}
                </For>
              </Show>
              <Show when={userCan("share") && !isShare()}>
                <CenterIcon
                  name="share"
                  onClick={() => {
                    bus.emit("tool", "share")
                  }}
                />
              </Show>
              <CopyLink />
              <Download />
              <CenterIcon
                name="cancel_select"
                onClick={() => {
                  selectAll(false)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
