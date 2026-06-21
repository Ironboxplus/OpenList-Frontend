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

/** Cluster storage-sharing config (key redacted on read). */
export type ClusterConfig = {
  enabled: boolean
  key: string
  peers: string[]
  share_drivers: string[]
  share_mounts: string[]
  share_deletes: boolean
  apply_remote: boolean
  announce_interval_sec: number
  request_timeout_sec: number
}

export type ClusterRecordView = {
  mount_path: string
  driver: string
  version: number
  origin: string
  tombstone: boolean
  updated_at: number
  self: boolean
}

export type ClusterStatus = {
  node_id: string
  enabled: boolean
  active: boolean
  peers: string[]
  records: ClusterRecordView[]
}

export type ClusterConfigData = {
  config: ClusterConfig
  status: ClusterStatus
}

export const getClusterConfig = (): PResp<ClusterConfigData> =>
  r.get("/admin/cluster/config")

export const setClusterConfig = (
  config: ClusterConfig,
): PResp<ClusterConfigData> => r.post("/admin/cluster/config", config)

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
