// A file nothing here shows, or one whose site downloads by default (plan §0.2
// 下载; the prototype's UnknownDialog.tsx): a small dialog with what one can
// still do with it — download, external players, the link, and the previews
// that may still read it under Open with — instead of a page of its own.
import {
  TbCopy,
  TbDownload,
  TbExternalLink,
  TbFileUnknown,
} from "solid-icons/tb"
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useDownload, useLink, useT, useUtil } from "~/hooks"
import { downloadDenied, objStore, previewDenied } from "~/store"
import { convertURL, ext, formatDate, getFileSize, getPlatform } from "~/utils"
import { getPreviews } from "~/pages/home/previews"
import { players } from "~/pages/home/previews/players"
import { closeCurrent, dialogPath, entryOf, openWith } from "./state"

export const UnknownDialog = () => {
  const t = useT()
  const { copy } = useUtil()
  const { rawLink } = useLink()
  const { downloadObjs } = useDownload()
  const [shown, setShown] = createSignal<string>()
  const [copied, setCopied] = createSignal(false)
  let box: HTMLDivElement | undefined
  // keep the last file while the dialog animates out
  createEffect(
    on(dialogPath, (p) => {
      if (p) {
        setShown(p)
        setCopied(false)
      }
    }),
  )
  const obj = createMemo(() => entryOf(shown()))
  const link = () => (obj() ? rawLink(obj()!, true) : "")
  const previews = createMemo(() => {
    const o = obj()
    return o
      ? getPreviews({ ...o, provider: objStore.provider }).filter(
          (p) => p.key !== "download",
        )
      : []
  })
  const platform = getPlatform()
  const shownPlayers = () =>
    platform === "Unknown"
      ? players
      : players.filter((p) => p.platforms.includes(platform))

  return (
    <Dialog
      open={!!dialogPath()}
      onOpenChange={(o) => {
        if (!o) closeCurrent()
      }}
    >
      <DialogContent
        data-testid="unknown-dialog"
        class="max-w-sm gap-4 p-5"
        ref={(el: HTMLDivElement) => (box = el)}
        onOpenAutoFocus={(e: Event) => {
          // the dialog takes the focus, so the first Escape closes it
          e.preventDefault()
          box?.focus()
        }}
      >
        <div class="flex items-start gap-3 pr-8">
          <TbFileUnknown class="size-10 shrink-0 text-muted-foreground" />
          <div class="min-w-0">
            <DialogTitle class="break-all text-base">{obj()?.name}</DialogTitle>
            <DialogDescription class="mt-1 text-xs">
              {[
                (
                  ext(obj()?.name ?? "") || t("home.viewer.no_extension")
                ).toUpperCase(),
                getFileSize(obj()?.size ?? 0),
                formatDate(obj()?.modified ?? ""),
              ].join(" · ")}
              <br />
              {t("home.viewer.no_preview")}
            </DialogDescription>
          </div>
        </div>
        <Show when={previewDenied()}>
          <p class="text-sm text-muted-foreground">
            {t("shares.preview_disabled")}
          </p>
        </Show>
        <Show
          when={!downloadDenied()}
          fallback={
            <p class="text-sm text-muted-foreground">
              {t("shares.download_disabled")}
            </p>
          }
        >
          <div class="grid gap-2">
            <Button
              data-testid="unknown-download"
              class="gap-2"
              onClick={() => obj() && downloadObjs([obj()!])}
            >
              <TbDownload class="size-4" />
              {t("files.download")}
            </Button>
            <div class="grid grid-cols-2 gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  as={Button}
                  variant="outline"
                  class="gap-2"
                  data-action="players"
                >
                  <TbExternalLink class="size-4" />
                  {t("home.viewer.players")}
                </DropdownMenuTrigger>
                <DropdownMenuContent class="max-h-[60vh] overflow-y-auto">
                  <For each={shownPlayers()}>
                    {(p) => (
                      <DropdownMenuItem
                        as="a"
                        class="gap-2.5"
                        href={convertURL(p.scheme, {
                          raw_url: objStore.raw_url || link(),
                          name: obj()?.name ?? "",
                          d_url: link(),
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
                  <Show when={previews().length}>
                    <DropdownMenuSeparator />
                    <For each={previews()}>
                      {(p) => (
                        <DropdownMenuItem
                          data-action="open_with"
                          onSelect={() => shown() && openWith(shown()!, p.key)}
                        >
                          {p.name}
                        </DropdownMenuItem>
                      )}
                    </For>
                  </Show>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                class="gap-2"
                data-action="copy_link"
                onClick={async () => {
                  await copy(link())
                  setCopied(true)
                }}
              >
                <TbCopy class="size-4" />
                <Show when={copied()} fallback={t("home.viewer.copy_link")}>
                  {t("home.viewer.copied")}
                </Show>
              </Button>
            </div>
          </div>
        </Show>
      </DialogContent>
    </Dialog>
  )
}
