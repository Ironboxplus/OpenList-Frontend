import { r } from "~/utils"
import { PResp } from "~/types"

/** A backend (Go-source, yaegi) plugin and its current load status. */
export type GoPlugin = {
  name: string
  enabled: boolean
  loaded: boolean
  error?: string
}

export type FrontendPlugin = { id: string; url: string }

export type PluginListData = {
  go: GoPlugin[]
  frontend: FrontendPlugin[]
}

export const listBackendPlugins = (): PResp<PluginListData> =>
  r.get("/admin/plugin/list")

export const getBackendPlugin = (
  name: string,
): PResp<{ name: string; source: string }> =>
  r.get(`/admin/plugin/get?name=${encodeURIComponent(name)}`)

export const saveBackendPlugin = (
  name: string,
  source: string,
): PResp<GoPlugin[]> => r.post("/admin/plugin/save", { name, source })

export const deleteBackendPlugin = (name: string): PResp<GoPlugin[]> =>
  r.post("/admin/plugin/delete", { name })

export const enableBackendPlugin = (
  name: string,
  enabled: boolean,
): PResp<GoPlugin[]> => r.post("/admin/plugin/enable", { name, enabled })

/**
 * Cluster credential-sharing config (key redacted on read). The cluster shares
 * ONLY credentials (tokens/cookies/secrets) between manually-paired storages, so
 * there are no driver/mount filters here — pairing is done via sync groups.
 */
export type ClusterConfig = {
  enabled: boolean
  key: string
  /** Human-friendly name for THIS node, shown on every node's cluster panel. */
  label: string
  /** This node's public base URL; advertising it lets peers auto-discover it. */
  addr: string
  /** Optional bootstrap peer URLs to dial when first joining a cluster. */
  seeds: string[]
  apply_remote: boolean
  announce_interval_sec: number
  /** Optional refresher timing overrides (0/absent = default). */
  lease_ttl_sec?: number
  refresh_request_wait_sec?: number
  proactive_min_gap_sec?: number
  delivery_resend_sec?: number
  revocation_retention_days?: number
}

export type ClusterStorageInfo = {
  mount_path: string
  driver: string
  status: string
  /** Credential pair the mount uses: short hash and catalogue version. */
  cred_hash?: string
  cred_ver?: number
}

export type ClusterNodeView = {
  node_id: string
  label: string
  addr: string
  self: boolean
  online: boolean
  last_seen: number
  storages: ClusterStorageInfo[]
}

export type ClusterMemberView = {
  node_id: string
  label: string
  mount_path: string
  online: boolean
  present: boolean
  is_origin: boolean
  self: boolean
  /** Credential version this member actually holds (0 = unknown). */
  held_version?: number
  held_hash?: string
  /** Online but behind the group's current version. */
  laggard?: boolean
  /** Protocol level: 1 = predates refresher leases (still refreshes alone). */
  proto?: number
  /** Currently holds the refresher lease / is the admin's preferred refresher. */
  refresher?: boolean
  preferred?: boolean
}

export type ClusterRefresherView = {
  node_id: string
  label: string
  self: boolean
  epoch: number
  /** The lease currently designates a live holder. */
  valid: boolean
  /** Seconds until the lease lapses without renewal (<= 0: lapsed). */
  expires_in: number
  ttl_sec: number
}

export type ClusterRefreshView = {
  time: number
  node_id: string
  label: string
  mount: string
  /** API error code, "proactive", "refresh-request" or "recover". */
  trigger: string
  outcome: "ok" | "api_error" | "transport_error" | string
  err_code: number
  /** Lifetime in seconds of the access token obtained. */
  expires_in: number
}

export type ClusterRequestView = {
  time: number
  direction: "sent" | "received" | string
  peer: string
  peer_label: string
  group_id: string
  mount: string
  result: string
}

