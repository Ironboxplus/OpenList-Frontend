import { TbPlus, TbRefresh, TbX } from "solid-icons/tb"
import { createMemo, For, Index, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { SettingsSection } from "~/features/settings/form"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import type { ClusterGroupSpec, ClusterGroupView, ClusterStatus } from "./api"
import ClusterGraph from "./ClusterGraph"
import { ClusterRefresher } from "./ClusterRefresher"
import { ago, rid } from "./cluster-util"

export interface ClusterGroupsProps {
  status: ClusterStatus
  /** The draft: what Save groups will post. */
  groups: ClusterGroupSpec[]
  onChange: (groups: ClusterGroupSpec[]) => void
  saving: boolean
  onSave: () => void
  /** Pin (or with "" clear) the group's preferred refresher; applies at once. */
  onPrefer?: (groupID: string, nodeID: string) => void
  preferBusy?: boolean
}

/**
 * Editor of the sync groups: which storages across nodes share one credential.
 * Edits stay in the draft until Save groups; the chips and badges also show the
 * saved server-side state of each group, and a live graph mirrors the draft.
 */
export const ClusterGroups = (props: ClusterGroupsProps) => {
  const t = useT()

  const update = (id: string, f: (g: ClusterGroupSpec) => ClusterGroupSpec) =>
    props.onChange(props.groups.map((g) => (g.id === id ? f(g) : g)))
  const addGroup = () =>
    props.onChange([...props.groups, { id: rid(), name: "", members: [] }])
  const removeGroup = (id: string) =>
    props.onChange(props.groups.filter((g) => g.id !== id))
  const addMember = (id: string, value: string) => {
    const [node_id, mount_path] = value.split(" ")
    update(id, (g) =>
      g.members.some(
        (m) => m.node_id === node_id && m.mount_path === mount_path,
      )
        ? g
        : { ...g, members: [...g.members, { node_id, mount_path }] },
    )
  }
  const removeMember = (id: string, node_id: string, mount_path: string) =>
    update(id, (g) => ({
      ...g,
      members: g.members.filter(
        (m) => !(m.node_id === node_id && m.mount_path === mount_path),
      ),
    }))

  const nodeLabel = (nodeID: string) => {
    const n = props.status.nodes.find((x) => x.node_id === nodeID)
    return n?.label || nodeID.slice(0, 8)
  }
  // Saved server-side view of a group (for sync state badges).
  const savedGroup = (id: string): ClusterGroupView | undefined =>
    props.status.groups.find((g) => g.id === id)
  const memberView = (gid: string, nodeID: string, mount: string) =>
    savedGroup(gid)?.members.find(
      (m) => m.node_id === nodeID && m.mount_path === mount,
    )

  // Live graph preview from the (possibly unsaved) edits.
  const graphGroups = createMemo<ClusterGroupView[]>(() =>
    props.groups.map((g) => ({
      id: g.id,
      name: g.name || g.id,
      members: g.members.map((m) => ({
        node_id: m.node_id,
        mount_path: m.mount_path,
        label: nodeLabel(m.node_id),
        online: true,
        present: true,
        is_origin: false,
        self: false,
      })),
      fields: [],
      cred_hash: "",
      version: 0,
      origin: "",
      updated_at: 0,
      has_cred: false,
    })),
  )

  // Storages that can still be added to a group (all nodes' storages).
  const candidates = (g: ClusterGroupSpec) => {
    const out: { value: string; label: string }[] = []
    for (const n of props.status.nodes) {
      for (const s of n.storages) {
        const taken = g.members.some(
          (m) => m.node_id === n.node_id && m.mount_path === s.mount_path,
        )
        if (taken) continue
        out.push({
          value: n.node_id + " " + s.mount_path,
          label: `${n.label || n.node_id.slice(0, 8)} · ${s.mount_path}`,
        })
      }
    }
    return out
  }

  return (
    <>
      <SettingsSection
        id="cluster-groups"
        title={t("manage.cluster.groups_title")}
        description={t("manage.cluster.groups_hint")}
        actions={
          <>
            <Button type="button" variant="outline" onClick={addGroup}>
              <TbPlus class="mr-1.5 size-4" />
              {t("manage.cluster.new_group")}
            </Button>
            <Button
              type="button"
              disabled={props.saving}
              onClick={props.onSave}
            >
              {t("manage.cluster.save_groups")}
            </Button>
          </>
        }
      >
        <Show
          when={props.groups.length > 0}
          fallback={
            <p class="py-3 text-sm text-muted-foreground">
              {t("manage.cluster.no_groups")}
            </p>
          }
        >
          <div class="flex flex-col gap-3 py-3">
            {/* Index (not For) keeps each group's DOM stable across edits, so
                typing in the name input does not recreate it and drop focus. */}
            <Index each={props.groups}>
              {(g) => {
                const saved = () => savedGroup(g().id)
                return (
                  <div class="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <Input
                        class="min-w-40 flex-1"
                        value={g().name}
                        placeholder={t("manage.cluster.group_name")}
                        onInput={(e) =>
                          update(g().id, (x) => ({
                            ...x,
                            name: e.currentTarget.value,
                          }))
                        }
                      />
                      <Show when={saved()?.has_cred}>
                        <Badge variant="success">
                          v{saved()!.version} · {saved()!.cred_hash}
                        </Badge>
                      </Show>
                      <Show when={saved() && !saved()!.has_cred}>
                        <Badge variant="warning">
                          {t("manage.cluster.not_synced")}
                        </Badge>
                      </Show>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="text-destructive"
                        onClick={() => removeGroup(g().id)}
                      >
                        {t("manage.cluster.delete_group")}
                      </Button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <For each={g().members}>
                        {(m) => {
                          const mv = () =>
                            memberView(g().id, m.node_id, m.mount_path)
                          return (
                            <span class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm">
                              <span
                                class={cn(
                                  "size-2 rounded-full",
                                  mv()?.online
                                    ? "bg-success"
                                    : "bg-muted-foreground/50",
                                )}
                              />
                              <Show when={mv()?.is_origin}>
                                <span title="credential source">★</span>
                              </Show>
                              <Show when={mv()?.refresher}>
                                <span title={t("manage.cluster.refresher")}>
                                  <TbRefresh class="size-3.5 text-success" />
                                </span>
                              </Show>
                              {nodeLabel(m.node_id)}
                              <span class="font-mono text-muted-foreground">
                                {m.mount_path}
                              </span>
                              <Show when={mv()?.proto === 1}>
                                <Badge
                                  variant="warning"
                                  class="px-1.5 py-0"
                                  title={t("manage.cluster.legacy_hint")}
                                >
                                  {t("manage.cluster.legacy")}
                                </Badge>
                              </Show>
                              <Show
                                when={mv() && (mv()!.held_version ?? 0) > 0}
                              >
                                <span
                                  class={cn(
                                    "text-xs",
                                    mv()!.laggard
                                      ? "font-semibold text-warning"
                                      : "text-muted-foreground",
                                  )}
                                  data-laggard={
                                    mv()!.laggard ? "true" : undefined
                                  }
                                  title={t("manage.cluster.held_version")}
                                >
                                  v{mv()!.held_version}
                                </span>
                              </Show>
                              <Show when={mv() && !mv()!.present}>
                                <span
                                  class="text-xs text-warning"
                                  title="mount not found on node"
                                >
                                  ?
                                </span>
                              </Show>
                              <button
                                type="button"
                                class="ml-1 text-muted-foreground hover:text-foreground"
                                aria-label={t("global.delete")}
                                onClick={() =>
                                  removeMember(g().id, m.node_id, m.mount_path)
                                }
                              >
                                <TbX class="size-3.5" />
                              </button>
                            </span>
                          )
                        }}
                      </For>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          as={Button}
                          size="sm"
                          variant="outline"
                          disabled={candidates(g()).length === 0}
                        >
                          <TbPlus class="mr-1 size-3.5" />
                          {t("manage.cluster.add_storage")}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent class="max-h-80 overflow-y-auto">
                          <For
                            each={candidates(g())}
                            fallback={
                              <DropdownMenuItem disabled>
                                {t("manage.cluster.no_storage_left")}
                              </DropdownMenuItem>
                            }
                          >
                            {(c) => (
                              <DropdownMenuItem
                                onSelect={() => addMember(g().id, c.value)}
                              >
                                {c.label}
                              </DropdownMenuItem>
                            )}
                          </For>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <Show
                      when={
                        props.onPrefer &&
                        saved() &&
                        (saved()!.refresh_group ||
                          saved()!.refresher ||
                          saved()!.last_refresh)
                      }
                    >
                      <ClusterRefresher
                        group={saved()!}
                        onPrefer={props.onPrefer!}
                        busy={props.preferBusy}
                      />
                    </Show>

                    <Show
                      when={saved()?.has_cred && saved()!.fields.length > 0}
                    >
                      <p class="text-xs text-muted-foreground">
                        {t("manage.cluster.synced_fields")}:{" "}
                        {saved()!.fields.join(", ")} ·{" "}
                        {t("manage.cluster.last_update")}{" "}
                        {ago(saved()!.updated_at)}
                      </p>
                    </Show>
                  </div>
                )
              }}
            </Index>
          </div>
        </Show>
      </SettingsSection>

      <SettingsSection
        id="cluster-graph"
        title={t("manage.cluster.graph_title")}
      >
        <div class="py-3">
          <ClusterGraph nodes={props.status.nodes} groups={graphGroups()} />
        </div>
      </SettingsSection>
    </>
  )
}
