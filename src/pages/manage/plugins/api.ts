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
}

export type ClusterStorageInfo = {
  mount_path: string
  driver: string
  status: string
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
}

export type ClusterConnView = {
  node_id: string
  addr: string
  outbound: boolean
  since: number
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
