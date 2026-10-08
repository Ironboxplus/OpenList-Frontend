import { createMemo, createSignal, For, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { focusRing } from "~/components/ui/focus"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"
import { TextField, TextFieldRoot } from "~/components/ui/textfield"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { phoneShell } from "../shell/topbar-slot"
import {
  deleteMedia,
  mediaClient,
  scrapeMedia,
  searchMedia,
  setMediaMeta,
} from "./client"
import { baseName } from "./logic"
import { closeMediaEditor, invalidateMedia, mediaFs, mediaPath } from "./state"
import type { MediaItem, MediaKind, SearchCandidate } from "./types"

const KINDS: MediaKind[] = ["movie", "tv", "anime", "collection", "ignore"]
const PROVIDERS = ["tmdb", "bgm"] as const
type Provider = (typeof PROVIDERS)[number]

const field =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"

/** The command that writes the info from a machine that can reach the provider. */
export const cliCommand = (path: string, provider: string) =>
  `openlist media scrape --path "${path}" --provider ${provider} --env media.env`

const CandidateRow = (props: {
  c: SearchCandidate
  busy: boolean
  onApply: (c: SearchCandidate) => void
}) => {
  const t = useT()
  return (
    <li
      data-candidate={`${props.c.provider}:${props.c.id}`}
      class="flex items-center gap-3 rounded-lg border bg-card p-2"
    >
      <div class="aspect-[2/3] w-10 shrink-0 overflow-hidden rounded bg-muted">
        <Show when={props.c.poster_url}>
          <img
            src={props.c.poster_url}
            alt=""
            loading="lazy"
            class="size-full object-cover"
          />
        </Show>
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">
          {props.c.title}
          <Show when={props.c.year}>
            <span class="ml-1.5 font-normal text-muted-foreground">
              {props.c.year}
            </span>
          </Show>
        </div>
        <div class="truncate text-xs text-muted-foreground">
          {props.c.original_title && props.c.original_title !== props.c.title
            ? props.c.original_title + " · "
            : ""}
          {props.c.provider} {props.c.id}
        </div>
      </div>
      <Button
        size="sm"
        data-apply
        disabled={props.busy}
        onClick={() => props.onApply(props.c)}
      >
        {t("media.editor.apply")}
      </Button>
    </li>
  )
}

export const EditorBody = (props: { path: string }) => {
  const t = useT()
  // The folder on screen already has its item loaded; a child folder (opened
  // from the context menu) is asked for separately.
  const [own, setOwn] = createSignal<MediaItem | null>()
  const loadOwn = () => {
    if (mediaPath() === props.path) return
    mediaClient.invalidate(props.path)
    void mediaClient.get(props.path).then((fs) => setOwn(fs?.item ?? null))
  }
  loadOwn()
  const item = (): MediaItem | undefined =>
    (mediaPath() === props.path ? mediaFs()?.item : own()) ?? undefined
  const [kind, setKind] = createSignal<MediaKind>(item()?.kind ?? "movie")
  const [locked, setLocked] = createSignal(item()?.locked ?? true)
  const [provider, setProvider] = createSignal<Provider>("tmdb")
  const [query, setQuery] = createSignal(item()?.title || baseName(props.path))
  const [results, setResults] = createSignal<SearchCandidate[]>()
  const [searching, setSearching] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [status, setStatus] = createSignal<string>()
  const [netFail, setNetFail] = createSignal(false)
  const [confirmClear, setConfirmClear] = createSignal(false)
  const [copied, setCopied] = createSignal(false)

  const suggested = createMemo<SearchCandidate[]>(() =>
    (item()?.candidates ?? []).map((c) => ({
      provider: c.provider,
      id: c.id,
      title: c.title,
      year: c.year,
      poster_url: c.poster_url,
      score: c.score,
    })),
  )

  const fail = (message?: string, category?: string) => {
    setNetFail(category === "network")
    setStatus(t("media.editor.failed", { message: message ?? "" }))
  }

  const search = async () => {
    const q = query().trim()
    if (!q) return
    setSearching(true)
    setStatus(undefined)
    setNetFail(false)
    const out = await searchMedia(provider(), q, kind())
    setSearching(false)
    if (out.ok) setResults(out.data ?? [])
    else fail(out.message, out.category)
  }

  const apply = async (c: SearchCandidate) => {
    setBusy(true)
    setStatus(undefined)
    setNetFail(false)
    const out = await scrapeMedia(props.path, c.provider, c.id, locked())
    setBusy(false)
    if (!out.ok) return fail(out.message, out.category)
    invalidateMedia(props.path)
    setStatus(t("media.editor.saved"))
    closeMediaEditor()
  }

  const changeKind = async (k: MediaKind) => {
    setKind(k)
    const out = await setMediaMeta({ path: props.path, kind: k })
    if (!out.ok) return fail(out.message, out.category)
    invalidateMedia(props.path)
    loadOwn()
  }

  const changeLock = async (v: boolean) => {
    setLocked(v)
    if (!item()) return // nothing to lock yet: it is applied with the next pick
    const out = await setMediaMeta({ path: props.path, locked: v })
    if (!out.ok) return fail(out.message, out.category)
    invalidateMedia(props.path)
    loadOwn()
  }

  const clear = async () => {
    if (!confirmClear()) return setConfirmClear(true)
    setBusy(true)
    const out = await deleteMedia(props.path)
    setBusy(false)
    if (!out.ok) return fail(out.message, out.category)
    invalidateMedia(props.path)
    closeMediaEditor()
  }

  const command = () => cliCommand(props.path, provider())
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command())
      setCopied(true)
    } catch {
      // the command stays selectable on screen
    }
  }

  return (
    <div class="flex min-w-0 flex-col gap-4" data-media-editor>
      <div class="truncate text-xs text-muted-foreground">{props.path}</div>

      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("media.editor.kind")}
          <select
            data-editor-kind
            class={cn(field, focusRing)}
            value={kind()}
            onChange={(e) =>
              void changeKind(e.currentTarget.value as MediaKind)
            }
          >
            <For each={KINDS}>
              {(k) => (
                <option value={k} selected={k === kind()}>
                  {t(`media.kind.${k}`)}
                </option>
              )}
            </For>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("media.editor.provider")}
          <select
            data-editor-provider
            class={cn(field, focusRing)}
            value={provider()}
            onChange={(e) => setProvider(e.currentTarget.value as Provider)}
          >
            <For each={PROVIDERS}>
              {(p) => (
                <option value={p} selected={p === provider()}>
                  {p === "tmdb" ? "TMDB" : "Bangumi"}
                </option>
              )}
            </For>
          </select>
        </label>
      </div>

      <form
        class="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <TextFieldRoot class="flex-1" value={query()} onChange={setQuery}>
          <TextField
            data-editor-query
            aria-label={t("media.editor.query")}
            placeholder={t("media.editor.query_placeholder")}
          />
        </TextFieldRoot>
        <Button type="submit" data-editor-search disabled={searching()}>
          {searching() ? t("media.editor.searching") : t("media.editor.search")}
        </Button>
      </form>

      <Switch
        class="flex items-center gap-2"
        checked={locked()}
        onChange={(v) => void changeLock(v)}
      >
        <SwitchControl data-editor-lock>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel class="text-sm">
          {t("media.editor.lock")}
          <span class="ml-2 text-xs text-muted-foreground">
            {t("media.editor.lock_hint")}
          </span>
        </SwitchLabel>
      </Switch>

      <Show when={status()}>
        <div
          role="status"
          data-editor-status
          class="rounded-md bg-muted px-3 py-2 text-sm"
        >
          {status()}
        </div>
      </Show>

      <Show when={netFail()}>
        <div
          data-editor-network
          class="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <p class="m-0">
            {t("media.editor.network_hint", {
              provider: provider() === "tmdb" ? "TMDB" : "Bangumi",
            })}
          </p>
          <code class="block break-all rounded bg-muted px-2 py-1 text-xs">
            {command()}
          </code>
          <Button
            size="sm"
            variant="secondary"
            class="self-start"
            onClick={copy}
          >
            {copied() ? t("media.editor.copied") : t("media.editor.copy")}
          </Button>
        </div>
      </Show>

      <Show when={suggested().length > 0}>
        <section class="flex flex-col gap-2" data-editor-suggested>
          <h3 class="m-0 text-sm font-medium">{t("media.editor.suggested")}</h3>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            <For each={suggested()}>
              {(c) => <CandidateRow c={c} busy={busy()} onApply={apply} />}
            </For>
          </ul>
        </section>
      </Show>

      <Show when={results()}>
        {(list) => (
          <section class="flex flex-col gap-2" data-editor-results>
            <h3 class="m-0 text-sm font-medium">{t("media.editor.results")}</h3>
            <Show
              when={list().length > 0}
              fallback={
                <p class="m-0 text-sm text-muted-foreground">
                  {t("media.editor.no_results")}
                </p>
              }
            >
              <ul class="m-0 flex list-none flex-col gap-2 p-0">
                <For each={list()}>
                  {(c) => <CandidateRow c={c} busy={busy()} onApply={apply} />}
                </For>
              </ul>
            </Show>
          </section>
        )}
      </Show>

      <Show when={item()}>
        <div class="flex items-center gap-2 border-t pt-3">
          <Button
            variant={confirmClear() ? "destructive" : "outline"}
            size="sm"
            data-editor-clear
            disabled={busy()}
            onClick={() => void clear()}
          >
            {confirmClear()
              ? t("media.editor.clear_confirm")
              : t("media.editor.clear")}
          </Button>
        </div>
      </Show>
    </div>
  )
}

/** Dialog on tablet and desktop, bottom sheet on phones. */
export const MediaEditor = (props: { path: string }) => {
  const t = useT()
  const onOpenChange = (o: boolean) => {
    if (!o) closeMediaEditor()
  }
  return (
    <Show
      when={phoneShell()}
      fallback={
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("media.editor.title")}</DialogTitle>
            </DialogHeader>
            <EditorBody path={props.path} />
          </DialogContent>
        </Dialog>
      }
    >
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          class="max-h-[90vh] overflow-y-auto rounded-t-xl"
          style={{
            "padding-bottom": "calc(2rem + env(safe-area-inset-bottom))",
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("media.editor.title")}</SheetTitle>
          </SheetHeader>
          <div class="mt-3">
            <EditorBody path={props.path} />
          </div>
        </SheetContent>
      </Sheet>
    </Show>
  )
}