export type ClusterGroupView = {
  id: string
  name: string
  members: ClusterMemberView[]
  fields: string[]
  cred_hash: string
  version: number
  origin: string
  updated_at: number
  has_cred: boolean
  /** Unix seconds the newest access token lapses (0 = unknown). */
  expires_at?: number
  /** The group takes part in single-refresher leases. */
  refresh_group?: boolean
  refresher?: ClusterRefresherView
  /** Admin's preferred refresher node id (empty = automatic). */
  preferred?: string
  last_refresh?: ClusterRefreshView
  requests?: ClusterRequestView[]
  /** A member without leases is still refreshing on its own. */
  mixed?: boolean
}

export type ClusterConnView = {
  node_id: string
  addr: string
  outbound: boolean
  since: number
  queue_depth?: number
  rtt_ms?: number
  last_anti_entropy?: number
  proto?: number
}

/** Health of the link to one peer, connected or not. */
export type ClusterLinkView = {
  node_id: string
  label: string
  connected: boolean
  outbound: boolean
  since: number
  queue_depth: number
  rtt_ms: number
  /** Unix seconds of the last hello/announce/reply received (0 = never). */
  last_anti_entropy: number
  connects: number
  disconnects: number
  /** Disconnects in the last 10 minutes. */
  flaps_10m: number
  last_reason: string
  last_disconnect_at: number
  proto: number
}

export type ClusterEventView = {
  time: number
  kind: string
  group_id: string
  detail: string
}

export type ClusterStatsView = {
  nodes_total: number
  nodes_online: number
  groups_total: number
  creds_total: number
  connections: number
}

export type ClusterStatus = {
  node_id: string
  label: string
  addr: string
  enabled: boolean
  active: boolean
  nodes: ClusterNodeView[]
  groups: ClusterGroupView[]
  connections: ClusterConnView[]
  links?: ClusterLinkView[]
  requests?: ClusterRequestView[]
  proto?: number
  rev_digest?: string
  events: ClusterEventView[]
  stats: ClusterStatsView
}

export type ClusterConfigData = {
  config: ClusterConfig
  status: ClusterStatus
}

/** A sync group as edited by the admin (sent back to the server). */
export type ClusterGroupSpec = {
  id: string
  name: string
  members: { node_id: string; mount_path: string }[]
}

export const getClusterConfig = (): PResp<ClusterConfigData> =>
  r.get("/admin/cluster/config")

/** Fetch the cluster key in plaintext (for the "show key" toggle). */
export const getClusterKey = (): PResp<{ key: string }> =>
  r.get("/admin/cluster/key")

export const setClusterConfig = (
  config: ClusterConfig,
): PResp<ClusterConfigData> => r.post("/admin/cluster/config", config)

export const getClusterStatus = (): PResp<ClusterStatus> =>
  r.get("/admin/cluster/status")

export const setClusterGroups = (
  groups: ClusterGroupSpec[],
): PResp<ClusterStatus> => r.post("/admin/cluster/groups", { groups })

/** Set (or with an empty node id, clear) the group's preferred refresher. */
export const setClusterRefresher = (
  group_id: string,
  node_id: string,
): PResp<ClusterStatus> =>
  r.post("/admin/cluster/refresher", { group_id, node_id })

/** Starter source shown when creating a new backend plugin. */
export const PLUGIN_TEMPLATE = `package main

import plugin "github.com/OpenListTeam/OpenList/v4/internal/plugin"

// OnLoad runs once when the plugin is (re)loaded. The api lets you subscribe to
// hooks, log, and read/write settings. Plugins may import the Go standard
// library; backend internals are intentionally out of reach.
func OnLoad(api plugin.API) {
	api.Log("hello from my plugin")

	// React to events. Mutations to c.Payload are visible to later handlers.
	api.Subscribe(plugin.HookFsListAfter, 0, func(c *plugin.HookContext) error {
		api.Logf("listed %v (%v items)", c.Payload["path"], c.Payload["count"])
		return nil
	})
}

// OnUnload is optional; it runs before the plugin is removed or hot-reloaded.
func OnUnload() {}
`
