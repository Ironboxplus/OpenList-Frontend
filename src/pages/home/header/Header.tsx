import { changeColor } from "seemly"
import { Show, createSignal } from "solid-js"
import { getMainColor, getSetting, local, objStore, State } from "~/store"
import { BsSearch } from "solid-icons/bs"
import { CenterLoading } from "~/components"
import { Container } from "../Container"
import { bus } from "~/utils"
import { Layout } from "./layout"
import { UserMenu } from "./UserMenu"
import { PluginSlot } from "~/plugins"
import { isMac } from "~/utils/compatibility"
import { colorModeValue } from "~/store/color-mode"

export const Header = () => {
  const logos = getSetting("logo").split("\n")
  const logo = colorModeValue(logos[0], logos.pop())

  // the logo shows the spinner until it has loaded (and if it cannot)
  const [logoReady, setLogoReady] = createSignal(false)

  return (
    <div
      class="header flex w-full items-center justify-center bg-canvas"
      classList={{
        "sticky top-0 z-[1100]":
          local["position_of_header_navbar"] === "sticky",
      }}
    >
      <Container>
        <div class="flex flex-row items-center px-[calc(2%_+_0.5rem)] py-2 w-full justify-between">
          <div class="flex flex-row items-center h-[44px] header-left">
            <Show when={!logoReady()}>
              <CenterLoading />
            </Show>
            <img
              src={logo()!}
              class="h-full w-auto"
              classList={{ hidden: !logoReady() }}
              onLoad={() => setLogoReady(true)}
              onError={() => setLogoReady(false)}
            />
          </div>
          <div class="flex flex-row items-center gap-x-2 header-right">
            <PluginSlot name="header-right" />
            <Show when={objStore.state === State.Folder}>
              <Show when={getSetting("search_index") !== "none"}>
                <div
                  class="flex w-32 cursor-pointer items-center justify-between rounded-md border-2 border-transparent bg-(--search-bg) p-1 text-(--main) hover:bg-(--search-bg-hover)"
                  style={{
                    "--main": getMainColor(),
                    "--search-bg": changeColor(getMainColor(), { alpha: 0.15 }),
                    "--search-bg-hover": changeColor(getMainColor(), {
                      alpha: 0.2,
                    }),
                  }}
                  onClick={() => {
                    bus.emit("tool", "search")
                  }}
                >
                  <BsSearch />
                  <div class="flex flex-row items-center">
                    {isMac ? (
                      <kbd class="rounded-md border border-b-[3px] border-border bg-muted px-[0.4em] font-mono text-[0.8em] font-bold whitespace-nowrap">
                        Cmd
                      </kbd>
                    ) : (
                      <kbd class="rounded-md border border-b-[3px] border-border bg-muted px-[0.4em] font-mono text-[0.8em] font-bold whitespace-nowrap">
                        Ctrl
                      </kbd>
                    )}
                    <kbd class="rounded-md border border-b-[3px] border-border bg-muted px-[0.4em] font-mono text-[0.8em] font-bold whitespace-nowrap">
                      K
                    </kbd>
                  </div>
                </div>
              </Show>
              <Layout />
            </Show>
            <UserMenu />
          </div>
        </div>
      </Container>
    </div>
  )
}
