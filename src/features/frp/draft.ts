// The frp page's form state: what the admin has typed, kept apart from what the
// server holds, and the translation between the two. Pure, so it is testable
// without a page.
import type {
  FrpProxy,
  FrpProxyReq,
  FrpProxyType,
  FrpSaveReq,
  FrpView,
} from "~/types"

/** The backend's rules (internal/frp/config.go), so the page can say so before saving. */
export const MAX_PROXIES = 16
const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/

/** What to do with a stored secret: leave it, replace it, or clear it. */
export type SecretEdit =
  { kind: "keep" } | { kind: "set"; value: string } | { kind: "clear" }

export interface ProxyDraft {
  id?: string
  name: string
  type: FrpProxyType
  /** One per line, or separated by commas. */
  domains: string
  subdomain: string
  remotePort: string
  secret: SecretEdit
  /** A key is stored for this proxy. */
  secretSet: boolean
}

export interface FrpDraft {
  enabled: boolean
  serverAddr: string
  serverPort: string
  tls: boolean
  exposeCluster: boolean
  token: SecretEdit
  tokenSet: boolean
  proxies: ProxyDraft[]
}

export const parseDomains = (text: string): string[] =>
  text
    .split("\n")
    .flatMap((line) => line.split(","))
    .map((s) => s.trim())
    .filter(Boolean)

export const proxyFromView = (p: FrpProxy): ProxyDraft => ({
  id: p.id,
  name: p.name,
  type: p.type,
  domains: (p.custom_domains ?? []).join("\n"),
  subdomain: p.subdomain ?? "",
  remotePort: p.remote_port ? String(p.remote_port) : "",
  secret: { kind: "keep" },
  secretSet: p.secret_set,
})

export const emptyProxy = (): ProxyDraft => ({
  name: "",
  type: "http",
  domains: "",
  subdomain: "",
  remotePort: "",
  secret: { kind: "keep" },
  secretSet: false,
})

export const draftFromView = (v: FrpView): FrpDraft => ({
  enabled: v.enabled,
  serverAddr: v.server_addr,
  serverPort: String(v.server_port),
  tls: v.tls,
  exposeCluster: v.expose_cluster,
  token: { kind: "keep" },
  tokenSet: v.token_set,
  proxies: (v.proxies ?? []).map(proxyFromView),
})

/** An i18n key under `frp.errors.` per problem, in the order the user meets them. */
export const proxyErrors = (p: ProxyDraft, all: ProxyDraft[]): string[] => {
  const errors: string[] = []
  if (!NAME_RE.test(p.name)) errors.push("name_invalid")
  else if (all.filter((o) => o !== p && o.name === p.name).length > 0)
    errors.push("name_duplicate")
  if (p.type === "http") {
    if (parseDomains(p.domains).length === 0 && p.subdomain.trim() === "")
      errors.push("http_needs_host")
  } else if (p.type === "tcp") {
    const n = Number(p.remotePort)
    if (!Number.isInteger(n) || n < 1 || n > 65535)
      errors.push("tcp_needs_port")
  } else if (p.type === "stcp") {
    const hasKey =
      p.secret.kind === "set"
        ? p.secret.value !== ""
        : p.secret.kind === "keep" && p.secretSet
    if (!hasKey) errors.push("stcp_needs_secret")
  }
  return errors
}

/** Everything that stops an enabled client from being saved (a disabled one may be half done). */
export const draftErrors = (d: FrpDraft): string[] => {
  if (!d.enabled) return []
  const errors: string[] = []
  const addr = d.serverAddr.trim()
  if (addr === "") errors.push("server_required")
  else if (/[\s/]/.test(addr)) errors.push("server_invalid")
  const port = Number(d.serverPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    errors.push("port_invalid")
  if (d.proxies.length === 0) errors.push("no_proxy")
  if (d.proxies.length > MAX_PROXIES) errors.push("too_many_proxies")
  if (d.proxies.some((p) => proxyErrors(p, d.proxies).length > 0))
    errors.push("proxy_invalid")
  return errors
}

const secretField = (e: SecretEdit): string | undefined =>
  e.kind === "set" ? e.value : e.kind === "clear" ? "" : undefined

const proxyReq = (p: ProxyDraft): FrpProxyReq => {
  const req: FrpProxyReq = {
    id: p.id,
    name: p.name.trim(),
    type: p.type,
    custom_domains: p.type === "http" ? parseDomains(p.domains) : [],
    subdomain: p.type === "http" ? p.subdomain.trim() : "",
    remote_port: p.type === "tcp" ? Number(p.remotePort) : 0,
  }
  if (p.type === "stcp") {
    const s = secretField(p.secret)
    if (s !== undefined) req.secret_key = s
  } else if (p.secretSet) {
    // A proxy that is no longer stcp should not keep a key behind.
    req.secret_key = ""
  }
  return req
}

/** The save request: secrets travel only when the admin touched them. */
export const toSaveRequest = (d: FrpDraft): FrpSaveReq => {
  const req: FrpSaveReq = {
    enabled: d.enabled,
    server_addr: d.serverAddr.trim(),
    server_port: Number(d.serverPort) || 0,
    tls: d.tls,
    expose_cluster: d.exposeCluster,
    proxies: d.proxies.map(proxyReq),
  }
  const token = secretField(d.token)
  if (token !== undefined) req.token = token
  return req
}
