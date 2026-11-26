// A file nothing here can show (§0 下载, research 03 §八.5): a small dialog
// with the three things one can still do with it, no page of its own.
import { For, Show, createEffect, createSignal, on } from "solid-js"
import * as DialogPrimitive from "@kobalte/core/dialog"
import {
  TbCopy,
  TbDownload,
  TbExternalLink,
  TbFileUnknown,
} from "solid-icons/tb"
import { Button } from "~/components/ui/button"
import { DialogCloseButton, DialogOverlay } from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { cn } from "~/utils/cn"
import { externalPlayers } from "~/utils/players"
import {
  copyText,
  download,
  extOf,
  externalHref,
  linkOf,
  type Entry,
} from "./files"
import { closeCurrent, dialogPath, entryAt } from "./state"
import { DIALOG_MOTION, MENU_MOTION, formatSize, formatTime } from "./ui"

export const UnknownDialog = () => {
  const [shown, setShown] = createSignal<Entry>()
  const [copied, setCopied] = createSignal(false)
  // keep the last file while the dialog animates out
  createEffect(
    on(dialogPath, (p) => {
      const e = entryAt(p)
      if (e) {
        setShown(e)
        setCopied(false)
      }
    }),
  )
  return (
    <DialogPrimitive.Root
      open={dialogPath() !== null}
      onOpenChange={(o) => {
        if (!o) closeCurrent()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogOverlay class="duration-(--motion-dialog-open) data-[closed]:duration-(--motion-dialog-close)" />
        <div class="fixed inset-0 z-[1500] flex items-center justify-center p-4">
          <DialogPrimitive.Content
            data-testid="unknown-dialog"
            data-motion="dialog"
            class={cn(
              "relative grid w-full max-w-sm gap-4 rounded-xl border bg-background p-5 text-foreground shadow-lg outline-none",
              DIALOG_MOTION,
            )}
          >
            <div class="flex items-start gap-3 pr-8">
              <TbFileUnknown class="size-10 shrink-0 text-muted-foreground" />
              <div class="min-w-0">
                <DialogPrimitive.Title class="break-all text-base font-semibold">
                  {shown()?.name}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description class="mt-1 text-xs text-muted-foreground">
                  {(extOf(shown()?.name ?? "") || "无扩展名").toUpperCase()} ·{" "}
                  {formatSize(shown()?.size ?? 0)} ·{" "}
                  {formatTime(shown()?.modified ?? "")}
                  <br />
                  没有可用的预览
                </DialogPrimitive.Description>
              </div>
            </div>
            <div class="grid gap-2">
              <Button
                data-testid="unknown-download"
                class="gap-2"
                onClick={() => shown() && download(shown()!)}
              >
                <TbDownload class="size-4" />
                下载
              </Button>
              <div class="grid grid-cols-2 gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    as={Button}
                    variant="outline"
                    class="gap-2"
                  >
                    <TbExternalLink class="size-4" />
                    外部播放器
                  </DropdownMenuTrigger>
                  <DropdownMenuContent class={MENU_MOTION}>
                    <For each={externalPlayers.filter((p) => !p.requiresItem)}>
                      {(p) => (
                        <DropdownMenuItem
                          as="a"
                          href={
                            shown()
                              ? externalHref(
                                  p.scheme,
                                  linkOf(shown()!),
                                  shown()!.name,
                                )
                              : undefined
                          }
                        >
                          {p.name}
                        </DropdownMenuItem>
                      )}
                    </For>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  class="gap-2"
                  onClick={async () =>
                    shown() && setCopied(await copyText(linkOf(shown()!)))
                  }
                >
                  <TbCopy class="size-4" />
                  <Show when={copied()} fallback="复制链接">
                    已复制
                  </Show>
                </Button>
              </div>
            </div>
            <DialogCloseButton />
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
