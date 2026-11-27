// The viewers' More menu: what the download page and the player page had
// (previews/download.tsx and video_box.tsx, removed in P2) — the link and its
// QR code, the other ways to open the file, external players with the sidecar
// subtitle, the mpv command, auto-next, the file's details and sharing.
import QRCode from "qrcode"
import {
  TbApps,
  TbDots,
  TbInfoCircle,
  TbLink,
  TbPlayerPlay,
  TbQrcode,
  TbShare,
  TbTerminal2,
} from "solid-icons/tb"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useCopyLink, useLink, useRouter, useT, useUtil } from "~/hooks"
import {
  downloadDenied,
  getExternalPreviews,
  objStore,
  password,
  selectIndex,
  userCan,
} from "~/store"
import { Obj, ObjType } from "~/types"
import {
  convertURL,
  formatDate,
  getFileSize,
  getPlatform,
  isMpvMedia,
  notify,
} from "~/utils"
import { cn } from "~/utils/cn"
import { getPreviews } from "~/pages/home/previews"
import { players } from "~/pages/home/previews/players"
import { runTool } from "../files/file-actions"
import { autoNext, setAutoNext } from "./auto-next"
import { useSidecarSubtitle } from "./sidecar"

const ALL_PLAYERS = "video_show_all_players"

/** An icon button of a viewer's toolbar: 40px, label as its name and title. */
export const ToolButton = (props: {
  label: string
  testid?: string
  dark?: boolean
  disabled?: boolean
  class?: string
  onClick: () => void
  children: any
}) => (
  <button
    type="button"
    aria-label={props.label}
    title={props.label}
    data-testid={props.testid}
    disabled={props.disabled}
    onClick={() => props.onClick()}
    class={cn(
      "inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-transparent outline-none! transition-colors focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5",
      props.dark
        ? "text-white hover:bg-white/15"
        : "text-foreground hover:bg-accent",
      props.class,
    )}
  >
    {props.children}
  </button>
)

