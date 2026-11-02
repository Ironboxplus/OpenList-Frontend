// The built-in frp client's admin API (GET/POST /admin/frp, /status, /runtime).

export type FrpProxyType = "http" | "tcp" | "stcp"

export interface FrpProxy {
  /** Stable identity of a proxy (its stcp key follows it through a rename). */
  id?: string
  name: string
  type: FrpProxyType
  custom_domains: string[]
  subdomain: string
  remote_port: number
  /** The stcp key is never sent back, only whether one is stored. */
  secret_set: boolean
}

export type FrpState = "stopped" | "connecting" | "running" | "error"

export interface FrpView {
  enabled: boolean
  server_addr: string
  server_port: number
  tls: boolean
  token_set: boolean
  expose_cluster: boolean
  proxies: FrpProxy[]
  state: FrpState
  state_message: string
}

export interface FrpProxyStatus {
  name: string
  phase: string
  error?: string
  remote_addr?: string
}

export interface FrpStatus {
  state: FrpState
  state_message?: string
  proxies: FrpProxyStatus[]
  gateway?: string
}

export interface FrpProxyReq {
  id?: string
  name: string
  type: FrpProxyType
  custom_domains: string[]
  subdomain: string
  remote_port: number
  /** Absent: keep the stored key. "": clear it. Text: replace it. */
  secret_key?: string
}

export interface FrpSaveReq {
  enabled: boolean
  server_addr: string
  server_port: number
  tls: boolean
  /** Absent: keep the stored token. "": clear it. Text: replace it. */
  token?: string
  expose_cluster: boolean
  proxies: FrpProxyReq[]
}

export interface FrpSaveResp {
  state: FrpState
  state_message: string
}
