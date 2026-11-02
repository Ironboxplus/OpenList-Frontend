import { createEffect, createMemo, For, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { FieldRenderer } from "~/features/settings/form"
import { emptyProxy, proxyErrors, type ProxyDraft } from "~/features/frp/draft"
import { useT } from "~/hooks"
import { Type, type FrpProxyType } from "~/types"

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const TYPES: FrpProxyType[] = ["http", "tcp", "stcp"]

export interface ProxyDialogProps {
  open: boolean
  /** The proxy being edited; undefined adds a new one. */
  initial?: ProxyDraft
  /** Its place among `all` (-1 when new). */
  index: number
  /** Every proxy of the page, for the duplicate-name check. */
  all: ProxyDraft[]
  onSave: (p: ProxyDraft) => void
  onClose: () => void
}

/** Adds or edits one tunnel. Nothing leaves the dialog until the page is saved. */
export const ProxyDialog = (props: ProxyDialogProps) => {
  const t = useT()
  const [p, setP] = createStore<ProxyDraft>(emptyProxy())
  createEffect(() => {
    if (props.open) setP(reconcile(clone(props.initial ?? emptyProxy())))
  })

  // The other proxies of the page: an edited one does not clash with its old self.
  const others = createMemo(() => props.all.filter((_, i) => i !== props.index))
  const errors = createMemo(() => proxyErrors(p, [...others(), p]))
  const secretShown = () => (p.secret.kind === "set" ? p.secret.value : "")

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(props.initial ? "frp.proxy.edit" : "frp.proxy.add")}
          </DialogTitle>
          <DialogDescription class="sr-only">
            {t("frp.proxy.add")}
          </DialogDescription>
        </DialogHeader>
        <FieldRenderer
          stacked
          field={{
            id: "frp_proxy_name",
            type: Type.String,
            labelKey: "frp.proxy.name",
            helpKey: "frp.proxy.name_help",
            required: true,
          }}
          value={p.name}
          onChange={(raw) => setP("name", String(raw))}
        />
        <FieldRenderer
          stacked
          field={{
            id: "frp_proxy_type",
            type: Type.Select,
            labelKey: "frp.proxy.type",
            options: TYPES.map((v) => ({
              value: v,
              labelKey: `frp.types.${v}`,
            })),
          }}
          value={p.type}
          onChange={(raw) => setP("type", String(raw) as FrpProxyType)}
        />
        <p class="-mt-2 text-xs text-muted-foreground">
          {t("frp.proxy.no_https")}
        </p>
        <Show when={p.type === "http"}>
          <FieldRenderer
            stacked
            field={{
              id: "frp_proxy_domains",
              type: Type.Text,
              labelKey: "frp.proxy.domains",
              helpKey: "frp.proxy.domains_help",
              rows: 3,
            }}
            value={p.domains}
            onChange={(raw) => setP("domains", String(raw))}
          />
          <FieldRenderer
            stacked
            field={{
              id: "frp_proxy_subdomain",
              type: Type.String,
              labelKey: "frp.proxy.subdomain",
            }}
            value={p.subdomain}
            onChange={(raw) => setP("subdomain", String(raw))}
          />
        </Show>
        <Show when={p.type === "tcp"}>
          <FieldRenderer
            stacked
            field={{
              id: "frp_proxy_port",
              type: Type.String,
              labelKey: "frp.proxy.remote_port",
              helpKey: "frp.proxy.remote_port_help",
              required: true,
            }}
            value={p.remotePort}
            onChange={(raw) => setP("remotePort", String(raw))}
          />
        </Show>
        <Show when={p.type === "stcp"}>
          <FieldRenderer
            stacked
            field={{
              id: "frp_proxy_secret",
              type: Type.String,
              labelKey: "frp.proxy.secret",
              helpKey: "frp.proxy.secret_help",
              secret: true,
              required: true,
              placeholder:
                p.secretSet && p.secret.kind === "keep"
                  ? t("frp.secret_saved")
                  : undefined,
            }}
            value={secretShown()}
            onChange={(raw) => {
              const v = String(raw)
              setP(
                "secret",
                v === "" ? { kind: "keep" } : { kind: "set", value: v },
              )
            }}
          />
          <Show when={p.secretSet && p.secret.kind !== "clear"}>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setP("secret", { kind: "clear" })}
              >
                {t("frp.secret_clear")}
              </Button>
            </div>
          </Show>
          <Show when={p.secret.kind === "clear"}>
            <p class="text-xs text-muted-foreground">
              {t("frp.secret_will_clear")}
            </p>
          </Show>
        </Show>
        <Show
          when={errors().length > 0 && (p.name !== "" || p.type !== "http")}
        >
          <Alert variant="warning">
            <AlertDescription>
              <ul class="list-disc pl-4">
                <For each={errors()}>
                  {(e) => <li>{t(`frp.errors.${e}`)}</li>}
                </For>
              </ul>
            </AlertDescription>
          </Alert>
        </Show>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={props.onClose}>
            {t("global.cancel")}
          </Button>
          <Button
            type="button"
            disabled={errors().length > 0}
            onClick={() => props.onSave(clone(p))}
          >
            {t("global.ok")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
