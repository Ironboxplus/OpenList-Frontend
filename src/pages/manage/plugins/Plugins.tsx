import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Switch as HopeSwitch,
  Text,
  Textarea,
  VStack,
} from "@hope-ui/solid"
import { createSignal, For, onMount, Show } from "solid-js"
import { useManageTitle, useT } from "~/hooks"
import { plugins, setPluginEnabled } from "~/plugins"
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

const Plugins = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.plugins")

  const [backend, setBackend] = createSignal<GoPlugin[]>([])
  const [loading, setLoading] = createSignal(true)

  // Editor state. editing="" with isNew=true → creating; editing=name → editing.
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

  const remove = async (p: GoPlugin) => {
    if (!window.confirm(t("manage.plugin_delete_confirm", { name: p.name })))
      return
    handleResp(await deleteBackendPlugin(p.name), (data) => {
      setBackend(data ?? [])
      notify.success(t("manage.plugin_deleted"))
    })
  }

  const toggle = async (p: GoPlugin, enabled: boolean) => {
    handleResp(await enableBackendPlugin(p.name, enabled), (data) =>
      setBackend(data ?? []),
    )
  }

  return (
    <VStack spacing="$5" alignItems="start" w="$full">
      <Heading size="xl">{t("manage.sidemenu.plugins")}</Heading>

      {/* ---- Backend (server) plugins ---- */}
      <VStack spacing="$2" alignItems="start" w="$full">
        <HStack w="$full" justifyContent="space-between" alignItems="center">
          <Heading size="lg">{t("manage.plugins_backend_title")}</Heading>
          <Button size="sm" onClick={openNew}>
            {t("manage.plugin_new")}
          </Button>
        </HStack>
        <Text color="$neutral10" fontSize="$sm">
          {t("manage.plugins_backend_intro")}
        </Text>

        <Show when={editorOpen()}>
          <VStack
            w="$full"
            spacing="$2"
            p="$4"
            rounded="$lg"
            bgColor="$neutral2"
            alignItems="stretch"
          >
            <Text fontWeight="$medium">{t("manage.plugin_name")}</Text>
            <Input
              value={name()}
              disabled={!isNew()}
              placeholder={t("manage.plugin_name_placeholder")}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <Text fontWeight="$medium">{t("manage.plugin_source")}</Text>
            <Textarea
              value={source()}
              rows={18}
              spellcheck={false}
              fontFamily="$mono"
              fontSize="$sm"
              onInput={(e) => setSource(e.currentTarget.value)}
            />
            <HStack spacing="$2" justifyContent="end">
              <Button
                variant="subtle"
                colorScheme="neutral"
                onClick={() => setEditorOpen(false)}
              >
                {t("global.cancel")}
              </Button>
              <Button loading={busy()} onClick={save}>
                {t("manage.plugin_save")}
              </Button>
            </HStack>
          </VStack>
        </Show>

        <Show
          when={backend().length > 0}
          fallback={
            <Show when={!loading()}>
              <Text color="$neutral9">{t("manage.plugins_backend_empty")}</Text>
            </Show>
          }
        >
          <VStack w="$full" spacing="$2">
            <For each={backend()}>
              {(p) => (
                <VStack
                  w="$full"
                  p="$3"
                  rounded="$lg"
                  bgColor="$neutral2"
                  alignItems="stretch"
                  spacing="$1"
                >
                  <HStack w="$full" justifyContent="space-between">
                    <HStack spacing="$2" alignItems="center">
                      <Text fontWeight="$medium">{p.name}</Text>
                      <Show
                        when={p.enabled}
                        fallback={
                          <Badge colorScheme="neutral">
                            {t("manage.plugin_disabled")}
                          </Badge>
                        }
                      >
                        <Badge colorScheme={p.loaded ? "success" : "warning"}>
                          {p.loaded
                            ? t("manage.plugin_loaded")
                            : t("manage.plugin_not_loaded")}
                        </Badge>
                      </Show>
                    </HStack>
                    <HStack spacing="$2" alignItems="center">
                      <HopeSwitch
                        checked={p.enabled}
                        onChange={(e: Event) =>
                          toggle(
                            p,
                            (e.currentTarget as HTMLInputElement).checked,
                          )
                        }
                      />
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => openEdit(p)}
                      >
                        {t("manage.plugin_edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="subtle"
                        colorScheme="danger"
                        onClick={() => remove(p)}
                      >
                        {t("manage.plugin_delete")}
                      </Button>
                    </HStack>
                  </HStack>
                  <Show when={p.error}>
                    <Text fontSize="$sm" color="$danger9" fontFamily="$mono">
                      {t("manage.plugin_load_error")}: {p.error}
                    </Text>
                  </Show>
                </VStack>
              )}
            </For>
          </VStack>
        </Show>
      </VStack>

      {/* ---- Frontend (UI) plugins ---- */}
      <VStack spacing="$2" alignItems="start" w="$full">
        <Heading size="lg">{t("manage.plugins_frontend_title")}</Heading>
        <Text color="$neutral10" fontSize="$sm">
          {t("manage.plugins_intro")}
        </Text>
        <Show
          when={plugins().length > 0}
          fallback={<Text color="$neutral9">{t("manage.plugins_empty")}</Text>}
        >
          <VStack w="$full" spacing="$2">
            <For each={plugins()}>
              {(p) => (
                <HStack
                  w="$full"
                  p="$3"
                  rounded="$lg"
                  bgColor="$neutral2"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <HStack spacing="$2" alignItems="center">
                      <Text fontWeight="$medium">{p.name ?? p.id}</Text>
                      <Show when={p.version}>
                        <Badge colorScheme="neutral">v{p.version}</Badge>
                      </Show>
                    </HStack>
                    <Text fontSize="$sm" color="$neutral9">
                      {p.id}
                    </Text>
                    <HStack spacing="$1" mt="$1" wrap="wrap">
                      <For each={p.contributions}>
                        {(c) => (
                          <Badge colorScheme="info" variant="subtle">
                            {c.slot}
                          </Badge>
                        )}
                      </For>
                    </HStack>
                  </Box>
                  <HopeSwitch
                    checked={p.enabled !== false}
                    onChange={(e: Event) =>
                      setPluginEnabled(
                        p.id,
                        (e.currentTarget as HTMLInputElement).checked,
                      )
                    }
                  />
                </HStack>
              )}
            </For>
          </VStack>
        </Show>
      </VStack>

      {/* ---- Cluster storage sharing ---- */}
      <ClusterConfig />
    </VStack>
  )
}

export default Plugins
