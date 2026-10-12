import { TbChevronDown, TbChevronRight } from "solid-icons/tb"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DataState } from "~/components/ui/data-state"
import { focusRing } from "~/components/ui/focus"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { useRouter, useT } from "~/hooks"
import type { ErrorCategory } from "~/platform/contracts/task"
import { cn } from "~/utils/cn"
import { createViewport } from "../shell/viewport"
import { errorCenter } from "./service"
import { errorCenterOpen, setErrorCenterOpen } from "./state"
import type { ErrorRecord } from "./store"

const Item = (props: { rec: ErrorRecord; onGo: (href: string) => void }) => {
  const t = useT()
  const [open, setOpen] = createSignal(false)
  return (
    <li
      data-testid="error-item"
      data-unread={props.rec.read ? undefined : ""}
      class={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm",
        !props.rec.read && "border-destructive/40",
      )}
    >
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant={props.rec.read ? "secondary" : "destructive"}>
          {t(`shell.error_center.category.${props.rec.category}`)}
        </Badge>
        <Show when={props.rec.count > 1}>
          <span class="text-xs text-muted-foreground">
            {t("shell.error_center.times", { count: props.rec.count })}
          </span>
        </Show>
        <span class="ml-auto text-xs text-muted-foreground">
          {new Date(props.rec.at).toLocaleString()}
        </span>
      </div>
      <p class="m-0 break-words">{props.rec.message}</p>
      <p class="m-0 break-all text-xs text-muted-foreground">
        {props.rec.source}
      </p>
      <Show when={props.rec.detail}>
        <button
          type="button"
          aria-expanded={open()}
          class={cn(
            focusRing,
            "flex w-fit items-center gap-1 rounded-sm bg-transparent text-xs text-primary",
          )}
          onClick={() => setOpen(!open())}
        >
          <Show when={open()} fallback={<TbChevronRight class="size-3.5" />}>
            <TbChevronDown class="size-3.5" />
          </Show>
          {open()
            ? t("shell.error_center.hide_detail")
            : t("shell.error_center.show_detail")}
        </button>
        <Show when={open()}>
          <pre
            data-testid="error-detail"
            class="m-0 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-xs"
          >
            {props.rec.detail}
          </pre>
        </Show>
      </Show>
      <Show when={props.rec.href}>
        {(href) => (
          <Button
            size="sm"
            variant="outline"
            class="w-fit"
            data-testid="error-open"
            onClick={() => props.onGo(href())}
          >
            {t("shell.error_center.open_link")}
          </Button>
        )}
      </Show>
    </li>
  )
}

/** Recent errors, newest first: right drawer on tablet / desktop, bottom sheet on a phone. */
const ErrorCenter = () => {
  const t = useT()
  const { to } = useRouter()
  const viewport = createViewport()
  const [category, setCategory] = createSignal<ErrorCategory>()

  // Only the categories that occur get a chip; a chip whose last record is
  // gone falls back to "all" instead of leaving an empty list behind.
  const categories = createMemo(() => [
    ...new Set(errorCenter.records().map((r) => r.category)),
  ])
  const active = () => {
    const c = category()
    return c && categories().includes(c) ? c : undefined
  }
  const shown = createMemo(() =>
    errorCenter.records().filter((r) => !active() || r.category === active()),
  )
  const go = (href: string) => {
    setErrorCenterOpen(false)
    to(href)
  }
  const chip = (selected: boolean) =>
    cn(
      focusRing,
      "shrink-0 rounded-full border px-3 py-1 text-sm text-foreground transition-colors",
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-card hover:bg-accent",
    )

  return (
    <Sheet open={errorCenterOpen()} onOpenChange={setErrorCenterOpen}>
      <SheetContent
        side={viewport() === "phone" ? "bottom" : "right"}
        class={cn(
          "flex flex-col gap-4",
          viewport() === "phone"
            ? "max-h-[85vh] rounded-t-xl"
            : "w-[420px] max-w-full sm:max-w-[420px]",
        )}
      >
        <SheetHeader>
          <SheetTitle>{t("shell.error_center.title")}</SheetTitle>
          <p class="text-sm text-muted-foreground">
            {t("shell.error_center.unread", {
              count: errorCenter.unreadCount(),
            })}
          </p>
        </SheetHeader>
        <div class="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid="error-mark-read"
            disabled={errorCenter.unreadCount() === 0}
            onClick={() => errorCenter.markAllRead()}
          >
            {t("shell.error_center.mark_all_read")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="error-clear"
            disabled={errorCenter.records().length === 0}
            onClick={() => errorCenter.clear()}
          >
            {t("shell.error_center.clear")}
          </Button>
        </div>
        <Show when={categories().length > 1}>
          <div
            role="tablist"
            class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              role="tab"
              data-chip="all"
              aria-selected={!active()}
              class={chip(!active())}
              onClick={() => setCategory(undefined)}
            >
              {t("shell.error_center.all")}
            </button>
            <For each={categories()}>
              {(c) => (
                <button
                  type="button"
                  role="tab"
                  data-chip={c}
                  aria-selected={active() === c}
                  class={chip(active() === c)}
                  onClick={() => setCategory(c)}
                >
                  {t(`shell.error_center.category.${c}`)}
                </button>
              )}
            </For>
          </div>
        </Show>
        <div class="flex-1 overflow-y-auto" data-testid="error-list">
          <DataState
            empty={shown().length === 0}
            emptyText={t("shell.error_center.empty")}
          >
            <ul class="m-0 flex list-none flex-col gap-3 p-0">
              <For each={shown()}>{(rec) => <Item rec={rec} onGo={go} />}</For>
            </ul>
          </DataState>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default ErrorCenter
