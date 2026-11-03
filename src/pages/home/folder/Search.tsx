import { TbSearch } from "solid-icons/tb"
import {
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import Mark from "mark.js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DataState } from "~/components/ui/data-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { focusRing } from "~/components/ui/focus"
import { Input } from "~/components/ui/input"
import { SimpleSelect } from "~/components/ui/simple-select"
import { Skeleton } from "~/components/ui/skeleton"
import { LinkWithBase, Paginator } from "~/components"
import { useFetch, usePath, useRouter, useT } from "~/hooks"
import { me, password } from "~/store"
import { SearchNode } from "~/types"
import {
  bus,
  encodePath,
  fsSearch,
  getFileSize,
  handleResp,
  pathJoin,
} from "~/utils"
import { cn } from "~/utils/cn"
import { shellActive } from "~/features/shell/topbar-slot"
import { isMac } from "~/utils/compatibility"
import { getIconByObj } from "~/utils/icon"

function NodeName(props: { keywords: string; name: string }) {
  let ref: HTMLSpanElement
  onMount(() => {
    const mark = new Mark(ref!)
    mark.mark(props.keywords, {
      separateWordSearch: true,
      diacritics: true,
    })
  })
  return (
    <span
      ref={ref!}
      class="[&_mark]:rounded [&_mark]:bg-primary/15 [&_mark]:px-px [&_mark]:font-bold [&_mark]:text-primary"
    >
      {props.name}
    </span>
  )
}

const SearchResult = (props: { node: SearchNode; keywords: string }) => {
  const { setPathAs } = usePath()
  return (
    <LinkWithBase
      class={cn(
        focusRing,
        "flex w-full items-center gap-2 rounded-md border-b px-2 py-1.5 text-foreground no-underline hover:bg-accent hover:no-underline",
      )}
      href={`${props.node.path}?from=search`}
      onMouseEnter={() => {
        setPathAs(props.node.path, props.node.is_dir)
      }}
    >
      <Dynamic
        component={getIconByObj(props.node)}
        class="size-6 shrink-0 text-primary"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="break-all text-sm">
          <NodeName keywords={props.keywords} name={props.node.name} />
          <Show when={props.node.size > 0 || !props.node.is_dir}>
            <Badge variant="info" class="ml-2">
              {getFileSize(props.node.size)}
            </Badge>
          </Show>
        </div>
        <div class="break-all text-xs text-muted-foreground">
          {props.node.parent}
        </div>
      </div>
    </LinkWithBase>
  )
}

const Search = () => {
  const pageSize = 100
  const [isOpen, setOpen] = createSignal(false)
  const onOpen = () => setOpen(true)
  const onToggle = () => setOpen(!isOpen())
  const t = useT()
  const handler = (name: string) => {
    if (name === "search") {
      onOpen()
    }
  }
  const searchFor = (query: string) => {
    setKeywords(query)
    onOpen()
    void search()
  }
  bus.on("tool", handler)
  bus.on("search", searchFor)
  const searchEvent = (e: KeyboardEvent) => {
    // Inside the shell Ctrl/Cmd+K belongs to the command palette; file search
    // moves to Ctrl/Cmd+Shift+K. Guests (no shell) keep Ctrl/Cmd+K.
    if (
      (e.ctrlKey || (isMac && e.metaKey)) &&
      e.shiftKey === shellActive() &&
      e.key.toLowerCase() === "k"
    ) {
      e.preventDefault()
      onToggle()
    }
  }
  document.addEventListener("keydown", searchEvent)
  onCleanup(() => {
    bus.off("tool", handler)
    bus.off("search", searchFor)
    document.removeEventListener("keydown", searchEvent)
  })
  const [keywords, setKeywords] = createSignal("")
  const { pathname } = useRouter()
  const [loading, searchReq] = useFetch(fsSearch)
  const [data, setData] = createSignal({
    content: [] as SearchNode[],
    total: 0,
  })
  const [scope, setScope] = createSignal(0)
  const scopes = ["all", "folder", "file"]
  let resetPaginator: () => void
  const search = async (page = 1) => {
    page === 1 && resetPaginator?.()
    if (loading()) return
    setData({
      content: [],
      total: 0,
    })
    const resp = await searchReq(
      pathname(),
      keywords(),
      password(),
      scope(),
      page,
      pageSize,
    )
    handleResp(resp, (data) => {
      const content = data.content
      if (!content) {
        return
      }
      content.forEach((node) => {
        if (me().base_path && node.parent.startsWith(me().base_path)) {
          const pattern = new RegExp("^" + me().base_path)
          node.parent = node.parent.replace(pattern, "") || "/"
          if (!node.parent.startsWith("/")) {
            node.parent = "/" + node.parent
          }
        }
        node.path = encodePath(pathJoin(node.parent, node.name))
      })
      setData(data)
    })
  }
  return (
    <Dialog open={isOpen()} onOpenChange={setOpen}>
      <DialogContent class="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("home.search.search")}</DialogTitle>
          <DialogDescription class="sr-only">
            {t("home.search.search")}
          </DialogDescription>
        </DialogHeader>
        <div class="flex items-center gap-2">
          <SimpleSelect
            class="w-32 shrink-0"
            aria-label={t("home.search.search")}
            value={String(scope())}
            onChange={(v) => setScope(Number(v))}
            options={scopes.map((v, i) => ({
              value: String(i),
              label: t(`home.search.scopes.${v}`),
            }))}
          />
          <Input
            id="search-input"
            autofocus
            value={keywords()}
            onInput={(e) => {
              setKeywords(e.currentTarget.value)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && keywords().length !== 0) {
                search()
              }
            }}
          />
          <Button
            size="icon"
            class="shrink-0"
            aria-label="search"
            onClick={() => search()}
            disabled={loading() || keywords().length === 0}
          >
            <TbSearch class="size-4" />
          </Button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <Switch>
            <Match when={loading()}>
              <div class="flex flex-col gap-2" aria-busy="true">
                <For each={[0, 1, 2, 3]}>
                  {() => <Skeleton class="h-12 w-full" />}
                </For>
              </div>
            </Match>
            <Match when={data().content.length === 0}>
              <DataState empty emptyText={t("home.search.no_result")}>
                {null}
              </DataState>
            </Match>
          </Switch>
          <div class="flex w-full flex-col">
            <For each={data().content}>
              {(item) => <SearchResult node={item} keywords={keywords()} />}
            </For>
          </div>
          <Paginator
            total={data().total}
            defaultPageSize={pageSize}
            onChange={(page) => {
              search(page)
            }}
            setResetCallback={(reset) => (resetPaginator = reset)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { Search }
