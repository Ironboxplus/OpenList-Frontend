// The share dialog (the prototype's ShareDialog.tsx, run 45866187867): the
// share's settings grouped by what they act on (research 05 §二/§六). The
// limits people set every time are in view (code, expiry, visit count); the
// rest is folded into its group's advanced part, which says how many of its
// items changed. A search finds folded items and opens their group. The order
// of the files is one control (VisitorOrder). Opened by the "share" tool with
// the selection; replaces the hope dialog of pages/home/toolbar/Share.tsx.
import { TbCopy, TbRefresh, TbSearch } from "solid-icons/tb"
import {
  batch,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  type JSX,
} from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "~/components/ui/button"
import { AdvancedGroup } from "~/components/ui/advanced-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input, Textarea } from "~/components/ui/input"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"
import { useFetch, useRouter, useT, useUtil } from "~/hooks"
import { getSetting, me, selectedObjs } from "~/store"
import type { PResp, Share, ShareInfo } from "~/types"
import {
  bus,
  getExpireDate,
  handleResp,
  makeTemplateData,
  matchTemplate,
  r,
  randomPwd,
} from "~/utils"
import { cn } from "~/utils/cn"
import { orderChanges, VisitorOrder } from "./VisitorOrder"

interface Form {
  pwd: string
  /** As typed: a date, or a time from now (getExpireDate). */
  expires: string
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
type FieldKey =
  | "pwd"
  | "expires"
  | "max_accessed"
  | "burn_after_read"
  | "id"
  | "remark"
  | "order"
  | "readme"
  | "header"

interface Field {
  key: FieldKey
  labelKey: string
  /** More words the search answers to (besides the label). */
  words?: string
  group: GroupId
  advanced: boolean
}

const FIELDS: Field[] = [
  {
    key: "pwd",
    labelKey: "shares.pwd",
    words: "password code",
    group: "access",
    advanced: false,
  },
  {
    key: "expires",
    labelKey: "shares.expires",
    words: "expire date",
    group: "access",
    advanced: false,
  },
  {
    key: "max_accessed",
    labelKey: "shares.max_accessed",
    words: "visits limit",
    group: "access",
    advanced: false,
  },
  {
    key: "burn_after_read",
    labelKey: "shares.burn_after_read",
    words: "once",
    group: "access",
    advanced: true,
  },
  {
    key: "id",
    labelKey: "shares.id",
    words: "link address",
    group: "link",
    advanced: true,
  },
  {
    key: "remark",
    labelKey: "shares.remark",
    words: "note",
    group: "link",
    advanced: true,
  },
  {
    key: "order",
    labelKey: "shares.visitor_order",
    words: "order sort folder",
    group: "page",
    advanced: true,
  },
  {
    key: "readme",
    labelKey: "shares.readme",
    words: "readme markdown",
    group: "page",
    advanced: true,
  },
  {
    key: "header",
    labelKey: "shares.header",
    words: "header markdown",
    group: "page",
    advanced: true,
  },
]

const GROUPS: { id: GroupId; titleKey: string }[] = [
  { id: "access", titleKey: "shares.group_access" },
  { id: "link", titleKey: "shares.group_link" },
  { id: "page", titleKey: "shares.group_page" },
]

/** How many settings a field holds that are not at their default. */
const changesOf = (form: Form, key: FieldKey) =>
  key === "order" ? orderChanges(form) : form[key] !== DEFAULTS[key] ? 1 : 0

export const ShareDialog = () => {
  const t = useT()
  const { pathname } = useRouter()
  const { copy } = useUtil()
  const [open, setOpen] = createSignal(false)
  const [files, setFiles] = createSignal<string[]>([])
  const [names, setNames] = createSignal<string[]>([])
  const [form, setForm] = createStore<Form>({ ...DEFAULTS })
  const [query, setQuery] = createSignal("")
  const [opened, setOpened] = createStore<Record<GroupId, boolean>>({
    access: false,
    link: false,
    page: false,
  })
  const [link, setLink] = createSignal("")
  const expiresAt = createMemo(() => {
    if (!form.expires) return null
    const d = getExpireDate(form.expires)
    return isNaN(d.getTime()) ? undefined : d.toISOString()
  })

  const handler = (name: string) => {
    if (name !== "share") return
    batch(() => {
      const objs = selectedObjs()
      setFiles(
        objs.map((obj) => {
          const split =
            pathname().endsWith("/") || obj.name.startsWith("/") ? "" : "/"
          return `${me().base_path}${pathname()}${split}${obj.name}`
        }),
      )
      setNames(objs.map((o) => o.name))
      setForm({ ...DEFAULTS })
      setQuery("")
      setOpened({ access: false, link: false, page: false })
      setLink("")
      setOpen(true)
    })
  }
  bus.on("tool", handler)
  onCleanup(() => bus.off("tool", handler))

  const [creating, create] = useFetch((): PResp<ShareInfo> => {
    const body: Partial<Share> & Record<string, unknown> = {
      files: files(),
      pwd: form.pwd,
      expires: expiresAt() ?? null,
      max_accessed: form.max_accessed,
      burn_after_read: form.burn_after_read,
      remark: form.remark,
      readme: form.readme,
      header: form.header,
      order_by: form.order_by as Share["order_by"],
      order_direction: form.order_direction as Share["order_direction"],
      extract_folder: form.extract_folder as Share["extract_folder"],
    }
    if (form.id) body.id = form.id
    return r.post("/share/create", body)
  })
  const submit = async () => {
    handleResp(await create(), (data) => {
      const templateData = makeTemplateData(data, {
        site_title: getSetting("site_title"),
      })
      setLink(matchTemplate(getSetting("share_summary_content"), templateData))
    })
  }

  const advancedOf = (g: GroupId) =>
    FIELDS.filter((f) => f.group === g && f.advanced)
  const commonOf = (g: GroupId) =>
    FIELDS.filter((f) => f.group === g && !f.advanced)
  const changedIn = (g: GroupId) =>
    advancedOf(g).reduce((n, f) => n + changesOf(form, f.key), 0)
  const countIn = (g: GroupId) =>
    advancedOf(g).reduce((n, f) => n + (f.key === "order" ? 3 : 1), 0)

  const hits = createMemo(() => {
    const q = query().trim().toLowerCase()
    if (!q) return new Set<FieldKey>()
    return new Set(
      FIELDS.filter((f) =>
        `${t(f.labelKey)} ${f.words ?? ""}`.toLowerCase().includes(q),
      ).map((f) => f.key),
    )
  })

  const search = (q: string) => {
    setQuery(q)
    let first: FieldKey | undefined
    for (const f of FIELDS) {
      if (!hits().has(f.key)) continue
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

  const row = (f: Field, control: JSX.Element) => (
    <div
      role="group"
      aria-label={t(f.labelKey)}
      data-field={f.key}
      class={cn(
        "grid gap-1.5 rounded-md p-1 transition-colors",
        hits().has(f.key) && "bg-primary/10 ring-1 ring-primary",
      )}
    >
      <span class="flex items-center gap-1.5 text-sm">
        {t(f.labelKey)}
        <Show when={changesOf(form, f.key) > 0}>
          <span class="size-1.5 rounded-full bg-primary" />
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
              onInput={(e) => setForm("pwd", e.currentTarget.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("shares.random_pwd")}
              title={t("shares.random_pwd")}
              class="shrink-0"
              onClick={() => setForm("pwd", randomPwd())}
            >
              <TbRefresh class="size-4" />
            </Button>
          </div>
        )
      case "expires":
        return (
          <Input
            value={form.expires}
            aria-invalid={expiresAt() === undefined}
            placeholder={t("shares.expires_never")}
            title={t("shares.expires_help")}
            onInput={(e) => setForm("expires", e.currentTarget.value)}
          />
        )
      case "max_accessed":
        return (
          <Input
            type="number"
            min="0"
            // 0 is unlimited: an empty box that says so
            value={form.max_accessed || ""}
            placeholder={t("shares.max_accessed_unlimited")}
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
              {t("shares.burn_after_read_help")}
            </SwitchLabel>
          </Switch>
        )
      case "order":
        return (
          <VisitorOrder value={form} onChange={(patch) => setForm(patch)} />
        )
      case "readme":
      case "header":
        return (
          <Textarea
            value={form[f.key]}
            placeholder="Markdown"
            onInput={(e) => setForm(f.key as "readme", e.currentTarget.value)}
          />
        )
      default:
        return (
          <Input
            value={form[f.key as "id" | "remark"]}
            maxLength={f.key === "id" ? 64 : undefined}
            placeholder={f.key === "id" ? t("shares.id_placeholder") : ""}
            onInput={(e) =>
              setForm(f.key as "id" | "remark", e.currentTarget.value)
            }
          />
        )
    }
  }

  const groupBody = (g: GroupId) => (
    <For each={advancedOf(g)}>{(f) => row(f, control(f))}</For>
  )

  return (
    <Dialog open={open()} onOpenChange={(o) => setOpen(o)}>
      <DialogContent
        data-testid="share-dialog"
        class="flex max-h-[100dvh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]"
      >
        <div class="grid gap-3 border-b p-5 pb-4">
          <div class="pr-8">
            <DialogTitle class="text-base">
              {t("home.toolbar.share")}
            </DialogTitle>
            <DialogDescription class="truncate text-xs">
              {names()[0] ?? ""}
              {names().length > 1
                ? t("shares.files_etc", { more: names().length - 1 })
                : ""}
            </DialogDescription>
          </div>
          <Show when={!link()}>
            <div class="relative">
              <TbSearch class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-testid="share-search"
                class="pl-8"
                placeholder={t("shares.find_setting")}
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
              <div class="text-sm">{t("shares.link_created")}</div>
              <Textarea readOnly value={link()} data-testid="share-link" />
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
                        title={t(g.titleKey)}
                        count={countIn(g.id)}
                        changed={changedIn(g.id)}
                        open={opened[g.id]}
                        onOpenChange={(o) => setOpened(g.id, o)}
                        testid={`advanced-${g.id}`}
                      >
                        {groupBody(g.id)}
                      </AdvancedGroup>
                    }
                  >
                    <h3 class="px-1 text-sm font-semibold">{t(g.titleKey)}</h3>
                    <div class="grid gap-3 sm:grid-cols-2">
                      <For each={commonOf(g.id)}>
                        {(f) => (
                          <div
                            class={cn(f.key === "expires" && "sm:col-span-2")}
                          >
                            {row(f, control(f))}
                          </div>
                        )}
                      </For>
                    </div>
                    <AdvancedGroup
                      title={t("shares.advanced")}
                      count={countIn(g.id)}
                      changed={changedIn(g.id)}
                      open={opened[g.id]}
                      onOpenChange={(o) => setOpened(g.id, o)}
                      testid={`advanced-${g.id}`}
                    >
                      {groupBody(g.id)}
                    </AdvancedGroup>
                  </Show>
                </section>
              )}
            </For>
          </div>
        </Show>
        <div class="flex items-center justify-end gap-2 border-t p-4">
          <Show
            when={link()}
            fallback={
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  {t("global.cancel")}
                </Button>
                <Button
                  data-testid="share-create"
                  disabled={expiresAt() === undefined || creating()}
                  onClick={() => void submit()}
                >
                  {t("shares.create_link")}
                </Button>
              </>
            }
          >
            <Button
              variant="outline"
              class="gap-2"
              onClick={() => copy(link())}
            >
              <TbCopy class="size-4" />
              {t("shares.copy_msg")}
            </Button>
            <Button onClick={() => setOpen(false)}>{t("shares.done")}</Button>
          </Show>
        </div>
      </DialogContent>
    </Dialog>
  )
}
