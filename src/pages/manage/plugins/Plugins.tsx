import { TbPlus } from "solid-icons/tb"
import { createSignal, For, onMount, Show } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Switch, SwitchControl, SwitchThumb } from "~/components/ui/switch"
import {
  createDeleteConfirm,
  FieldRenderer,
  ResourceList,
  StatusBadge,
  type StatusTone,
} from "~/features/settings/form"
import { useManageTitle, useT } from "~/hooks"
import { plugins, setPluginEnabled } from "~/plugins"
import { Type } from "~/types"
import { handleResp, notify } from "~/utils"
import {
  deleteBackendPlugin,
  enableBackendPlugin,
  getBackendPlugin,
  GoPlugin,
  listBackendPlugins,
  PLUGIN_TEMPLATE,
  saveBackendPlugin,
} from "./api"
import ClusterConfig from "./ClusterConfig"

const RowSwitch = (props: {
  checked: boolean
  label: string
  onChange: (on: boolean) => void
}) => (
  <Switch
    checked={props.checked}
    onChange={props.onChange}
    aria-label={props.label}
  >
    <SwitchControl>
      <SwitchThumb />
    </SwitchControl>
  </Switch>
)

const Plugins = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.plugins")

  const [backend, setBackend] = createSignal<GoPlugin[]>([])
  const [loading, setLoading] = createSignal(true)

  // Editor state. isNew: creating (the name is typed); otherwise editing the named plugin.
  const [editorOpen, setEditorOpen] = createSignal(false)
  const [isNew, setIsNew] = createSignal(false)
  const [name, setName] = createSignal("")
  const [source, setSource] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const refresh = async () => {
    setLoading(true)
    handleResp(await listBackendPlugins(), (data) => setBackend(data.go ?? []))
    setLoading(false)
  }
  onMount(refresh)

  const openNew = () => {
    setIsNew(true)
    setName("")
    setSource(PLUGIN_TEMPLATE)
    setEditorOpen(true)
  }

  const openEdit = async (p: GoPlugin) => {
    handleResp(await getBackendPlugin(p.name), (data) => {
      setIsNew(false)
      setName(data.name)
      setSource(data.source)
      setEditorOpen(true)
    })
  }

  const save = async () => {
    if (!name().trim() || !source().trim()) return
    setBusy(true)
    handleResp(await saveBackendPlugin(name().trim(), source()), (data) => {
      setBackend(data ?? [])
      notify.success(t("manage.plugin_saved"))
      setEditorOpen(false)
    })
    setBusy(false)
  }

  const removal = createDeleteConfirm<GoPlugin>({
    name: (p) => p.name,
    description: (p) => t("manage.plugin_delete_confirm", { name: p.name }),
    run: async (p) => {
      handleResp(await deleteBackendPlugin(p.name), (data) => {
        setBackend(data ?? [])
        notify.success(t("manage.plugin_deleted"))
      })
    },
  })

  const toggle = async (p: GoPlugin, enabled: boolean) => {
    handleResp(await enableBackendPlugin(p.name, enabled), (data) =>
      setBackend(data ?? []),
    )
  }

  const state = (p: GoPlugin): { tone: StatusTone; label: string } =>
    !p.enabled
      ? { tone: "neutral", label: t("manage.plugin_disabled") }
      : p.loaded
        ? { tone: "success", label: t("manage.plugin_loaded") }
        : { tone: "warning", label: t("manage.plugin_not_loaded") }
  // The compile error is shown in full: it is what the author needs to fix.
  const StateChip = (props: { plugin: GoPlugin }) => (
    <div class="flex flex-col items-start gap-1">
      <StatusBadge {...state(props.plugin)} />
      <Show when={props.plugin.error}>
        <p class="break-all font-mono text-xs text-destructive">
          {t("manage.plugin_load_error")}: {props.plugin.error}
        </p>
      </Show>
    </div>
  )

  return (
    <div class="flex w-full flex-col gap-8">
      {/* ---- Backend (server) plugins ---- */}
      <ResourceList
        title={t("manage.plugins_backend_title")}
        description={t("manage.plugins_backend_intro")}
        rows={backend()}
        rowKey={(p) => p.name}
        loading={loading()}
        emptyText={t("manage.plugins_backend_empty")}
        toolbarActions={[
          {
            id: "new-plugin",
            label: t("manage.plugin_new"),
            icon: <TbPlus class="mr-1.5 size-4" />,
            onSelect: openNew,
          },
        ]}
        columns={[
          {
            id: "name",
            header: t("manage.plugin_name"),
            cell: (p) => <span class="font-medium">{p.name}</span>,
            sort: (p) => p.name,
          },
          {
            id: "state",
            header: t("common.status"),
            cell: (p) => <StateChip plugin={p} />,
          },
          {
            id: "enabled",
            header: t("global.enable"),
            cell: (p) => (
              <RowSwitch
                checked={p.enabled}
                label={`${t("global.enable")} ${p.name}`}
                onChange={(on) => toggle(p, on)}
              />
            ),
          },
        ]}
        card={{
          title: (p) => p.name,
          badges: (p) => <StateChip plugin={p} />,
          body: (p) => (
            <RowSwitch
              checked={p.enabled}
              label={`${t("global.enable")} ${p.name}`}
              onChange={(on) => toggle(p, on)}
            />
          ),
        }}
        primary={(p) => ({
          id: "edit",
          label: t("manage.plugin_edit"),
          onSelect: openEdit,
        })}
        actions={() => [
          {
            id: "delete",
            label: t("manage.plugin_delete"),
            destructive: true,
            onSelect: removal.ask,
          },
        ]}
      />
      {removal.dialog()}
      <Dialog open={editorOpen()} onOpenChange={setEditorOpen}>
        <DialogContent class="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t(isNew() ? "manage.plugin_new" : "manage.plugin_edit")}
            </DialogTitle>
            <DialogDescription class="sr-only">
              {t("manage.plugins_backend_title")}
            </DialogDescription>
          </DialogHeader>
          <FieldRenderer
            stacked
            field={{
              id: "plugin_name",
              type: Type.String,
              labelKey: "manage.plugin_name",
              placeholder: t("manage.plugin_name_placeholder"),
              readonly: !isNew(),
            }}
            value={name()}
            onChange={(raw) => setName(String(raw))}
          />
          <FieldRenderer
            stacked
            field={{
              id: "plugin_source",
              type: Type.Text,
              labelKey: "manage.plugin_source",
              mono: true,
              rows: 18,
            }}
            value={source()}
            onChange={(raw) => setSource(String(raw))}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditorOpen(false)}
            >
              {t("global.cancel")}
            </Button>
            <Button type="button" disabled={busy()} onClick={save}>
              {t("manage.plugin_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Frontend (UI) plugins ---- */}
      <ResourceList
        title={t("manage.plugins_frontend_title")}
        description={t("manage.plugins_intro")}
        rows={plugins()}
        rowKey={(p) => p.id}
        emptyText={t("manage.plugins_empty")}
        columns={[
          {
            id: "name",
            header: t("manage.plugin_name"),
            cell: (p) => (
              <div class="flex flex-col">
                <span class="font-medium">
                  {p.name ?? p.id}
                  {p.version ? (
                    <Badge variant="secondary" class="ml-2">
                      v{p.version}
                    </Badge>
                  ) : null}
                </span>
                <span class="text-xs text-muted-foreground">{p.id}</span>
              </div>
            ),
          },
          {
            id: "slots",
            header: t("common.slots"),
            cell: (p) => (
              <div class="flex flex-wrap gap-1">
                <For each={p.contributions}>
                  {(c) => <Badge variant="outline">{c.slot}</Badge>}
                </For>
              </div>
            ),
          },
          {
            id: "enabled",
            header: t("global.enable"),
            cell: (p) => (
              <RowSwitch
                checked={p.enabled !== false}
                label={`${t("global.enable")} ${p.name ?? p.id}`}
                onChange={(on) => setPluginEnabled(p.id, on)}
              />
            ),
          },
        ]}
        card={{
          title: (p) => p.name ?? p.id,
          badges: (p) => (
            <For each={p.contributions}>
              {(c) => <Badge variant="outline">{c.slot}</Badge>}
            </For>
          ),
          body: (p) => (
            <RowSwitch
              checked={p.enabled !== false}
              label={`${t("global.enable")} ${p.name ?? p.id}`}
              onChange={(on) => setPluginEnabled(p.id, on)}
            />
          ),
        }}
      />

      {/* ---- Cluster storage sharing ---- */}
      <div id="cluster">
        <ClusterConfig />
      </div>
    </div>
  )
}

export default Plugins
