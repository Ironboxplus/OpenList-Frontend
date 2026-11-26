// The share dialog's 11 settings (pages/home/toolbar/Share.tsx:126-269) grouped
// by what they act on, research 05 §二/§六: the access limits people set every
// time are in view (code, expiry, visit count); the rest is folded into its
// group's advanced part. A search finds folded items and opens their group.
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  type JSX,
} from "solid-js"
import { createStore } from "solid-js/store"
import * as DialogPrimitive from "@kobalte/core/dialog"
import { TbCopy, TbRefresh, TbSearch } from "solid-icons/tb"
import { Button } from "~/components/ui/button"
import { DialogCloseButton, DialogOverlay } from "~/components/ui/dialog"
import { Input, Textarea } from "~/components/ui/input"
import { SimpleSelect } from "~/components/ui/simple-select"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"
import { cn } from "~/utils/cn"
import { r } from "~/utils"
import { AdvancedGroup } from "./AdvancedGroup"
import { copyText } from "./files"
import { setShareFor, shareFor } from "./state"
import { DIALOG_MOTION, IconButton } from "./ui"

interface Form {
  pwd: string
  expires: string // "", "1d", "7d", "30d"
  max_accessed: number
  burn_after_read: boolean
  id: string
  remark: string
  order_by: string
  order_direction: string
  extract_folder: string
  readme: string
  header: string
}

const DEFAULTS: Form = {
  pwd: "",
  expires: "",
  max_accessed: 0,
  burn_after_read: false,
  id: "",
  remark: "",
  order_by: "",
  order_direction: "",
  extract_folder: "",
  readme: "",
  header: "",
}

type GroupId = "access" | "link" | "page"
type Key = keyof Form

interface Field {
  key: Key
  label: string
  /** More words the search answers to. */
  words?: string
  group: GroupId
  advanced: boolean
}

const FIELDS: Field[] = [
  {
    key: "pwd",
    label: "提取码",
    words: "密码 password",
    group: "access",
    advanced: false,
  },
  {
    key: "expires",
    label: "有效期",
    words: "过期 到期",
    group: "access",
    advanced: false,
  },
  {
    key: "max_accessed",
    label: "最多访问次数",
    words: "次数 限制",
    group: "access",
    advanced: false,
  },
  {
    key: "burn_after_read",
    label: "阅后即焚",
    words: "一次",
    group: "access",
    advanced: true,
  },
  {
    key: "id",
    label: "自定义链接 ID",
    words: "地址 id",
    group: "link",
    advanced: true,
  },
  {
    key: "remark",
    label: "备注",
    words: "说明",
    group: "link",
    advanced: true,
  },
  {
    key: "order_by",
    label: "排序依据",
    words: "排序",
    group: "page",
    advanced: true,
  },
  {
    key: "order_direction",
    label: "排序方向",
    words: "排序 升序 降序",
    group: "page",
    advanced: true,
  },
  {
    key: "extract_folder",
    label: "文件夹位置",
    words: "排序 文件夹",
    group: "page",
    advanced: true,
  },
  {
    key: "readme",
    label: "页面说明",
    words: "readme 介绍",
    group: "page",
    advanced: true,
  },
  {
    key: "header",
    label: "页头说明",
    words: "header 顶部",
    group: "page",
    advanced: true,
  },
]

const GROUPS: { id: GroupId; title: string }[] = [
  { id: "access", title: "访问限制" },
  { id: "link", title: "链接与备注" },
  { id: "page", title: "访客看到的页面" },
]

const EXPIRY = [
  { v: "", label: "不限" },
  { v: "1d", label: "1 天" },
  { v: "7d", label: "7 天" },
  { v: "30d", label: "30 天" },
]

// Kobalte's Select reads "" as nothing chosen and shows an empty box; the
// backend's "" (its default) is shown as this option instead.
const DEFAULT_OPTION = "default"
const fromOption = (v: string) => (v === DEFAULT_OPTION ? "" : v)

const randomCode = () => Math.random().toString(36).slice(2, 6)

