import { TbRefresh } from "solid-icons/tb"
import { For, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useT } from "~/hooks"
import type { ClusterGroupView, ClusterRefreshView } from "./api"
import { ago, span } from "./cluster-util"

/**
 * Who refreshes this group's credential, and how it is going.
 *
 * 115's refresh_token is single-use, so exactly one member (the refresher)
 * spends it, ahead of expiry, and the rest only pull the result. This panel
 * shows the lease holder, the last refresh, members that fell behind, and the
 * refresh-requests members sent when their token was rejected. The admin can
 * pin a preferred refresher.
 */
export const ClusterRefresher = (props: {
  group: ClusterGroupView
  onPrefer: (groupID: string, nodeID: string) => void
  busy?: boolean
}) => {
  const t = useT()
  const g = () => props.group
  const members = () => {
    // One entry per node: a node may mount the group twice.
    const seen = new Set<string>()
    return g().members.filter((m) => {
      if (seen.has(m.node_id)) return false
      seen.add(m.node_id)
      return true
    })
  }
  const nodeName = (id: string) =>
    g().members.find((m) => m.node_id === id)?.label || id.slice(0, 8)
  const lagging = () => g().members.filter((m) => m.laggard)
  const lease = () => g().refresher
  const outcome = (r: ClusterRefreshView) =>
    r.outcome === "ok"
      ? t("manage.cluster.refresh_ok", { n: span(r.expires_in) })
      : t("manage.cluster.refresh_failed", {
          code: r.err_code || r.outcome,
        })
  const trigger = (r: ClusterRefreshView) =>
    r.trigger === "proactive" ||
    r.trigger === "refresh-request" ||
    r.trigger === "recover"
      ? t(`manage.cluster.trigger_${r.trigger.replace("-", "_")}`)
      : t("manage.cluster.trigger_code", { code: r.trigger })

  return (
    <div
      class="flex flex-col gap-1.5 rounded-md border bg-background/60 p-2.5 text-sm"
      data-testid="cluster-refresher"
    >
      <div class="flex flex-wrap items-center gap-2">
        <TbRefresh class="size-4 text-muted-foreground" />
        <span class="font-medium">{t("manage.cluster.refresher")}</span>
        <Show
          when={lease()?.valid}
          fallback={
            <Badge variant="warning">{t("manage.cluster.no_refresher")}</Badge>
          }
        >
          <Badge variant="success">
            {lease()!.label || nodeName(lease()!.node_id)}
            <Show when={lease()!.self}>
              {" · "}
              {t("manage.cluster.self")}
            </Show>
          </Badge>
          <span class="text-xs text-muted-foreground">
            {t("manage.cluster.lease_info", {
              epoch: lease()!.epoch,
              n: span(lease()!.expires_in),
            })}
          </span>
        </Show>

        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-muted-foreground">
            {t("manage.cluster.preferred")}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              as={Button}
              size="sm"
              variant="outline"
              disabled={props.busy}
            >
              {g().preferred
                ? nodeName(g().preferred!)
                : t("manage.cluster.preferred_auto")}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => props.onPrefer(g().id, "")}>
                {t("manage.cluster.preferred_auto")}
              </DropdownMenuItem>
              <For each={members()}>
                {(m) => (
                  <DropdownMenuItem
                    onSelect={() => props.onPrefer(g().id, m.node_id)}
                  >
                    {m.label || m.node_id.slice(0, 8)}
                  </DropdownMenuItem>
                )}
              </For>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Show
        when={g().last_refresh}
        fallback={
          <p class="text-xs text-muted-foreground">
            {t("manage.cluster.no_refresh_yet")}
          </p>
        }
      >
        {(r) => (
          <p class="text-xs">
            <span class="text-muted-foreground">
              {t("manage.cluster.last_refresh")}:
            </span>{" "}
            {r().label || nodeName(r().node_id)} · {ago(r().time)} ·{" "}
            <Badge
              variant={r().outcome === "ok" ? "success" : "destructive"}
              class="px-1.5 py-0"
            >
              {outcome(r())}
            </Badge>{" "}
            · {trigger(r())}
          </p>
        )}
      </Show>

      <Show when={(g().expires_at ?? 0) > 0}>
        <p class="text-xs text-muted-foreground">
          {t("manage.cluster.token_expires", {
            n: span((g().expires_at ?? 0) - Math.floor(Date.now() / 1000)),
          })}
        </p>
      </Show>

      <Show when={lagging().length > 0}>
        <p class="text-xs text-warning" data-testid="cluster-laggards">
          {t("manage.cluster.laggards", {
            names: lagging()
              .map(
                (m) =>
                  `${m.label || m.node_id.slice(0, 8)} v${m.held_version ?? 0}`,
              )
              .join(", "),
            v: g().version,
          })}
        </p>
      </Show>

      <Show when={g().mixed}>
        <p class="text-xs text-warning">{t("manage.cluster.mixed_warning")}</p>
      </Show>

      <Show when={(g().requests ?? []).length > 0}>
        <div class="flex flex-col gap-0.5 text-xs">
          <span class="text-muted-foreground">
            {t("manage.cluster.requests_title")}
          </span>
          <For each={(g().requests ?? []).slice(0, 5)}>
            {(q) => (
              <div class="flex flex-wrap items-baseline gap-1.5">
                <span class="w-9 shrink-0 text-muted-foreground">
                  {ago(q.time)}
                </span>
                <Badge
                  variant={q.direction === "sent" ? "info" : "secondary"}
                  class="px-1.5 py-0"
                >
                  {q.direction === "sent"
                    ? t("manage.cluster.request_sent")
                    : t("manage.cluster.request_received")}
                </Badge>
                <span>
                  {q.peer_label || (q.peer ? q.peer.slice(0, 8) : "—")} ·{" "}
                  <span class="font-mono">{q.mount}</span> · {q.result}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
