import { Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { FullLoading, Paginator } from "~/components"
import { getGlobalPage, usePath, useRouter, useT } from "~/hooks"
import { clearHistory, getPagination, objStore, State } from "~/store"
import { Button } from "~/components/ui/button"

const Pagination = () => {
  const pagination = getPagination()
  const { pathname, setSearchParams } = useRouter()
  return (
    <Paginator
      total={objStore.total}
      defaultCurrent={getGlobalPage()}
      defaultPageSize={pagination.size}
      onChange={(page) => {
        clearHistory(pathname(), page)
        setSearchParams({ page })
      }}
    />
  )
}
const LoadMore = () => {
  const { loadMore, allLoaded } = usePath()
  const t = useT()
  return (
    <Show
      when={!allLoaded()}
      fallback={<p class="italic">{t("home.no_more")}</p>}
    >
      <Button variant="subtle" onClick={loadMore}>
        {t("home.load_more")}
      </Button>
    </Show>
  )
}

const AutoLoadMore = () => {
  const { loadMore, allLoaded } = usePath()
  const t = useT()
  const ob = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    },
    {
      threshold: 0.1,
    },
  )
  let el!: HTMLDivElement
  onMount(() => {
    if (!allLoaded()) {
      ob.observe(el)
    }
  })
  onCleanup(() => {
    ob.disconnect()
  })
  return (
    <Show
      when={!allLoaded()}
      fallback={<p class="italic">{t("home.no_more")}</p>}
    >
      <FullLoading class="py-2" size="md" thickness={3} ref={el} />
    </Show>
  )
}

export const Pager = () => {
  const pagination = getPagination()
  return (
    <Switch>
      <Match when={objStore.state === State.FetchingMore}>
        <FullLoading class="py-2" size="md" thickness={3} />
      </Match>
      <Match when={pagination.type === "pagination"}>
        <Pagination />
      </Match>
      <Match when={pagination.type === "load_more"}>
        <LoadMore />
      </Match>
      <Match when={pagination.type === "auto_load_more"}>
        <AutoLoadMore />
      </Match>
    </Switch>
  )
}
