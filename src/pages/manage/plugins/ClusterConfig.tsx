import {
  Badge,
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
import { useT } from "~/hooks"
import { handleResp, notify } from "~/utils"
import {
  ClusterConfig as ClusterConfigT,
  ClusterStatus,
  getClusterConfig,
  setClusterConfig,
} from "./api"

const splitLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

const splitCommas = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)

const Field = (props: { label: string; hint?: string; children: any }) => (
  <VStack w="$full" spacing="$1" alignItems="stretch">
    <Text fontWeight="$medium">{props.label}</Text>
    <Show when={props.hint}>
      <Text fontSize="$xs" color="$neutral10">
        {props.hint}
      </Text>
    </Show>
    {props.children}
  </VStack>
)

const ClusterConfig = () => {
  const t = useT()
  const [cfg, setCfg] = createSignal<ClusterConfigT>()
  const [status, setStatus] = createSignal<ClusterStatus>()
  const [loading, setLoading] = createSignal(true)
  const [busy, setBusy] = createSignal(false)

  // Edit buffers for list/textarea fields.
  const [peers, setPeers] = createSignal("")
  const [drivers, setDrivers] = createSignal("")
  const [mounts, setMounts] = createSignal("")

  const apply = (d: { config: ClusterConfigT; status: ClusterStatus }) => {
    setCfg(d.config)
    setStatus(d.status)
    setPeers((d.config.peers ?? []).join("\n"))
    setDrivers((d.config.share_drivers ?? []).join(", "))
    setMounts((d.config.share_mounts ?? []).join(", "))
  }

  const refresh = async () => {
    setLoading(true)
    handleResp(await getClusterConfig(), apply)
    setLoading(false)
  }
  onMount(refresh)

  const patch = (p: Partial<ClusterConfigT>) => {
    const c = cfg()
    if (c) setCfg({ ...c, ...p })
  }

  const save = async () => {
    const c = cfg()
    if (!c) return
    setBusy(true)
    const payload: ClusterConfigT = {
      ...c,
      peers: splitLines(peers()),
      share_drivers: splitCommas(drivers()),
      share_mounts: splitCommas(mounts()),
      announce_interval_sec: Number(c.announce_interval_sec) || 0,
      request_timeout_sec: Number(c.request_timeout_sec) || 0,
    }
    handleResp(await setClusterConfig(payload), (d) => {
      apply(d)
      notify.success(t("manage.cluster.saved"))
    })
    setBusy(false)
  }

  return (
    <VStack spacing="$2" alignItems="start" w="$full">
      <Heading size="lg">{t("manage.cluster.title")}</Heading>
      <Text color="$neutral10" fontSize="$sm">
        {t("manage.cluster.intro")}
      </Text>

      <Show when={!loading() && cfg()}>
        <VStack
          w="$full"
          spacing="$3"
          p="$4"
          rounded="$lg"
          bgColor="$neutral2"
          alignItems="stretch"
        >
          {/* node identity + live status */}
          <HStack w="$full" justifyContent="space-between" wrap="wrap">
            <HStack spacing="$2" alignItems="center">
              <Text fontSize="$sm" color="$neutral11">
                {t("manage.cluster.node_id")}:
              </Text>
              <Text fontSize="$sm" fontFamily="$mono">
                {status()?.node_id}
              </Text>
            </HStack>
            <Badge colorScheme={status()?.active ? "success" : "neutral"}>
              {status()?.active
                ? t("manage.cluster.active")
                : t("manage.cluster.inactive")}
            </Badge>
          </HStack>

          <HStack spacing="$2" alignItems="center">
            <HopeSwitch
              checked={cfg()!.enabled}
              onChange={(e: Event) =>
                patch({
                  enabled: (e.currentTarget as HTMLInputElement).checked,
                })
              }
            />
            <Text fontWeight="$medium">{t("manage.cluster.enabled")}</Text>
          </HStack>

          <Field
            label={t("manage.cluster.key")}
            hint={t("manage.cluster.key_hint")}
          >
            <Input
              type="password"
              value={cfg()!.key}
              placeholder={t("manage.cluster.key_placeholder")}
              onInput={(e) => patch({ key: e.currentTarget.value })}
            />
          </Field>

          <Field
            label={t("manage.cluster.peers")}
            hint={t("manage.cluster.peers_hint")}
          >
            <Textarea
              value={peers()}
              rows={3}
              spellcheck={false}
              fontFamily="$mono"
              fontSize="$sm"
              placeholder={
                "https://node2.example.com\nhttps://node3.example.com"
              }
              onInput={(e) => setPeers(e.currentTarget.value)}
            />
          </Field>

          <Field
            label={t("manage.cluster.share_drivers")}
            hint={t("manage.cluster.share_drivers_hint")}
          >
            <Input
              value={drivers()}
              placeholder="115 Open, BaiduNetdisk"
              onInput={(e) => setDrivers(e.currentTarget.value)}
            />
          </Field>

          <Field
            label={t("manage.cluster.share_mounts")}
            hint={t("manage.cluster.share_mounts_hint")}
          >
            <Input
              value={mounts()}
              placeholder="/115, /baidu"
              onInput={(e) => setMounts(e.currentTarget.value)}
            />
          </Field>

          <HStack spacing="$2" alignItems="center">
            <HopeSwitch
              checked={cfg()!.apply_remote}
              onChange={(e: Event) =>
                patch({
                  apply_remote: (e.currentTarget as HTMLInputElement).checked,
                })
              }
            />
            <VStack spacing="0" alignItems="start">
              <Text fontWeight="$medium">
                {t("manage.cluster.apply_remote")}
              </Text>
              <Text fontSize="$xs" color="$neutral10">
                {t("manage.cluster.apply_remote_hint")}
              </Text>
            </VStack>
          </HStack>

          <HStack spacing="$2" alignItems="center">
            <HopeSwitch
              checked={cfg()!.share_deletes}
              onChange={(e: Event) =>
                patch({
                  share_deletes: (e.currentTarget as HTMLInputElement).checked,
                })
              }
            />
            <VStack spacing="0" alignItems="start">
              <Text fontWeight="$medium">
                {t("manage.cluster.share_deletes")}
              </Text>
              <Text fontSize="$xs" color="$neutral10">
                {t("manage.cluster.share_deletes_hint")}
              </Text>
            </VStack>
          </HStack>

          <HStack spacing="$4" wrap="wrap">
            <Field label={t("manage.cluster.announce_interval")}>
              <Input
                type="number"
                w="120px"
                value={cfg()!.announce_interval_sec}
                onInput={(e) =>
                  patch({
                    announce_interval_sec: Number(e.currentTarget.value),
                  })
                }
              />
            </Field>
            <Field label={t("manage.cluster.request_timeout")}>
              <Input
                type="number"
                w="120px"
                value={cfg()!.request_timeout_sec}
                onInput={(e) =>
                  patch({ request_timeout_sec: Number(e.currentTarget.value) })
                }
              />
            </Field>
          </HStack>

          <HStack justifyContent="end">
            <Button loading={busy()} onClick={save}>
              {t("global.save")}
            </Button>
          </HStack>
        </VStack>

        {/* Synced records (no secrets shown) */}
        <Show when={(status()?.records?.length ?? 0) > 0}>
          <VStack w="$full" spacing="$1" alignItems="stretch">
            <Text fontWeight="$medium">
              {t("manage.cluster.synced_records")}
            </Text>
            <For each={status()!.records}>
              {(r) => (
                <HStack
                  w="$full"
                  p="$2"
                  rounded="$md"
                  bgColor="$neutral2"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <HStack spacing="$2" alignItems="center">
                    <Text fontSize="$sm" fontFamily="$mono">
                      {r.mount_path}
                    </Text>
                    <Badge colorScheme="neutral" variant="subtle">
                      {r.driver}
                    </Badge>
                    <Show when={r.tombstone}>
                      <Badge colorScheme="danger" variant="subtle">
                        {t("manage.cluster.deleted")}
                      </Badge>
                    </Show>
                    <Show when={r.self}>
                      <Badge colorScheme="info" variant="subtle">
                        {t("manage.cluster.self")}
                      </Badge>
                    </Show>
                  </HStack>
                  <Text fontSize="$xs" color="$neutral10">
                    v{r.version}
                  </Text>
                </HStack>
              )}
            </For>
          </VStack>
        </Show>
      </Show>
    </VStack>
  )
}

export default ClusterConfig
