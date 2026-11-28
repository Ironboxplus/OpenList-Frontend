import { createMemo, createSignal, For, Match, onMount, Switch } from "solid-js"
import { createStorageSignal } from "@solid-primitives/storage"
import { useFetch, useManageTitle, useRouter, useT } from "~/hooks"
import { EmptyResp, PageResp, PluginItem, Resp } from "~/types"
import { handleResp, notify, pluginEngine, r } from "~/utils"
import { PluginGridItem, PluginListItem } from "./Plugin"
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "~/components/overlay"
import { Button } from "~/components/ui/button"
import { SimpleSelect } from "~/components/ui/simple-select"
import { SwitchField } from "~/components/ui/toggle-field"
import { Textarea } from "~/components/ui/input"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

const Plugins = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.plugins")
  const { to } = useRouter()

  const [plugins, setPlugins] = createSignal<PluginItem[]>([])
  const [selectedType, setSelectedType] = createSignal<string>("all")

  // Modals state
  const [importModalOpen, setImportModalOpen] = createSignal(false)
  const [importJsonText, setImportJsonText] = createSignal("")

  const [layout, setLayout] = createStorageSignal(
    "plugins-layout",
    "table" as "grid" | "table",
  )

  const [loading, fetchPlugins] = useFetch((): Promise<PageResp<PluginItem>> =>
    r.get("/admin/plugin/list"),
  )

  const refresh = async () => {
    const resp = await fetchPlugins()
    handleResp(resp, (data) => {
      setPlugins(data.content || [])
    })
  }

  onMount(() => {
    refresh()
  })

  const shownPlugins = createMemo(() => {
    const type = selectedType()
    return plugins().filter((p) => {
      if (type === "all") return true
      return p.type === type
    })
  })

  // Actions
  const handleToggle = async (plugin: PluginItem) => {
    const resp: Resp<{ id: string; enabled: boolean }> = await r.post(
      "/admin/plugin/toggle",
      { id: plugin.id, enabled: !plugin.enabled },
    )
    handleResp(resp, (data) => {
      setPlugins((prev) =>
        prev.map((p) =>
          p.id === data.id ? { ...p, enabled: data.enabled } : p,
        ),
      )
      if (data.enabled) {
        pluginEngine.loadPlugin({ ...plugin, enabled: true })
        notify.success(t("global.enable") + " " + t("global.success"))
      } else {
        pluginEngine.unloadPlugin(plugin.id)
        notify.info(t("global.disable") + " " + t("global.success"))
      }
    })
  }

  const handleDelete = async (plugin: PluginItem) => {
    const resp: EmptyResp = await r.post(`/admin/plugin/delete?id=${plugin.id}`)
    handleResp(resp, () => {
      pluginEngine.unloadPlugin(plugin.id)
      setPlugins((prev) => prev.filter((p) => p.id !== plugin.id))
      notify.success(t("global.delete_success"))
    })
  }

  const handleExportJson = () => {
    const dataStr = JSON.stringify(plugins(), null, 2)
    const blob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `openlist-plugins-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify.success(t("plugins.actions.export") + " " + t("global.success"))
  }

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(importJsonText())
      if (!Array.isArray(parsed)) {
        notify.error("Invalid JSON: must be an array of plugins")
        return
      }
      const resp: Resp<{ count: number }> = await r.post(
        "/admin/plugin/batch_save",
        parsed,
      )
      handleResp(resp, () => {
        notify.success(t("global.success"))
        setImportModalOpen(false)
        setImportJsonText("")
        refresh()
      })
    } catch (e: any) {
      notify.error("JSON parse failed: " + e.message)
    }
  }

  const categories = [
    { key: "all", label: t("plugins.types.all") },
    { key: "ui", label: t("plugins.types.ui") },
    { key: "preview", label: t("plugins.types.preview") },
    { key: "tool", label: t("plugins.types.tool") },
    { key: "theme", label: t("plugins.types.theme") },
    { key: "integration", label: t("plugins.types.integration") },
    { key: "system", label: t("plugins.types.system") },
  ]

  return (
    <div class="flex flex-col items-start w-full gap-y-3">
      {/* Top Operations Bar */}
      <div class="flex w-full flex-row flex-wrap items-center gap-2 md:flex-nowrap">
        <Button variant="subtle" loading={loading()} onClick={refresh}>
          {t("global.refresh")}
        </Button>
        <Button
          variant="subtle"
          onClick={() => {
            to("/@manage/plugins/add")
          }}
        >
          {t("global.add")}
        </Button>
        <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
          {t("plugins.actions.import")}
        </Button>
        <Button variant="secondary" onClick={handleExportJson}>
          {t("plugins.actions.export")}
        </Button>

        <div class="flex flex-row items-center gap-x-1">
          <span>{t("storages.other.layout")}</span>
          <SwitchField
            aria-label={t("storages.other.layout")}
            checked={layout() === "grid"}
            onChange={(on) => setLayout(on ? "grid" : "table")}
          />
        </div>

        <SimpleSelect
          class="w-40"
          options={categories.map((c) => ({ value: c.key, label: c.label }))}
          value={selectedType()}
          onChange={setSelectedType}
        />
      </div>

      {/* Main Content Layout */}
      <Switch>
        <Match when={layout() === "table"}>
          <div class="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("plugins.name")}</TableHead>
                  <TableHead>{t("plugins.type")}</TableHead>
                  <TableHead>{t("plugins.version")}</TableHead>
                  <TableHead>{t("plugins.author")}</TableHead>
                  <TableHead>{t("plugins.status")}</TableHead>
                  <TableHead>{t("global.operations")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <For each={shownPlugins()}>
                  {(plugin) => (
                    <PluginListItem
                      plugin={plugin}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  )}
                </For>
              </TableBody>
            </Table>
          </div>
        </Match>

        <Match when={layout() === "grid"}>
          <div class="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <For each={shownPlugins()}>
              {(plugin) => (
                <PluginGridItem
                  plugin={plugin}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              )}
            </For>
          </div>
        </Match>
      </Switch>

      {/* Import JSON Modal */}
      <Modal
        opened={importModalOpen()}
        onClose={() => setImportModalOpen(false)}
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalHeader>{t("plugins.import_modal.title")}</ModalHeader>
          <ModalBody>
            <div class="flex flex-col items-stretch gap-y-3">
              <p class="text-sm text-muted-foreground">
                {t("plugins.import_modal.paste_json")}
              </p>
              <Textarea
                rows={10}
                placeholder='[{"id": "plugin-1", "name": "...", "enabled": true}]'
                value={importJsonText()}
                onInput={(e: any) => setImportJsonText(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <div class="flex flex-row items-center gap-x-2">
              <Button
                variant="secondary"
                onClick={() => setImportModalOpen(false)}
              >
                {t("global.cancel")}
              </Button>
              <Button variant="subtle" onClick={handleImportJson}>
                {t("plugins.actions.import")}
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default Plugins
