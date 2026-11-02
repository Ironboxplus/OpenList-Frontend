import { TbPlus } from "solid-icons/tb"
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DataState } from "~/components/ui/data-state"
import { StatusBadge, type StatusTone } from "~/components/ui/status-badge"
import {
  frpGet,
  frpRuntime,
  frpSave,
  frpStart,
  frpStatus,
  frpStop,
} from "~/features/frp/client"
import {
  draftErrors,
  draftFromView,
  MAX_PROXIES,
  toSaveRequest,
  type FrpDraft,
  type ProxyDraft,
} from "~/features/frp/draft"
import {
  ConfirmDialog,
  createDeleteConfirm,
  FieldRenderer,
  ResourceList,
  SettingsForm,
  SettingsSection,
} from "~/features/settings/form"
import { useManageTitle, useT } from "~/hooks"
import {
  Type,
  type FrpProxyStatus,
  type FrpState,
  type FrpStatus,
} from "~/types"
import { handleResp, notify } from "~/utils"
import { createPoller } from "~/utils/poll"
import { ProxyDialog } from "./ProxyDialog"

// How often the state and the log are asked for while the page is open.
const POLL_MS = 3000

const STATE_TONE: Record<FrpState, StatusTone> = {
  running: "success",
  connecting: "info",
  error: "error",
  stopped: "neutral",
}

const PHASE_TONE = (phase: string): StatusTone =>
  phase === "running"
    ? "success"
    : phase === "wait start"
      ? "info"
      : phase === "unknown"
        ? "neutral"
        : "error"

const blank = (): FrpDraft => ({
  enabled: false,
  serverAddr: "",
  serverPort: "7000",
  tls: true,
  exposeCluster: false,
  token: { kind: "keep" },
  tokenSet: false,
  proxies: [],
})