export const ShareDialog = () => {
  const [form, setForm] = createStore<Form>({ ...DEFAULTS })
  const [query, setQuery] = createSignal("")
  const [opened, setOpened] = createStore<Record<GroupId, boolean>>({
    access: false,
    link: false,
    page: false,
  })
  const [link, setLink] = createSignal("")
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const changed = (k: Key) => form[k] !== DEFAULTS[k]
  const advancedOf = (g: GroupId) =>
    FIELDS.filter((f) => f.group === g && f.advanced)
  const commonOf = (g: GroupId) =>
    FIELDS.filter((f) => f.group === g && !f.advanced)
  const changedIn = (g: GroupId) =>
    advancedOf(g).filter((f) => changed(f.key)).length

  const hits = createMemo(() => {
    const q = query().trim().toLowerCase()
    if (!q) return new Set<Key>()
    return new Set(
      FIELDS.filter((f) =>
        `${f.label} ${f.words ?? ""}`.toLowerCase().includes(q),
      ).map((f) => f.key),
    )
  })

  const search = (q: string) => {
    setQuery(q)
    const found = hits()
    let first: Key | undefined
    for (const f of FIELDS) {
      if (!found.has(f.key)) continue
      first ??= f.key
      if (f.advanced) setOpened(f.group, true)
    }
    if (first) {
      const key = first
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-field="${key}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      )
    }
  }

  const reset = () => {
    setForm({ ...DEFAULTS })
    setQuery("")
    setOpened({ access: false, link: false, page: false })
    setLink("")
    setError("")
  }

  const create = async () => {
    const files = (shareFor() ?? []).map((e) => e.path)
    const days = parseInt(form.expires)
    setBusy(true)
    setError("")
    const resp: any = await r.post("/share/create", {
      files,
      pwd: form.pwd,
      expires: days
        ? new Date(Date.now() + days * 86400e3).toISOString()
        : null,
      max_accessed: form.max_accessed,
      burn_after_read: form.burn_after_read,
      order_by: form.order_by,
      order_direction: form.order_direction,
      extract_folder: form.extract_folder,
      remark: form.remark,
      readme: form.readme,
      header: form.header,
      ...(form.id ? { id: form.id } : {}),
    })
    setBusy(false)
    if (resp?.code === 200) setLink(`${location.origin}/@s/${resp.data.id}`)
    else setError(resp?.message ?? "创建失败")
  }

  const row = (f: Field, control: JSX.Element) => (
    <div
      role="group"
      aria-label={f.label}
      data-field={f.key}
      class={cn(
        "grid gap-1.5 rounded-md p-1 transition-colors",
        hits().has(f.key) && "bg-primary/10 ring-1 ring-primary",
      )}
    >
      <span class="flex items-center gap-1.5 text-sm">
        {f.label}
        <Show when={changed(f.key)}>
          <span class="size-1.5 rounded-full bg-primary" aria-label="已修改" />
        </Show>
      </span>
      {control}
    </div>
  )

  const control = (f: Field): JSX.Element => {
    switch (f.key) {
      case "pwd":
        return (
          <div class="flex gap-1">
            <Input
              value={form.pwd}
              placeholder="不设"
              onInput={(e) => setForm("pwd", e.currentTarget.value)}
            />
            <IconButton
              label="随机生成"
              onClick={() => setForm("pwd", randomCode())}
            >
              <TbRefresh />
            </IconButton>
          </div>
        )
      case "expires":
        return (
          <div
            class="flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label="有效期"
          >
            <For each={EXPIRY}>
              {(o) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.expires === o.v}
                  class={cn(
                    "h-8 rounded-full border px-3 text-sm transition-colors",
                    form.expires === o.v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-transparent hover:bg-accent",
                  )}
                  onClick={() => setForm("expires", o.v)}
                >
                  {o.label}
                </button>
              )}
            </For>
          </div>
        )
      case "max_accessed":
        return (
          <Input
            type="number"
            min="0"
            value={form.max_accessed}
            placeholder="0 = 不限"
            onInput={(e) =>
              setForm("max_accessed", parseInt(e.currentTarget.value) || 0)
            }
          />
        )
      case "burn_after_read":
        return (
          <Switch
            checked={form.burn_after_read}
            onChange={(v) => setForm("burn_after_read", v)}
            class="flex items-center gap-2"
          >
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
            <SwitchLabel class="text-sm text-muted-foreground">
              第一个访客打开后失效
            </SwitchLabel>
          </Switch>
        )
      case "order_by":
        return (
          <SimpleSelect
            aria-label={f.label}
            value={form.order_by || DEFAULT_OPTION}
            onChange={(v) => setForm("order_by", fromOption(v))}
            options={[
              { value: DEFAULT_OPTION, label: "默认" },
              { value: "name", label: "名称" },
              { value: "size", label: "大小" },
              { value: "modified", label: "修改时间" },
            ]}
          />
        )
      case "order_direction":
        return (
          <SimpleSelect
            aria-label={f.label}
            value={form.order_direction || DEFAULT_OPTION}
            onChange={(v) => setForm("order_direction", fromOption(v))}
            options={[
              { value: DEFAULT_OPTION, label: "默认" },
              { value: "asc", label: "升序" },
              { value: "desc", label: "降序" },
            ]}
          />
        )
      case "extract_folder":
        return (
          <SimpleSelect
            aria-label={f.label}
            value={form.extract_folder || DEFAULT_OPTION}
            onChange={(v) => setForm("extract_folder", fromOption(v))}
            options={[
              { value: DEFAULT_OPTION, label: "默认" },
              { value: "front", label: "文件夹在前" },
              { value: "back", label: "文件夹在后" },
            ]}
          />
        )
      case "readme":
      case "header":
        return (
          <Textarea
            value={form[f.key as "readme" | "header"]}
            placeholder="Markdown"
            onInput={(e) =>
              setForm(f.key as "readme" | "header", e.currentTarget.value)
            }
          />
        )
      default:
        return (
          <Input
            value={String(form[f.key])}
            placeholder={f.key === "id" ? "留空则随机" : ""}
            onInput={(e) =>
              setForm(f.key as "id" | "remark", e.currentTarget.value)
            }
          />
        )
    }
  }

  const targets = () => shareFor() ?? []
  // a fresh form each time it opens (not on close: the old one fades out)
  createEffect(on(shareFor, (t) => t && reset()))

  return (
    <DialogPrimitive.Root
      open={shareFor() !== null}
      onOpenChange={(o) => {
        if (!o) setShareFor(null)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogOverlay class="duration-(--motion-dialog-open) data-[closed]:duration-(--motion-dialog-close)" />
        <div class="fixed inset-0 z-[1500] flex items-center justify-center p-0 sm:p-4">
          <DialogPrimitive.Content
            data-testid="share-dialog"
            data-motion="dialog"
            class={cn(
              "relative flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-background text-foreground shadow-lg outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl sm:border",
              DIALOG_MOTION,
            )}
          >
            <div class="grid gap-3 border-b p-5 pb-4">
              <div class="pr-8">
                <DialogPrimitive.Title class="text-base font-semibold">
                  分享
                </DialogPrimitive.Title>
                <DialogPrimitive.Description class="truncate text-xs text-muted-foreground">
                  {targets().length === 1
                    ? targets()[0]!.name
                    : `${targets()[0]?.name ?? ""} 等 ${targets().length} 项`}
                </DialogPrimitive.Description>
              </div>
              <Show when={!link()}>
                <div class="relative">
                  <TbSearch class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    data-testid="share-search"
                    class="pl-8"
                    placeholder="查找设置"
                    value={query()}
                    onInput={(e) => search(e.currentTarget.value)}
                  />
                </div>
              </Show>
            </div>
            <Show
              when={!link()}
              fallback={
                <div class="grid gap-3 p-5">
                  <div class="text-sm">链接已创建</div>
                  <div class="flex gap-1">
                    <Input readOnly value={link()} data-testid="share-link" />
                    <IconButton
                      label="复制"
                      onClick={() => void copyText(link())}
                    >
                      <TbCopy />
                    </IconButton>
                  </div>
                </div>
              }
            >
              <div class="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5">
                <For each={GROUPS}>
                  {(g) => (
                    <section class="grid gap-2" data-group={g.id}>
                      <Show
                        when={commonOf(g.id).length > 0}
                        fallback={
                          <AdvancedGroup
                            heading
                            title={g.title}
                            count={advancedOf(g.id).length}
                            changed={changedIn(g.id)}
                            open={opened[g.id]}
                            onOpenChange={(o) => setOpened(g.id, o)}
                            testid={`advanced-${g.id}`}
                          >
                            <For each={advancedOf(g.id)}>
                              {(f) => row(f, control(f))}
                            </For>
                          </AdvancedGroup>
                        }
                      >
                        <h3 class="px-1 text-sm font-semibold">{g.title}</h3>
                        <div class="grid gap-3 sm:grid-cols-2">
                          <For each={commonOf(g.id)}>
                            {(f) => (
                              <div
                                class={cn(
                                  f.key === "expires" && "sm:col-span-2",
                                )}
                              >
                                {row(f, control(f))}
                              </div>
                            )}
                          </For>
                        </div>
                        <AdvancedGroup
                          title="高级"
                          count={advancedOf(g.id).length}
                          changed={changedIn(g.id)}
                          open={opened[g.id]}
                          onOpenChange={(o) => setOpened(g.id, o)}
                          testid={`advanced-${g.id}`}
                        >
                          <For each={advancedOf(g.id)}>
                            {(f) => row(f, control(f))}
                          </For>
                        </AdvancedGroup>
                      </Show>
                    </section>
                  )}
                </For>
              </div>
            </Show>
            <div class="flex items-center justify-end gap-2 border-t p-4">
              <Show when={error()}>
                <span class="mr-auto text-sm text-destructive">{error()}</span>
              </Show>
              <DialogPrimitive.CloseButton as={Button} variant="ghost">
                {link() ? "完成" : "取消"}
              </DialogPrimitive.CloseButton>
              <Show when={!link()}>
                <Button
                  data-testid="share-create"
                  disabled={busy()}
                  onClick={create}
                >
                  创建链接
                </Button>
              </Show>
            </div>
            <DialogCloseButton />
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
