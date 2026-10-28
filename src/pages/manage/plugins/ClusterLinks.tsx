import { createMemo, For, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { SettingsSection } from "~/features/settings/form"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import type { ClusterLinkView, ClusterStatus } from "./api"
import { ago } from "./cluster-util"

/**
 * Per-peer link health: connected or not, direction, round-trip time, pending
 * (coalesced) items, the last anti-entropy exchange, and why and how often the
 * link dropped. Replaces the plain connection list on backends that report it.
 */
export const ClusterLinks = (props: { status: ClusterStatus }) => {
  const t = useT()
  const links = createMemo<ClusterLinkView[]>(() => props.status.links ?? [])
  const nodeName = (id: string) => {
    const n = props.status.nodes.find((x) => x.node_id === id)
    return n?.label || id.slice(0, 8)
  }
  // A link that keeps dropping, or whose last exchange is stale, is highlighted.
  const flapping = (l: ClusterLinkView) => l.flaps_10m >= 3
  const stale = (l: ClusterLinkView) =>
    l.connected &&
    l.last_anti_entropy > 0 &&
    Math.floor(Date.now() / 1000) - l.last_anti_entropy > 180

  return (
    <SettingsSection
      id="cluster-links"
      title={t("manage.cluster.links_title")}
      description={t("manage.cluster.links_hint")}
    >
      <Show
        when={links().length > 0}
        fallback={
          <p class="py-3 text-sm text-muted-foreground">
            {t("manage.cluster.no_connections")}
          </p>
        }
      >
        <div class="overflow-x-auto py-2" data-testid="cluster-links">
          <table class="w-full text-left text-xs">
            <thead class="text-muted-foreground">
              <tr>
                <th class="py-1 pr-3 font-medium">
                  {t("manage.cluster.link_peer")}
                </th>
                <th class="pr-3 font-medium">
                  {t("manage.cluster.link_state")}
                </th>
                <th class="pr-3 font-medium">RTT</th>
                <th class="pr-3 font-medium">
                  {t("manage.cluster.link_queue")}
                </th>
                <th class="pr-3 font-medium">
                  {t("manage.cluster.link_sync")}
                </th>
                <th class="pr-3 font-medium">
                  {t("manage.cluster.link_drops")}
                </th>
                <th class="font-medium">{t("manage.cluster.link_reason")}</th>
              </tr>
            </thead>
            <tbody>
              <For each={links()}>
                {(l) => (
                  <tr class="border-t">
                    <td class="py-1.5 pr-3 font-medium">
                      {l.label || nodeName(l.node_id)}
                      <Show when={l.proto === 1}>
                        <Badge variant="warning" class="ml-1.5 px-1.5 py-0">
                          {t("manage.cluster.legacy")}
                        </Badge>
                      </Show>
                    </td>
                    <td class="pr-3">
                      <span class="flex items-center gap-1.5">
                        <span
                          class={cn(
                            "inline-block size-2 rounded-full",
                            l.connected
                              ? "bg-success"
                              : "bg-muted-foreground/50",
                          )}
                        />
                        {l.connected
                          ? `${l.outbound ? "→" : "←"} ${ago(l.since)}`
                          : t("manage.cluster.link_down")}
                      </span>
                    </td>
                    <td class="pr-3">{l.connected ? `${l.rtt_ms} ms` : "—"}</td>
                    <td class="pr-3">{l.connected ? l.queue_depth : "—"}</td>
                    <td class={cn("pr-3", stale(l) && "text-warning")}>
                      {l.last_anti_entropy ? ago(l.last_anti_entropy) : "—"}
                    </td>
                    <td class={cn("pr-3", flapping(l) && "text-warning")}>
                      {l.disconnects}
                      <Show when={l.flaps_10m > 0}> ({l.flaps_10m} / 10m)</Show>
                    </td>
                    <td class="break-all text-muted-foreground">
                      {l.last_reason || "—"}
                      <Show when={l.last_disconnect_at}>
                        {" · "}
                        {ago(l.last_disconnect_at)}
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </SettingsSection>
  )
}
