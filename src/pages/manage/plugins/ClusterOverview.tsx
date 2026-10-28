import { createMemo, For, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Card } from "~/components/ui/card"
import { ResourceList, SettingsSection } from "~/features/settings/form"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import type { ClusterNodeView, ClusterStatus } from "./api"
import { ClusterLinks } from "./ClusterLinks"
import { ago } from "./cluster-util"

const Dot = (props: { on: boolean }) => (
  <span
    class={cn(
      "inline-block size-2.5 shrink-0 rounded-full",
      props.on ? "bg-success" : "bg-muted-foreground/50",
    )}
  />
)

const Stat = (props: { label: string; value: string | number }) => (
  <Card class="flex min-w-[92px] flex-col px-4 py-2">
    <span class="text-xl font-bold">{props.value}</span>
    <span class="text-xs text-muted-foreground">{props.label}</span>
  </Card>
)

/** Headline numbers and whether this node is part of an active cluster. */
export const ClusterStats = (props: { status: ClusterStatus }) => {
  const t = useT()
  const s = () => props.status.stats
  return (
    <div class="flex flex-wrap items-center gap-3">
      <Stat
        label={t("manage.cluster.stats_nodes")}
        value={`${s().nodes_online}/${s().nodes_total}`}
      />
      <Stat label={t("manage.cluster.stats_groups")} value={s().groups_total} />
      <Stat label={t("manage.cluster.stats_creds")} value={s().creds_total} />
      <Stat
        label={t("manage.cluster.stats_connections")}
        value={s().connections}
      />
      <div class="ml-auto flex flex-col items-end gap-1">
        <Badge variant={props.status.active ? "success" : "secondary"}>
          {props.status.active
            ? t("manage.cluster.active")
            : t("manage.cluster.inactive")}
        </Badge>
        <span class="font-mono text-xs text-muted-foreground">
          {props.status.node_id}
        </span>
      </div>
    </div>
  )
}

/** Nodes, live connections and recent sync events of the cluster. */
export const ClusterOverview = (props: { status: ClusterStatus }) => {
  const t = useT()
  const nodeLabel = (id: string) => {
    const n = props.status.nodes.find((x) => x.node_id === id)
    return n?.label || id.slice(0, 8)
  }
  const nodeName = (n: ClusterNodeView) => n.label || n.node_id.slice(0, 8)
  const seen = (n: ClusterNodeView) =>
    n.online ? t("manage.cluster.online") : ago(n.last_seen)
  const connections = createMemo(() => props.status.connections ?? [])
  const events = createMemo(() => props.status.events ?? [])

  return (
    <>
      <ResourceList
        title={t("manage.cluster.nodes_title")}
        rows={props.status.nodes}
        rowKey={(n) => n.node_id}
        columns={[
          {
            id: "name",
            header: t("manage.cluster.label"),
            cell: (n) => (
              <span class="flex items-center gap-2">
                <Dot on={n.online} />
                <span class="font-medium">{nodeName(n)}</span>
                <Show when={n.self}>
                  <Badge variant="secondary">{t("manage.cluster.self")}</Badge>
                </Show>
              </span>
            ),
          },
          {
            id: "addr",
            header: t("manage.cluster.addr"),
            cell: (n) => (
              <span class="break-all font-mono text-xs">{n.addr}</span>
            ),
          },
          {
            id: "storages",
            header: t("manage.cluster.storages"),
            cell: (n) => n.storages.length,
          },
          {
            id: "seen",
            header: t("manage.cluster.online"),
            cell: (n) => seen(n),
          },
        ]}
        card={{
          title: (n) => (
            <span class="flex items-center gap-2">
              <Dot on={n.online} />
              {nodeName(n)}
            </span>
          ),
          badges: (n) => (
            <Show when={n.self}>
              <Badge variant="secondary">{t("manage.cluster.self")}</Badge>
            </Show>
          ),
          body: (n) => (
            <span>
              {n.storages.length} {t("manage.cluster.storages")} · {seen(n)}
            </span>
          ),
        }}
      />

      <div class="grid gap-4 lg:grid-cols-2">
        <Show
          when={(props.status.links ?? []).length > 0}
          fallback={
            <SettingsSection
              id="cluster-connections"
              title={t("manage.cluster.connections_title")}
            >
              <Show
                when={connections().length > 0}
                fallback={
                  <p class="py-3 text-sm text-muted-foreground">
                    {t("manage.cluster.no_connections")}
                  </p>
                }
              >
                <For each={connections()}>
                  {(c) => (
                    <div class="flex items-center justify-between gap-2 py-2 text-sm">
                      <span class="flex items-center gap-2">
                        <Badge variant={c.outbound ? "default" : "secondary"}>
                          {c.outbound ? "→" : "←"}
                        </Badge>
                        {nodeLabel(c.node_id)}
                      </span>
                      <span class="text-xs text-muted-foreground">
                        {ago(c.since)}
                      </span>
                    </div>
                  )}
                </For>
              </Show>
            </SettingsSection>
          }
        >
          <ClusterLinks status={props.status} />
        </Show>

        <SettingsSection
          id="cluster-events"
          title={t("manage.cluster.events_title")}
        >
          <Show
            when={events().length > 0}
            fallback={
              <p class="py-3 text-sm text-muted-foreground">
                {t("manage.cluster.no_events")}
              </p>
            }
          >
            <div class="flex max-h-60 flex-col gap-1.5 overflow-y-auto py-2">
              <For each={events()}>
                {(e) => (
                  <div class="flex items-baseline gap-2 text-xs">
                    <span class="w-9 shrink-0 text-muted-foreground">
                      {ago(e.time)}
                    </span>
                    <Badge
                      variant={
                        e.kind === "apply"
                          ? "success"
                          : e.kind === "share"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {e.kind}
                    </Badge>
                    <span class="break-all">{e.detail}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </SettingsSection>
      </div>
    </>
  )
}