const Frp = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.frp")
  const [draft, setDraft] = createStore<FrpDraft>(blank())
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  const [saving, setSaving] = createSignal(false)
  const [status, setStatus] = createSignal<FrpStatus>()
  const [lines, setLines] = createSignal<string[]>([])
  const [autoScroll, setAutoScroll] = createSignal(true)
  const snapshot = () => JSON.stringify(draft)
  const [baseline, setBaseline] = createSignal(snapshot())
  const dirty = createMemo(() => snapshot() !== baseline())
  const errors = createMemo(() => draftErrors(draft))

  const load = async () => {
    setLoading(true)
    handleResp(
      await frpGet(),
      (v) => {
        setError(undefined)
        setDraft(reconcile(draftFromView(v)))
        setBaseline(snapshot())
        setStatus(
          (s) =>
            s ?? {
              state: v.state,
              state_message: v.state_message,
              proxies: [],
            },
        )
      },
      setError,
    )
    setLoading(false)
  }

  let logBox: HTMLPreElement | undefined
  const poller = createPoller({
    intervalMs: POLL_MS,
    tick: async () => {
      const [st, log] = await Promise.all([frpStatus(), frpRuntime()])
      handleResp(st, setStatus, undefined, true, false)
      handleResp(
        log,
        (d) => {
          setLines(d.lines ?? [])
          if (autoScroll() && logBox) {
            queueMicrotask(
              () => logBox && (logBox.scrollTop = logBox.scrollHeight),
            )
          }
        },
        undefined,
        true,
        false,
      )
    },
  })
  onMount(() => {
    void load()
    poller.start()
  })
  onCleanup(poller.stop)

  const save = async () => {
    setSaving(true)
    handleResp(await frpSave(toSaveRequest(draft)), async (r) => {
      notify.success(t("frp.saved"))
      setStatus((s) => ({
        ...(s ?? { proxies: [] }),
        state: r.state,
        state_message: r.state_message,
      }))
      await load()
      void poller.refresh()
    })
    setSaving(false)
  }

  const control = async (start: boolean) => {
    handleResp(await (start ? frpStart() : frpStop()), (r) => {
      setStatus((s) => ({
        ...(s ?? { proxies: [] }),
        state: r.state,
        state_message: r.state_message,
      }))
      void poller.refresh()
    })
  }

  // The tunnels reaching /api/cluster is the one switch that needs a second look.
  const [confirmCluster, setConfirmCluster] = createSignal(false)

  const [dialog, setDialog] = createSignal<{ index: number } | undefined>()
  const editing = (): ProxyDraft | undefined => {
    const d = dialog()
    return d && d.index >= 0 ? draft.proxies[d.index] : undefined
  }
  const saveProxy = (p: ProxyDraft) => {
    const d = dialog()
    if (!d) return
    if (d.index >= 0) setDraft("proxies", d.index, reconcile(p))
    else setDraft("proxies", draft.proxies.length, p)
    setDialog(undefined)
  }
  const removal = createDeleteConfirm<{ p: ProxyDraft; index: number }>({
    name: (r) => r.p.name,
    run: async (r) => {
      setDraft("proxies", (all) => all.filter((_, i) => i !== r.index))
    },
  })

  const statusOf = (name: string): FrpProxyStatus | undefined =>
    status()?.proxies.find((p) => p.name === name)
  const target = (p: ProxyDraft) =>
    p.type === "http"
      ? [p.domains.split("\n").join(", "), p.subdomain && `${p.subdomain}.*`]
          .filter(Boolean)
          .join(", ")
      : p.type === "tcp"
        ? `:${p.remotePort}`
        : p.secretSet || p.secret.kind === "set"
          ? t("frp.key_set")
          : ""
  const stateLabel = () => t(`frp.states.${status()?.state ?? "stopped"}`)
  const rows = () => draft.proxies.map((p, index) => ({ p, index }))

  return (
    <DataState
      loading={loading() && !draft.serverAddr && draft.proxies.length === 0}
      error={error()}
      onRetry={load}
    >
      <SettingsForm
        dirty={dirty()}
        invalid={errors().length > 0}
        saving={saving()}
        resetting={loading()}
        onSave={save}
        onReset={load}
      >
        <SettingsSection
          id="frp-status"
          title={t("frp.status")}
          description={t("frp.status_help")}
          actions={
            <div class="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  status()?.state === "running" ||
                  status()?.state === "connecting"
                }
                onClick={() => control(true)}
              >
                {t("frp.start")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  status()?.state === "stopped" || status() === undefined
                }
                onClick={() => control(false)}
              >
                {t("frp.stop")}
              </Button>
            </div>
          }
        >
          <div class="px-4 pb-4 sm:px-6">
            <StatusBadge
              tone={STATE_TONE[status()?.state ?? "stopped"]}
              label={stateLabel()}
              detail={status()?.state_message || undefined}
            />
            <p class="mt-2 text-xs text-muted-foreground">
              {t("frp.stop_note")}
            </p>
          </div>
        </SettingsSection>

        <SettingsSection
          id="frp-server"
          title={t("frp.server")}
          description={t("frp.server_help")}
        >
          <FieldRenderer
            field={{
              id: "frp_enabled",
              type: Type.Bool,
              labelKey: "frp.enabled",
              helpKey: "frp.enabled_help",
            }}
            value={draft.enabled}
            onChange={(raw) => setDraft("enabled", raw === true)}
          />
          <FieldRenderer
            field={{
              id: "frp_server_addr",
              type: Type.String,
              labelKey: "frp.server_addr",
              required: true,
            }}
            value={draft.serverAddr}
            onChange={(raw) => setDraft("serverAddr", String(raw))}
          />
          <FieldRenderer
            field={{
              id: "frp_server_port",
              type: Type.String,
              labelKey: "frp.server_port",
              required: true,
            }}
            value={draft.serverPort}
            onChange={(raw) => setDraft("serverPort", String(raw))}
          />
          <FieldRenderer
            field={{
              id: "frp_tls",
              type: Type.Bool,
              labelKey: "frp.tls",
              helpKey: "frp.tls_help",
            }}
            value={draft.tls}
            onChange={(raw) => setDraft("tls", raw === true)}
          />
          <Show when={!draft.tls}>
            <Alert variant="warning" class="mx-4 mb-2 w-auto sm:mx-6">
              <AlertDescription>{t("frp.tls_off_warning")}</AlertDescription>
            </Alert>
          </Show>
          <FieldRenderer
            field={{
              id: "frp_token",
              type: Type.String,
              labelKey: "frp.token",
              helpKey: "frp.token_help",
              secret: true,
              placeholder:
                draft.tokenSet && draft.token.kind === "keep"
                  ? t("frp.secret_saved")
                  : undefined,
            }}
            value={draft.token.kind === "set" ? draft.token.value : ""}
            onChange={(raw) => {
              const v = String(raw)
              setDraft(
                "token",
                v === "" ? { kind: "keep" } : { kind: "set", value: v },
              )
            }}
            after={
              <Show when={draft.tokenSet && draft.token.kind !== "clear"}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft("token", { kind: "clear" })}
                >
                  {t("frp.secret_clear")}
                </Button>
              </Show>
            }
          />
          <Show when={draft.token.kind === "clear"}>
            <p class="px-4 pb-2 text-xs text-muted-foreground sm:px-6">
              {t("frp.secret_will_clear")}
            </p>
          </Show>
          <FieldRenderer
            field={{
              id: "frp_expose_cluster",
              type: Type.Bool,
              labelKey: "frp.expose_cluster",
            }}
            value={draft.exposeCluster}
            onChange={(raw) =>
              raw === true
                ? setConfirmCluster(true)
                : setDraft("exposeCluster", false)
            }
          />
          <Alert variant="warning" class="mx-4 mb-4 w-auto sm:mx-6">
            <AlertDescription>
              {t("frp.expose_cluster_warning")}
            </AlertDescription>
          </Alert>
        </SettingsSection>

        <ResourceList
          title={t("frp.proxies")}
          description={t("frp.proxies_help")}
          rows={rows()}
          rowKey={(r) => r.index}
          emptyText={t("frp.proxies_empty")}
          toolbarActions={[
            {
              id: "add",
              label: t("frp.proxy.add"),
              icon: <TbPlus class="mr-1.5 size-4" />,
              disabled: draft.proxies.length >= MAX_PROXIES,
              hint: t("frp.errors.too_many_proxies"),
              onSelect: () => setDialog({ index: -1 }),
            },
          ]}
          columns={[
            {
              id: "name",
              header: t("frp.proxy.name"),
              cell: (r) => <span class="font-mono">{r.p.name}</span>,
            },
            {
              id: "type",
              header: t("frp.proxy.type"),
              cell: (r) => (
                <Badge variant="outline">{t(`frp.types.${r.p.type}`)}</Badge>
              ),
            },
            {
              id: "target",
              header: t("frp.target"),
              cell: (r) => <span class="break-all">{target(r.p)}</span>,
            },
            {
              id: "state",
              header: t("frp.proxy_state"),
              cell: (r) => (
                <Show
                  when={statusOf(r.p.name)}
                  fallback={<span class="text-muted-foreground">-</span>}
                >
                  {(s) => (
                    <div class="flex flex-col items-start gap-1">
                      <StatusBadge
                        tone={PHASE_TONE(s().phase)}
                        label={s().phase}
                        detail={s().error || undefined}
                      />
                      <Show when={s().remote_addr}>
                        <span class="break-all font-mono text-xs">
                          {s().remote_addr}
                        </span>
                      </Show>
                    </div>
                  )}
                </Show>
              ),
            },
          ]}
          card={{
            title: (r) => <span class="font-mono">{r.p.name}</span>,
            badges: (r) => (
              <Badge variant="outline">{t(`frp.types.${r.p.type}`)}</Badge>
            ),
            body: (r) => (
              <div class="flex flex-col gap-1">
                <span class="break-all">{target(r.p)}</span>
                <Show when={statusOf(r.p.name)}>
                  {(s) => (
                    <StatusBadge
                      tone={PHASE_TONE(s().phase)}
                      label={s().phase}
                      detail={s().error || undefined}
                    />
                  )}
                </Show>
              </div>
            ),
          }}
          primary={(r) => ({
            id: "edit",
            label: t("global.edit"),
            onSelect: () => setDialog({ index: r.index }),
          })}
          actions={() => [
            {
              id: "delete",
              label: t("global.delete"),
              destructive: true,
              onSelect: removal.ask,
            },
          ]}
        />
        {removal.dialog()}

        <SettingsSection
          id="frp-log"
          title={t("frp.log")}
          actions={
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoScroll()}
                  onChange={(e) => setAutoScroll(e.currentTarget.checked)}
                />
                {t("frp.auto_scroll")}
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void navigator.clipboard?.writeText(lines().join("\n"))
                }
              >
                {t("frp.copy")}
              </Button>
            </div>
          }
        >
          <div class="px-4 pb-4 sm:px-6">
            <pre
              ref={logBox}
              data-testid="frp-log"
              class="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs"
            >
              <Show when={lines().length > 0} fallback={t("frp.log_empty")}>
                <For each={lines()}>{(l) => <div>{l}</div>}</For>
              </Show>
            </pre>
          </div>
        </SettingsSection>
      </SettingsForm>

      <ProxyDialog
        open={dialog() !== undefined}
        initial={editing()}
        index={dialog()?.index ?? -1}
        all={draft.proxies}
        onSave={saveProxy}
        onClose={() => setDialog(undefined)}
      />
      <ConfirmDialog
        open={confirmCluster()}
        onOpenChange={setConfirmCluster}
        title={t("frp.expose_cluster")}
        description={t("frp.expose_cluster_confirm")}
        destructive
        confirmLabel={t("frp.expose_cluster_yes")}
        onConfirm={() => {
          setDraft("exposeCluster", true)
          setConfirmCluster(false)
        }}
      />
    </DataState>
  )
}

export default Frp