export const ViewerMore = (props: {
  obj?: Obj
  /** The file's full path, for the subtitle lookup and the details. */
  path?: string
  /** The file's stream when objStore does not hold it (the docked player). */
  rawUrl?: string
  /** The preview showing now (left out of Open with). */
  current?: string
  /** Opens the file with another preview. */
  onPreview: (key: string) => void
  testid: string
  dark?: boolean
}) => {
  const t = useT()
  const { copy } = useUtil()
  const { rawLink } = useLink()
  const { copyMpvCommand } = useCopyLink()
  const { isShare } = useRouter()
  const [qr, setQr] = createSignal("")
  const [info, setInfo] = createSignal(false)
  const [allPlayers, setAllPlayers] = createSignal(
    localStorage.getItem(ALL_PLAYERS) === "true",
  )
  const isVideo = () => props.obj?.type === ObjType.VIDEO
  const raw = () => props.rawUrl ?? objStore.raw_url
  const link = () => (props.obj ? rawLink(props.obj, true) : "")
  const sub = useSidecarSubtitle(
    () => (isVideo() ? props.path : undefined),
    () => (isShare() ? "" : password()),
  )
  const others = createMemo(() =>
    props.obj
      ? getPreviews({ ...props.obj, provider: objStore.provider }).filter(
          (p) => p.key !== "download" && p.key !== props.current,
        )
      : [],
  )
  const external = createMemo(() =>
    props.obj ? getExternalPreviews(props.obj.name) : [],
  )
  const platform = getPlatform()
  const shownPlayers = () =>
    allPlayers() || platform === "Unknown"
      ? players
      : players.filter((p) => p.platforms.includes(platform))
  const denied = () => {
    if (!downloadDenied()) return false
    notify.warning(t("shares.download_disabled"))
    return true
  }
  const share = () => {
    // the share dialog takes the selection: this file
    const i = objStore.objs.findIndex((o) => o.name === props.obj?.name)
    if (i >= 0) selectIndex(i, true, true)
    runTool("share")
  }
  const item = "gap-2.5"

  return (
    <>
      <DropdownMenu placement="bottom-end">
        <DropdownMenuTrigger
          as={Button}
          variant="ghost"
          size="icon"
          aria-label={t("home.viewer.more")}
          title={t("home.viewer.more")}
          data-testid={props.testid}
          class={cn(
            "size-10 shrink-0 [&_svg]:size-5",
            props.dark && "text-white hover:bg-white/15 hover:text-white",
          )}
        >
          <TbDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent class="min-w-52">
          <Show when={!downloadDenied()}>
            <DropdownMenuItem
              data-action="copy_link"
              class={item}
              onSelect={() => !denied() && copy(link())}
            >
              <TbLink class="size-4" />
              {t("home.viewer.copy_link")}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-action="qr_code"
              class={item}
              onSelect={() =>
                void QRCode.toDataURL(link(), {
                  type: "image/png",
                  scale: 6,
                }).then((url) => setQr(url))
              }
            >
              <TbQrcode class="size-4" />
              {t("home.viewer.qr_code")}
            </DropdownMenuItem>
          </Show>
          <Show when={others().length + external().length > 0}>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-action="open_with" class={item}>
                <TbApps class="size-4" />
                {t("home.viewer.open_with")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <For each={others()}>
                  {(p) => (
                    <DropdownMenuItem onSelect={() => props.onPreview(p.key)}>
                      {p.name}
                    </DropdownMenuItem>
                  )}
                </For>
                <Show when={others().length && external().length}>
                  <DropdownMenuSeparator />
                </Show>
                <For each={external()}>
                  {(p) => (
                    <DropdownMenuItem
                      as="a"
                      target="_blank"
                      href={convertURL(p.value, {
                        raw_url: raw(),
                        name: props.obj?.name ?? "",
                        d_url: link(),
                      })}
                    >
                      {p.key}
                    </DropdownMenuItem>
                  )}
                </For>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </Show>
          <Show when={isVideo() && !downloadDenied()}>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-action="players" class={item}>
                <TbPlayerPlay class="size-4" />
                {t("home.viewer.players")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="max-h-[60vh] overflow-y-auto">
                <For each={shownPlayers()}>
                  {(p) => (
                    <DropdownMenuItem
                      as="a"
                      class={item}
                      href={convertURL(p.scheme, {
                        raw_url: raw(),
                        name: props.obj?.name ?? "",
                        d_url: link(),
                        sub_url: sub(),
                      })}
                    >
                      <img
                        class="size-4 shrink-0"
                        src={`${window.__dynamic_base__}/images/${p.icon}.webp`}
                        alt=""
                      />
                      {p.name}
                    </DropdownMenuItem>
                  )}
                </For>
                <Show when={platform !== "Unknown"}>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={allPlayers()}
                    closeOnSelect={false}
                    onChange={(on: boolean) => {
                      setAllPlayers(on)
                      localStorage.setItem(ALL_PLAYERS, String(on))
                    }}
                  >
                    {t("home.viewer.all_players")}
                  </DropdownMenuCheckboxItem>
                </Show>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </Show>
          <Show when={props.obj && isMpvMedia(props.obj) && !downloadDenied()}>
            <DropdownMenuItem
              data-action="mpv_command"
              class={item}
              onSelect={() => props.obj && void copyMpvCommand(props.obj)}
            >
              <TbTerminal2 class="size-4" />
              {t("home.toolbar.mpv_command")}
            </DropdownMenuItem>
          </Show>
          <Show when={isVideo()}>
            <DropdownMenuCheckboxItem
              data-action="auto_next"
              checked={autoNext()}
              onChange={(on: boolean) => setAutoNext(on)}
            >
              {t("home.preview.auto_next")}
            </DropdownMenuCheckboxItem>
          </Show>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-action="info"
            class={item}
            onSelect={() => setInfo(true)}
          >
            <TbInfoCircle class="size-4" />
            {t("home.viewer.info")}
          </DropdownMenuItem>
          <Show when={!isShare() && userCan("share")}>
            <DropdownMenuItem data-action="share" class={item} onSelect={share}>
              <TbShare class="size-4" />
              {t("home.toolbar.share")}
            </DropdownMenuItem>
          </Show>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={!!qr()} onOpenChange={(o) => !o && setQr("")}>
        <DialogContent class="max-w-xs justify-items-center">
          <DialogTitle class="justify-self-start">
            {t("home.viewer.qr_code")}
          </DialogTitle>
          <img
            src={qr()}
            alt={props.obj?.name}
            class="size-60 rounded-md bg-white p-2"
          />
        </DialogContent>
      </Dialog>
      <Dialog open={info()} onOpenChange={setInfo}>
        <DialogContent class="max-w-md">
          <DialogTitle class="break-all pr-8">{props.obj?.name}</DialogTitle>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-muted-foreground">{t("home.obj.size")}</dt>
            <dd>{getFileSize(props.obj?.size ?? 0)}</dd>
            <dt class="text-muted-foreground">{t("home.obj.modified")}</dt>
            <dd>{formatDate(props.obj?.modified ?? "")}</dd>
            <Show when={objStore.provider}>
              <dt class="text-muted-foreground">
                {t("storages.common.driver")}
              </dt>
              <dd>{t(`drivers.drivers.${objStore.provider}`)}</dd>
            </Show>
            <dt class="text-muted-foreground">{t("home.obj.name")}</dt>
            <dd class="break-all">{props.path}</dd>
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}
