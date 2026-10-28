import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Switch as HopeSwitch,
  Text,
  Textarea,
  VStack,
} from "@hope-ui/solid"
import { createMemo, createSignal, For, Index, onMount, Show } from "solid-js"
import { AiOutlineEye, AiOutlineEyeInvisible } from "solid-icons/ai"
import { useT } from "~/hooks"
import { handleResp, notify } from "~/utils"
import {
  ClusterConfig as ClusterConfigT,
  ClusterGroupSpec,
  ClusterGroupView,
  ClusterStatus,
  getClusterConfig,
  getClusterKey,
  setClusterConfig,
  setClusterGroups,
  setClusterRefresher,
} from "./api"
import ClusterGraph from "./ClusterGraph"

const splitLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

const rid = () => {
  try {
    return crypto.randomUUID().slice(0, 8)
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
}

const ago = (t: number) => {
  if (!t) return "—"
  const d = Math.max(0, Math.floor(Date.now() / 1000) - t)
  if (d < 60) return `${d}s`
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

const span = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return m ? `${h}h${m}m` : `${h}h`
}

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

const Stat = (props: {
  label: string
  value: string | number
  accent?: string
}) => (
  <VStack
    spacing="0"
    px="$4"
    py="$2"
    rounded="$lg"
    bgColor="$neutral2"
    minW="92px"
    alignItems="start"
  >
    <Text
      fontSize="$xl"
      fontWeight="$bold"
      color={props.accent ?? "$neutral12"}
    >
      {props.value}
    </Text>
    <Text fontSize="$xs" color="$neutral10">
      {props.label}
    </Text>
  </VStack>
)

const ClusterConfig = () => {
  const t = useT()
  const [cfg, setCfg] = createSignal<ClusterConfigT>()
  const [status, setStatus] = createSignal<ClusterStatus>()
  const [loading, setLoading] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [savingGroups, setSavingGroups] = createSignal(false)
  // The key is redacted ("********") on read; reveal fetches the plaintext once.
  const [showKey, setShowKey] = createSignal(false)
  const [revealing, setRevealing] = createSignal(false)

  const [seeds, setSeeds] = createSignal("")
  const [groups, setGroups] = createSignal<ClusterGroupSpec[]>([])

  const applyData = (d: { config: ClusterConfigT; status: ClusterStatus }) => {
    setCfg(d.config)
    setStatus(d.status)
    setSeeds((d.config.seeds ?? []).join("\n"))
    syncGroupsFromStatus(d.status)
  }
  const applyStatus = (s: ClusterStatus) => {
    setStatus(s)
    syncGroupsFromStatus(s)
  }
  const syncGroupsFromStatus = (s: ClusterStatus) => {
    setGroups(
      (s.groups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        members: g.members.map((m) => ({
          node_id: m.node_id,
          mount_path: m.mount_path,
        })),
      })),
    )
  }

  const refresh = async () => {
    setLoading(true)
    handleResp(await getClusterConfig(), applyData)
    setLoading(false)
  }
  onMount(() => {
    refresh()
    // Live-ish refresh of the status panel while the page is open.
    const timer = setInterval(async () => {
      if (busy() || savingGroups()) return
      handleResp(await getClusterConfig(), (d) => {
        setCfg((prev) => prev ?? d.config)
        setStatus(d.status)
      })
    }, 5000)
    return () => clearInterval(timer)
  })

  const patch = (p: Partial<ClusterConfigT>) => {
    const c = cfg()
    if (c) setCfg({ ...c, ...p })
  }

  // Toggle key visibility. When revealing a still-redacted key, fetch the real
  // value from the dedicated endpoint so the field shows the plaintext (rather
  // than the "********" placeholder). Edited keys are shown as-typed.
  const toggleShowKey = async () => {
    if (!showKey() && cfg()?.key === "********") {
      setRevealing(true)
      handleResp(await getClusterKey(), (d) => patch({ key: d.key }))
      setRevealing(false)
    }
    setShowKey((v) => !v)
  }

  const save = async () => {
    const c = cfg()
    if (!c) return
    setBusy(true)
    const payload: ClusterConfigT = {
      ...c,
      seeds: splitLines(seeds()),
      announce_interval_sec: Number(c.announce_interval_sec) || 0,
    }
    handleResp(await setClusterConfig(payload), (d) => {
      applyData(d)
      notify.success(t("manage.cluster.saved"))
    })
    setBusy(false)
  }

  const [preferBusy, setPreferBusy] = createSignal(false)
  const prefer = async (groupID: string, nodeID: string) => {
    setPreferBusy(true)
    handleResp(await setClusterRefresher(groupID, nodeID), (s) => {
      // Only the status: the groups draft may hold unsaved edits.
      setStatus(s)
      notify.success(t("manage.cluster.saved"))
    })
    setPreferBusy(false)
  }

  const saveGroups = async () => {
    setSavingGroups(true)
    // drop empty groups / members before saving
    const clean = groups()
      .map((g) => ({
        ...g,
        members: g.members.filter((m) => m.node_id && m.mount_path),
      }))
      .filter((g) => g.members.length > 0)
    handleResp(await setClusterGroups(clean), (s) => {
      applyStatus(s)
      notify.success(t("manage.cluster.saved"))
    })
    setSavingGroups(false)
  }

  // ---- group editing helpers ----
  const addGroup = () =>
    setGroups([...groups(), { id: rid(), name: "", members: [] }])
  const removeGroup = (id: string) =>
    setGroups(groups().filter((g) => g.id !== id))
  const renameGroup = (id: string, name: string) =>
    setGroups(groups().map((g) => (g.id === id ? { ...g, name } : g)))
  const addMember = (id: string, value: string) => {
    if (!value) return
    const [node_id, mount_path] = value.split(" ")
    setGroups(
      groups().map((g) =>
        g.id === id
          ? {
              ...g,
              members: g.members.some(
                (m) => m.node_id === node_id && m.mount_path === mount_path,
              )
                ? g.members
                : [...g.members, { node_id, mount_path }],
            }
          : g,
      ),
    )
  }
  const removeMember = (id: string, node_id: string, mount_path: string) =>
    setGroups(
      groups().map((g) =>
        g.id === id
          ? {
              ...g,
              members: g.members.filter(
                (m) => !(m.node_id === node_id && m.mount_path === mount_path),
              ),
            }
          : g,
      ),
    )

  const nodeLabel = (nodeID: string) => {
    const n = status()?.nodes.find((x) => x.node_id === nodeID)
    return n?.label || nodeID.slice(0, 8)
  }
  // saved server-side view of a group (for sync state badges).
  const savedGroup = (id: string): ClusterGroupView | undefined =>
    status()?.groups.find((g) => g.id === id)
  const memberView = (gid: string, nodeID: string, mount: string) =>
    savedGroup(gid)?.members.find(
      (m) => m.node_id === nodeID && m.mount_path === mount,
    )

  // Live graph preview from the (possibly unsaved) edits.
  const graphGroups = createMemo<ClusterGroupView[]>(() =>
    groups().map((g) => ({
      id: g.id,
      name: g.name || g.id,
      members: g.members.map((m) => ({
        node_id: m.node_id,
        mount_path: m.mount_path,
        label: nodeLabel(m.node_id),
        online: true,
        present: true,
        is_origin: false,
        self: false,
      })),
      fields: [],
      cred_hash: "",
      version: 0,
      origin: "",
      updated_at: 0,
      has_cred: false,
    })),
  )

  // candidate storages to add to a group (all nodes' storages).
  const candidates = (g: ClusterGroupSpec) => {
    const out: { value: string; label: string }[] = []
    for (const n of status()?.nodes ?? []) {
      for (const s of n.storages) {
        const taken = g.members.some(
          (m) => m.node_id === n.node_id && m.mount_path === s.mount_path,
        )
        if (taken) continue
        out.push({
          value: n.node_id + " " + s.mount_path,
          label: `${n.label || n.node_id.slice(0, 8)} · ${s.mount_path}`,
        })
      }
    }
    return out
  }

  const refresherPanel = (g: ClusterGroupView) => {
    const seen = new Set<string>()
    const nodes = g.members.filter((m) => {
      if (seen.has(m.node_id)) return false
      seen.add(m.node_id)
      return true
    })
    const name = (id: string) =>
      g.members.find((m) => m.node_id === id)?.label || id.slice(0, 8)
    const lagging = g.members.filter((m) => m.laggard)
    const lease = g.refresher
    const lr = g.last_refresh
    const trig = (x: string) =>
      x === "proactive" || x === "refresh-request" || x === "recover"
        ? t(`manage.cluster.trigger_${x.replace("-", "_")}`)
        : t("manage.cluster.trigger_code", { code: x })
    return (
      <VStack
        w="$full"
        spacing="$1_5"
        p="$2_5"
        rounded="$md"
        bgColor="$neutral1"
        border="1px solid $neutral4"
        alignItems="stretch"
        data-testid="cluster-refresher"
      >
        <HStack wrap="wrap" gap="$2" alignItems="center">
          <Text fontWeight="$medium">{t("manage.cluster.refresher")}</Text>
          <Show
            when={lease?.valid}
            fallback={
              <Badge colorScheme="warning" variant="subtle">
                {t("manage.cluster.no_refresher")}
              </Badge>
            }
          >
            <Badge colorScheme="success" variant="subtle">
              {lease!.label || name(lease!.node_id)}
              {lease!.self ? ` · ${t("manage.cluster.self")}` : ""}
            </Badge>
            <Text fontSize="$xs" color="$neutral10">
              {t("manage.cluster.lease_info", {
                epoch: lease!.epoch,
                n: span(lease!.expires_in),
              })}
            </Text>
          </Show>
          <Box flex={1} />
          <Text fontSize="$xs" color="$neutral10">
            {t("manage.cluster.preferred")}
          </Text>
          <Menu>
            <MenuTrigger
              as={Button}
              size="xs"
              variant="outline"
              disabled={preferBusy()}
            >
              {g.preferred
                ? name(g.preferred)
                : t("manage.cluster.preferred_auto")}
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => prefer(g.id, "")}>
                {t("manage.cluster.preferred_auto")}
              </MenuItem>
              <For each={nodes}>
                {(m) => (
                  <MenuItem onSelect={() => prefer(g.id, m.node_id)}>
                    {m.label || m.node_id.slice(0, 8)}
                  </MenuItem>
                )}
              </For>
            </MenuContent>
          </Menu>
        </HStack>
        <Show
          when={lr}
          fallback={
            <Text fontSize="$xs" color="$neutral10">
              {t("manage.cluster.no_refresh_yet")}
            </Text>
          }
        >
          <Text fontSize="$xs">
            <Text as="span" color="$neutral10">
              {t("manage.cluster.last_refresh")}:
            </Text>{" "}
            {lr!.label || name(lr!.node_id)} · {ago(lr!.time)} ·{" "}
            <Badge
              colorScheme={lr!.outcome === "ok" ? "success" : "danger"}
              variant="subtle"
            >
              {lr!.outcome === "ok"
                ? t("manage.cluster.refresh_ok", { n: span(lr!.expires_in) })
                : t("manage.cluster.refresh_failed", {
                    code: lr!.err_code || lr!.outcome,
                  })}
            </Badge>{" "}
            · {trig(lr!.trigger)}
          </Text>
        </Show>
        <Show when={(g.expires_at ?? 0) > 0}>
          <Text fontSize="$xs" color="$neutral10">
            {t("manage.cluster.token_expires", {
              n: span((g.expires_at ?? 0) - Math.floor(Date.now() / 1000)),
            })}
          </Text>
        </Show>
        <Show when={lagging.length > 0}>
          <Text fontSize="$xs" color="$warning9" data-testid="cluster-laggards">
            {t("manage.cluster.laggards", {
              names: lagging
                .map(
                  (m) =>
                    `${m.label || m.node_id.slice(0, 8)} v${m.held_version ?? 0}`,
                )
                .join(", "),
              v: g.version,
            })}
          </Text>
        </Show>
        <Show when={g.mixed}>
          <Text fontSize="$xs" color="$warning9">
            {t("manage.cluster.mixed_warning")}
          </Text>
        </Show>
        <Show when={(g.requests ?? []).length > 0}>
          <VStack spacing="$0_5" alignItems="stretch">
            <Text fontSize="$xs" color="$neutral10">
              {t("manage.cluster.requests_title")}
            </Text>
            <For each={(g.requests ?? []).slice(0, 5)}>
              {(q) => (
                <HStack spacing="$1_5" alignItems="baseline" wrap="wrap">
                  <Text fontSize="$xs" color="$neutral9" w="36px">
                    {ago(q.time)}
                  </Text>
                  <Badge
                    variant="subtle"
                    colorScheme={q.direction === "sent" ? "info" : "neutral"}
                  >
                    {q.direction === "sent"
                      ? t("manage.cluster.request_sent")
                      : t("manage.cluster.request_received")}
                  </Badge>
                  <Text fontSize="$xs">
                    {q.peer_label || (q.peer ? q.peer.slice(0, 8) : "—")} ·{" "}
                    <Text as="span" fontFamily="$mono">
                      {q.mount}
                    </Text>{" "}
                    · {q.result}
                  </Text>
                </HStack>
              )}
            </For>
          </VStack>
        </Show>
      </VStack>
    )
  }

  const st = () => status()
  const stats = () => st()?.stats

  return (
    <VStack spacing="$3" alignItems="start" w="$full">
      <Heading size="lg">{t("manage.cluster.title")}</Heading>
      <Text color="$neutral10" fontSize="$sm">
        {t("manage.cluster.intro")}
      </Text>

      <Show when={!loading() && cfg() && st()}>
        {/* ---- stats row ---- */}
        <HStack wrap="wrap" gap="$3" w="$full">
          <Stat
            label={t("manage.cluster.stats_nodes")}
            value={`${stats()!.nodes_online}/${stats()!.nodes_total}`}
            accent="$success10"
          />
          <Stat
            label={t("manage.cluster.stats_groups")}
            value={stats()!.groups_total}
          />
          <Stat
            label={t("manage.cluster.stats_creds")}
            value={stats()!.creds_total}
          />
          <Stat
            label={t("manage.cluster.stats_connections")}
            value={stats()!.connections}
          />
          <Box flex={1} />
          <VStack alignItems="end" spacing="$1">
            <Badge colorScheme={st()!.active ? "success" : "neutral"}>
              {st()!.active
                ? t("manage.cluster.active")
                : t("manage.cluster.inactive")}
            </Badge>
            <Text fontSize="$xs" color="$neutral10" fontFamily="$mono">
              {st()!.node_id}
            </Text>
          </VStack>
        </HStack>

        {/* ---- settings ---- */}
        <VStack
          w="$full"
          spacing="$3"
          p="$4"
          rounded="$lg"
          bgColor="$neutral2"
          alignItems="stretch"
        >
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

          {/* cluster key with its OWN save button */}
          <Field
            label={t("manage.cluster.key")}
            hint={t("manage.cluster.key_hint")}
          >
            <HStack spacing="$2">
              <InputGroup flex={1}>
                <Input
                  type={showKey() ? "text" : "password"}
                  value={cfg()!.key}
                  placeholder={t("manage.cluster.key_placeholder")}
                  fontFamily={showKey() ? "$mono" : undefined}
                  onInput={(e) => patch({ key: e.currentTarget.value })}
                />
                <InputRightElement>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    color="$neutral10"
                    loading={revealing()}
                    aria-label={showKey() ? "hide key" : "show key"}
                    icon={
                      showKey() ? <AiOutlineEyeInvisible /> : <AiOutlineEye />
                    }
                    onClick={toggleShowKey}
                  />
                </InputRightElement>
              </InputGroup>
              <Button loading={busy()} onClick={save}>
                {t("manage.cluster.save_key")}
              </Button>
            </HStack>
          </Field>

          <HStack spacing="$3" wrap="wrap" w="$full">
            <Box flex={1} minW="200px">
              <Field
                label={t("manage.cluster.label")}
                hint={t("manage.cluster.label_hint")}
              >
                <Input
                  value={cfg()!.label}
                  placeholder="cfscan"
                  onInput={(e) => patch({ label: e.currentTarget.value })}
                />
              </Field>
            </Box>
            <Box flex={1} minW="200px">
              <Field
                label={t("manage.cluster.addr")}
                hint={t("manage.cluster.addr_hint")}
              >
                <Input
                  value={cfg()!.addr}
                  placeholder="https://node1.example.com"
                  onInput={(e) => patch({ addr: e.currentTarget.value })}
                />
              </Field>
            </Box>
          </HStack>

          <Field
            label={t("manage.cluster.seeds")}
            hint={t("manage.cluster.seeds_hint")}
          >
            <Textarea
              value={seeds()}
              rows={2}
              spellcheck={false}
              fontFamily="$mono"
              fontSize="$sm"
              placeholder={"https://node2.example.com"}
              onInput={(e) => setSeeds(e.currentTarget.value)}
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

          <HStack spacing="$4" wrap="wrap" alignItems="end">
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
            <Box flex={1} />
            <Button loading={busy()} onClick={save}>
              {t("global.save")}
            </Button>
          </HStack>
        </VStack>

        {/* ---- sync groups editor ---- */}
        <HStack w="$full" justifyContent="space-between" alignItems="center">
          <Heading size="lg">{t("manage.cluster.groups_title")}</Heading>
          <HStack spacing="$2">
            <Button variant="outline" size="sm" onClick={addGroup}>
              + {t("manage.cluster.new_group")}
            </Button>
            <Button size="sm" loading={savingGroups()} onClick={saveGroups}>
              {t("manage.cluster.save_groups")}
            </Button>
          </HStack>
        </HStack>
        <Text fontSize="$xs" color="$neutral10">
          {t("manage.cluster.groups_hint")}
        </Text>

        <Show
          when={groups().length > 0}
          fallback={
            <Text color="$neutral9" fontSize="$sm">
              {t("manage.cluster.no_groups")}
            </Text>
          }
        >
          <VStack w="$full" spacing="$3" alignItems="stretch">
            {/* Index (not For) keeps each group row's DOM stable across edits, so
                typing in the name input doesn't recreate the row and drop focus. */}
            <Index each={groups()}>
              {(g) => {
                const saved = () => savedGroup(g().id)
                return (
                  <VStack
                    w="$full"
                    spacing="$2"
                    p="$3"
                    rounded="$lg"
                    bgColor="$neutral2"
                    alignItems="stretch"
                    border="1px solid $neutral4"
                  >
                    <HStack spacing="$2" alignItems="center">
                      <Input
                        flex={1}
                        size="sm"
                        value={g().name}
                        placeholder={t("manage.cluster.group_name")}
                        onInput={(e) =>
                          renameGroup(g().id, e.currentTarget.value)
                        }
                      />
                      <Show when={saved()?.has_cred}>
                        <Badge colorScheme="success" variant="subtle">
                          v{saved()!.version} · {saved()!.cred_hash}
                        </Badge>
                      </Show>
                      <Show when={saved() && !saved()!.has_cred}>
                        <Badge colorScheme="warning" variant="subtle">
                          {t("manage.cluster.not_synced")}
                        </Badge>
                      </Show>
                      <Button
                        size="xs"
                        colorScheme="danger"
                        variant="ghost"
                        onClick={() => removeGroup(g().id)}
                      >
                        {t("manage.cluster.delete_group")}
                      </Button>
                    </HStack>

                    {/* member chips */}
                    <HStack wrap="wrap" gap="$2">
                      <For each={g().members}>
                        {(m) => {
                          const mv = () =>
                            memberView(g().id, m.node_id, m.mount_path)
                          return (
                            <HStack
                              spacing="$1"
                              px="$2"
                              py="$1"
                              rounded="$md"
                              bgColor="$neutral4"
                              alignItems="center"
                            >
                              <Box
                                w="8px"
                                h="8px"
                                rounded="$full"
                                bgColor={
                                  mv()?.online ? "$success9" : "$neutral8"
                                }
                              />
                              <Show when={mv()?.is_origin}>
                                <Text fontSize="$xs" title="credential source">
                                  ★
                                </Text>
                              </Show>
                              <Show when={mv()?.refresher}>
                                <Text
                                  fontSize="$xs"
                                  color="$success10"
                                  title={t("manage.cluster.refresher")}
                                >
                                  ⟳
                                </Text>
                              </Show>
                              <Text fontSize="$sm">{nodeLabel(m.node_id)}</Text>
                              <Text
                                fontSize="$sm"
                                color="$neutral10"
                                fontFamily="$mono"
                              >
                                {m.mount_path}
                              </Text>
                              <Show when={mv()?.proto === 1}>
                                <Badge
                                  colorScheme="warning"
                                  variant="subtle"
                                  title={t("manage.cluster.legacy_hint")}
                                >
                                  {t("manage.cluster.legacy")}
                                </Badge>
                              </Show>
                              <Show
                                when={mv() && (mv()!.held_version ?? 0) > 0}
                              >
                                <Text
                                  fontSize="$xs"
                                  color={
                                    mv()!.laggard ? "$warning9" : "$neutral10"
                                  }
                                  fontWeight={
                                    mv()!.laggard ? "$semibold" : undefined
                                  }
                                  data-laggard={
                                    mv()!.laggard ? "true" : undefined
                                  }
                                  title={t("manage.cluster.held_version")}
                                >
                                  v{mv()!.held_version}
                                </Text>
                              </Show>
                              <Show when={mv() && !mv()!.present}>
                                <Text
                                  fontSize="$xs"
                                  color="$warning9"
                                  title="mount not found on node"
                                >
                                  ?
                                </Text>
                              </Show>
                              <Box
                                as="button"
                                ml="$1"
                                color="$neutral10"
                                onClick={() =>
                                  removeMember(g().id, m.node_id, m.mount_path)
                                }
                              >
                                ✕
                              </Box>
                            </HStack>
                          )
                        }}
                      </For>

                      {/* add member */}
                      <Menu>
                        <MenuTrigger
                          as={Button}
                          size="xs"
                          variant="outline"
                          disabled={candidates(g()).length === 0}
                        >
                          + {t("manage.cluster.add_storage")}
                        </MenuTrigger>
                        <MenuContent maxH="320px" overflowY="auto">
                          <For
                            each={candidates(g())}
                            fallback={
                              <MenuItem disabled>
                                {t("manage.cluster.no_storage_left")}
                              </MenuItem>
                            }
                          >
                            {(c) => (
                              <MenuItem
                                onSelect={() => addMember(g().id, c.value)}
                              >
                                {c.label}
                              </MenuItem>
                            )}
                          </For>
                        </MenuContent>
                      </Menu>
                    </HStack>

                    <Show
                      when={
                        saved() &&
                        (saved()!.refresh_group ||
                          saved()!.refresher ||
                          saved()!.last_refresh)
                      }
                    >
                      {refresherPanel(saved()!)}
                    </Show>

                    <Show
                      when={saved()?.has_cred && saved()!.fields.length > 0}
                    >
                      <Text fontSize="$xs" color="$neutral10">
                        {t("manage.cluster.synced_fields")}:{" "}
                        {saved()!.fields.join(", ")} ·{" "}
                        {t("manage.cluster.last_update")}{" "}
                        {ago(saved()!.updated_at)}
                      </Text>
                    </Show>
                  </VStack>
                )
              }}
            </Index>
          </VStack>
        </Show>

        {/* ---- visual graph mirror ---- */}
        <Heading size="lg">{t("manage.cluster.graph_title")}</Heading>
        <Box w="$full" p="$3" rounded="$lg" bgColor="$neutral2">
          <ClusterGraph nodes={st()!.nodes} groups={graphGroups()} />
        </Box>

        {/* ---- nodes ---- */}
        <Heading size="lg">{t("manage.cluster.nodes_title")}</Heading>
        <VStack w="$full" spacing="$2" alignItems="stretch">
          <For each={st()!.nodes}>
            {(n) => (
              <HStack
                w="$full"
                p="$2"
                px="$3"
                rounded="$md"
                bgColor="$neutral2"
                justifyContent="space-between"
                alignItems="center"
              >
                <HStack spacing="$2" alignItems="center">
                  <Box
                    w="10px"
                    h="10px"
                    rounded="$full"
                    bgColor={n.online ? "$success9" : "$neutral8"}
                  />
                  <Text fontWeight="$medium">
                    {n.label || n.node_id.slice(0, 8)}
                  </Text>
                  <Show when={n.self}>
                    <Badge colorScheme="info" variant="subtle">
                      {t("manage.cluster.self")}
                    </Badge>
                  </Show>
                  <Show when={n.addr}>
                    <Text fontSize="$xs" color="$neutral10" fontFamily="$mono">
                      {n.addr}
                    </Text>
                  </Show>
                </HStack>
                <Text fontSize="$xs" color="$neutral10">
                  {n.storages.length} {t("manage.cluster.storages")} ·{" "}
                  {n.online ? t("manage.cluster.online") : ago(n.last_seen)}
                </Text>
              </HStack>
            )}
          </For>
        </VStack>

        {/* ---- connections + events ---- */}
        <HStack w="$full" gap="$4" alignItems="start" wrap="wrap">
          <Show
            when={(st()!.links?.length ?? 0) > 0}
            fallback={
              <VStack flex={1} minW="260px" spacing="$2" alignItems="stretch">
                <Heading size="sm">
                  {t("manage.cluster.connections_title")}
                </Heading>
                <Show
                  when={(st()!.connections?.length ?? 0) > 0}
                  fallback={
                    <Text fontSize="$sm" color="$neutral9">
                      {t("manage.cluster.no_connections")}
                    </Text>
                  }
                >
                  <For each={st()!.connections}>
                    {(c) => (
                      <HStack
                        spacing="$2"
                        p="$2"
                        rounded="$md"
                        bgColor="$neutral2"
                        justifyContent="space-between"
                      >
                        <HStack spacing="$2">
                          <Badge
                            colorScheme={c.outbound ? "primary" : "neutral"}
                            variant="subtle"
                          >
                            {c.outbound ? "→" : "←"}
                          </Badge>
                          <Text fontSize="$sm">{nodeLabel(c.node_id)}</Text>
                        </HStack>
                        <Text fontSize="$xs" color="$neutral10">
                          {ago(c.since)}
                        </Text>
                      </HStack>
                    )}
                  </For>
                </Show>
              </VStack>
            }
          >
            <VStack
              flex={1}
              minW="320px"
              spacing="$2"
              alignItems="stretch"
              data-testid="cluster-links"
            >
              <Heading size="sm">{t("manage.cluster.links_title")}</Heading>
              <Text fontSize="$xs" color="$neutral10">
                {t("manage.cluster.links_hint")}
              </Text>
              <Box overflowX="auto">
                <table style={{ width: "100%", "font-size": "12px" }}>
                  <thead>
                    <tr style={{ "text-align": "left" }}>
                      <th>{t("manage.cluster.link_peer")}</th>
                      <th>{t("manage.cluster.link_state")}</th>
                      <th>RTT</th>
                      <th>{t("manage.cluster.link_queue")}</th>
                      <th>{t("manage.cluster.link_sync")}</th>
                      <th>{t("manage.cluster.link_drops")}</th>
                      <th>{t("manage.cluster.link_reason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={st()!.links}>
                      {(l) => (
                        <tr>
                          <td>
                            {l.label || nodeLabel(l.node_id)}
                            <Show when={l.proto === 1}>
                              {" "}
                              <Badge colorScheme="warning" variant="subtle">
                                {t("manage.cluster.legacy")}
                              </Badge>
                            </Show>
                          </td>
                          <td>
                            {l.connected
                              ? `${l.outbound ? "→" : "←"} ${ago(l.since)}`
                              : t("manage.cluster.link_down")}
                          </td>
                          <td>{l.connected ? `${l.rtt_ms} ms` : "—"}</td>
                          <td>{l.connected ? l.queue_depth : "—"}</td>
                          <td>
                            {l.last_anti_entropy
                              ? ago(l.last_anti_entropy)
                              : "—"}
                          </td>
                          <td
                            style={{
                              color: l.flaps_10m >= 3 ? "orange" : undefined,
                            }}
                          >
                            {l.disconnects}
                            {l.flaps_10m > 0 ? ` (${l.flaps_10m} / 10m)` : ""}
                          </td>
                          <td>
                            {l.last_reason || "—"}
                            {l.last_disconnect_at
                              ? ` · ${ago(l.last_disconnect_at)}`
                              : ""}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Box>
            </VStack>
          </Show>

          <VStack flex={1} minW="260px" spacing="$2" alignItems="stretch">
            <Heading size="sm">{t("manage.cluster.events_title")}</Heading>
            <Show
              when={(st()!.events?.length ?? 0) > 0}
              fallback={
                <Text fontSize="$sm" color="$neutral9">
                  {t("manage.cluster.no_events")}
                </Text>
              }
            >
              <VStack
                spacing="$1"
                alignItems="stretch"
                maxH="240px"
                overflowY="auto"
              >
                <For each={st()!.events}>
                  {(e) => (
                    <HStack spacing="$2" alignItems="baseline">
                      <Text fontSize="$xs" color="$neutral9" w="36px">
                        {ago(e.time)}
                      </Text>
                      <Badge
                        variant="subtle"
                        colorScheme={
                          e.kind === "apply"
                            ? "success"
                            : e.kind === "share"
                              ? "primary"
                              : "neutral"
                        }
                      >
                        {e.kind}
                      </Badge>
                      <Text fontSize="$xs" color="$neutral11">
                        {e.detail}
                      </Text>
                    </HStack>
                  )}
                </For>
              </VStack>
            </Show>
          </VStack>
        </HStack>
      </Show>
    </VStack>
  )
}

export default ClusterConfig
