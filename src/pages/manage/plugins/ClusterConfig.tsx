import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  DataState,
  FieldRenderer,
  SettingsSection,
} from "~/features/settings/form"
import { useT } from "~/hooks"
import { Type } from "~/types"
import { handleResp, notify } from "~/utils"
import {
  ClusterConfig as ClusterConfigT,
  ClusterGroupSpec,
  ClusterStatus,
  getClusterConfig,
  getClusterKey,
  setClusterConfig,
  setClusterGroups,
} from "./api"
import { ClusterGroups } from "./ClusterGroups"
import { ClusterOverview, ClusterStats } from "./ClusterOverview"
import { splitLines } from "./cluster-util"

const REDACTED_KEY = "********"
const POLL_MS = 5000

const ClusterConfig = () => {
  const t = useT()
  const [cfg, setCfg] = createSignal<ClusterConfigT>()
  const [status, setStatus] = createSignal<ClusterStatus>()
  const [loading, setLoading] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [savingGroups, setSavingGroups] = createSignal(false)
  const [seeds, setSeeds] = createSignal("")
  const [groups, setGroups] = createSignal<ClusterGroupSpec[]>([])

  const groupsFromStatus = (s: ClusterStatus): ClusterGroupSpec[] =>
    (s.groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      members: g.members.map((m) => ({
        node_id: m.node_id,
        mount_path: m.mount_path,
      })),
    }))
  const applyData = (d: { config: ClusterConfigT; status: ClusterStatus }) => {
    setCfg(d.config)
    setStatus(d.status)
    setSeeds((d.config.seeds ?? []).join("\n"))
    setGroups(groupsFromStatus(d.status))
  }

  const refresh = async () => {
    setLoading(true)
    handleResp(await getClusterConfig(), applyData)
    setLoading(false)
  }
  onMount(() => {
    refresh()
    // Live-ish refresh of the status panels while the page is open. Only the
    // status is taken: it must not overwrite what is being edited.
    const timer = setInterval(async () => {
      if (busy() || savingGroups()) return
      handleResp(await getClusterConfig(), (d) => {
        setCfg((prev) => prev ?? d.config)
        setStatus(d.status)
      })
    }, POLL_MS)
    onCleanup(() => clearInterval(timer))
  })

  const patch = (p: Partial<ClusterConfigT>) => {
    const c = cfg()
    if (c) setCfg({ ...c, ...p })
  }

  // The key is redacted on read; revealing it fetches the plaintext once.
  // A key the user has typed is shown as-is.
  const revealKey = async () => {
    if (cfg()?.key !== REDACTED_KEY) return
    handleResp(await getClusterKey(), (d) => patch({ key: d.key }))
  }

  const save = async () => {
    const c = cfg()
    if (!c) return
    setBusy(true)
    const payload: ClusterConfigT = {
      ...c,
      seeds: splitLines(seeds()),
      announce_interval_sec: Number(c.announce_interval_sec) || 0,
    }
    handleResp(await setClusterConfig(payload), (d) => {
      applyData(d)
      notify.success(t("manage.cluster.saved"))
    })
    setBusy(false)
  }

  const saveGroups = async () => {
    setSavingGroups(true)
    // Drop empty groups / members before saving.
    const clean = groups()
      .map((g) => ({
        ...g,
        members: g.members.filter((m) => m.node_id && m.mount_path),
      }))
      .filter((g) => g.members.length > 0)
    handleResp(await setClusterGroups(clean), (s) => {
      setStatus(s)
      setGroups(groupsFromStatus(s))
      notify.success(t("manage.cluster.saved"))
    })
    setSavingGroups(false)
  }

  return (
    <div class="flex w-full flex-col gap-4">
      <div>
        <h2 class="text-base font-semibold leading-tight">
          {t("manage.cluster.title")}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {t("manage.cluster.intro")}
        </p>
      </div>

      <DataState loading={loading() && !cfg()}>
        <Show when={cfg() && status()}>
          <ClusterStats status={status()!} />

          <SettingsSection
            id="cluster-config"
            title={t("settings.form.cluster_config")}
            actions={
              <Button type="button" disabled={busy()} onClick={save}>
                {t("global.save")}
              </Button>
            }
          >
            <FieldRenderer
              field={{
                id: "cluster_enabled",
                type: Type.Bool,
                labelKey: "manage.cluster.enabled",
              }}
              value={cfg()!.enabled}
              onChange={(raw) => patch({ enabled: raw === true })}
            />
            <FieldRenderer
              field={{
                id: "cluster_key",
                type: Type.String,
                labelKey: "manage.cluster.key",
                helpKey: "manage.cluster.key_hint",
                placeholder: t("manage.cluster.key_placeholder"),
                secret: true,
                mono: true,
              }}
              value={cfg()!.key}
              onChange={(raw) => patch({ key: String(raw) })}
              reveal={revealKey}
            />
            <FieldRenderer
              field={{
                id: "cluster_label",
                type: Type.String,
                labelKey: "manage.cluster.label",
                helpKey: "manage.cluster.label_hint",
                placeholder: "cfscan",
              }}
              value={cfg()!.label}
              onChange={(raw) => patch({ label: String(raw) })}
            />
            <FieldRenderer
              field={{
                id: "cluster_addr",
                type: Type.String,
                labelKey: "manage.cluster.addr",
                helpKey: "manage.cluster.addr_hint",
                placeholder: "https://node1.example.com",
              }}
              value={cfg()!.addr}
              onChange={(raw) => patch({ addr: String(raw) })}
            />
            <FieldRenderer
              field={{
                id: "cluster_seeds",
                type: Type.Text,
                labelKey: "manage.cluster.seeds",
                helpKey: "manage.cluster.seeds_hint",
                placeholder: "https://node2.example.com",
                mono: true,
                rows: 2,
              }}
              value={seeds()}
              onChange={(raw) => setSeeds(String(raw))}
            />
            <FieldRenderer
              field={{
                id: "cluster_apply_remote",
                type: Type.Bool,
                labelKey: "manage.cluster.apply_remote",
                helpKey: "manage.cluster.apply_remote_hint",
              }}
              value={cfg()!.apply_remote}
              onChange={(raw) => patch({ apply_remote: raw === true })}
            />
            <FieldRenderer
              field={{
                id: "cluster_announce_interval",
                type: Type.Number,
                labelKey: "manage.cluster.announce_interval",
              }}
              value={cfg()!.announce_interval_sec}
              onChange={(raw) => patch({ announce_interval_sec: Number(raw) })}
            />
          </SettingsSection>

          <ClusterGroups
            status={status()!}
            groups={groups()}
            onChange={setGroups}
            saving={savingGroups()}
            onSave={saveGroups}
          />
          <ClusterOverview status={status()!} />
        </Show>
      </DataState>
    </div>
  )
}

export default ClusterConfig
