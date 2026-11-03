import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { SettingsSection } from "~/features/settings/form/SettingsSection"
import { For, Show, createSignal, onMount } from "solid-js"
import CommonSettings from "../settings/Common"
import { useT } from "~/hooks"
import { Group } from "~/types"
import { notify } from "~/utils"
import {
  adminCreateAppKey,
  adminDeleteAppKey,
  adminListAppKeys,
  getMediaStatus,
  type MediaAppKey,
} from "~/utils/media_api"
import { mediaStatus, setMediaStatus } from "~/store/media"

/** 基础开关（刮削与 STRM 已拆到独立页面） */
const BASE_KEYS = [
  "media_enabled",
  "media_emby_enabled",
  "media_subsonic_enabled",
  "media_subsonic_allow_password_auth",
  "media_subsonic_proxy_stream",
  "media_proxy_cover",
]

/**
 * 媒体基础设置页：总开关与协议开关，下方附带协议地址与应用密钥。
 */
const MediaSettingsPage = () => {
  const t = useT()
  const [keys, setKeys] = createSignal<MediaAppKey[]>([])
  const [keyName, setKeyName] = createSignal("")
  const [plainKey, setPlainKey] = createSignal("")

  const loadStatus = async () => {
    const resp = await getMediaStatus()
    if (resp.code === 200) setMediaStatus(resp.data)
  }

  const loadKeys = async () => {
    const resp = await adminListAppKeys()
    if (resp.code === 200) setKeys(resp.data ?? [])
  }

  onMount(() => {
    loadStatus()
    loadKeys()
  })

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify.success(t("manage.media_lib.copied"))
    } catch {
      notify.error(t("manage.media_lib.copy_failed"))
    }
  }

  const createKey = async () => {
    const resp = await adminCreateAppKey(keyName().trim() || "Media Key")
    if (resp.code === 200) {
      setPlainKey(resp.data.key)
      setKeyName("")
      notify.success(t("manage.media_lib.key_created"))
      await loadKeys()
    } else {
      notify.error(t("manage.media_lib.create_failed") + ": " + resp.message)
    }
  }

  const removeKey = async (key: MediaAppKey) => {
    const resp = await adminDeleteAppKey(key.id)
    if (resp.code === 200) {
      notify.success(t("manage.media_lib.deleted"))
      setKeys((list) => list.filter((k) => k.id !== key.id))
    } else {
      notify.error(t("manage.media_lib.delete_failed") + ": " + resp.message)
    }
  }

  const Protocol = (p: {
    name: string
    enabled: boolean
    url: string
    disabledKey: string
  }) => (
    <div class="flex items-center justify-between gap-3 py-3">
      <div class="min-w-0">
        <div class="font-medium">{p.name}</div>
        <div class="break-all text-xs text-muted-foreground">
          {p.enabled
            ? p.url
            : t("manage.media_lib.protocol_disabled", { key: p.disabledKey })}
        </div>
      </div>
      <Show when={p.enabled}>
        <Button variant="ghost" size="sm" onClick={() => copy(p.url)}>
          {t("manage.media_lib.copy_url")}
        </Button>
      </Show>
    </div>
  )

  return (
    <div class="flex w-full flex-col gap-4">
      <h1 class="sr-only">{t("manage.media_lib.base_title")}</h1>
      <p class="m-0 text-sm text-muted-foreground">
        {t("manage.media_lib.base_desc")}
      </p>

      {/* 服务端设置项：直接复用后台的 SettingItem 渲染器 */}
      <CommonSettings group={Group.MEDIA} keys={BASE_KEYS} />

      {/* 协议接入 */}
      <SettingsSection title={t("manage.media_lib.protocol")}>
        <Protocol
          name="Emby"
          enabled={mediaStatus().emby_enabled}
          url={mediaStatus().emby_base_url}
          disabledKey="media_emby_enabled"
        />
        <Protocol
          name="OpenSubsonic"
          enabled={mediaStatus().subsonic_enabled}
          url={mediaStatus().subsonic_base_url}
          disabledKey="media_subsonic_enabled"
        />
        <p class="m-0 py-3 text-xs text-muted-foreground">
          {t("manage.media_lib.protocol_auth_tip")}
        </p>
      </SettingsSection>

      {/* 应用密钥 */}
      <SettingsSection
        title={t("manage.media_lib.app_keys")}
        description={t("manage.media_lib.app_keys_desc")}
        actions={
          <>
            <Input
              class="h-9 w-48"
              aria-label={t("manage.media_lib.key_note")}
              placeholder={t("manage.media_lib.key_note_placeholder")}
              value={keyName()}
              onInput={(e) => setKeyName(e.currentTarget.value)}
            />
            <Button onClick={createKey}>{t("manage.media_lib.create")}</Button>
          </>
        }
      >
        <div class="flex flex-col gap-3 py-4">
          <Show when={plainKey()}>
            <Alert variant="warning">
              <AlertDescription>
                <div class="font-medium">{t("manage.media_lib.key_once")}</div>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <span class="break-all font-mono">{plainKey()}</span>
                  <Button size="sm" onClick={() => copy(plainKey())}>
                    {t("manage.media_lib.copy")}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </Show>
          <Table>
            <TableHeader>
              <TableRow class="hover:bg-transparent">
                <TableHead>{t("manage.media_lib.key_note")}</TableHead>
                <TableHead>{t("manage.media_lib.key_prefix")}</TableHead>
                <TableHead>{t("manage.media_lib.key_last_used")}</TableHead>
                <TableHead class="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <For
                each={keys()}
                fallback={
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      class="py-6 text-center text-muted-foreground"
                    >
                      {t("manage.media_lib.no_keys")}
                    </TableCell>
                  </TableRow>
                }
              >
                {(key) => (
                  <TableRow>
                    <TableCell>{key.name}</TableCell>
                    <TableCell class="font-mono">{key.prefix}…</TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {key.last_used_at || t("manage.media_lib.key_never")}
                    </TableCell>
                    <TableCell class="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        class="text-destructive hover:text-destructive"
                        onClick={() => removeKey(key)}
                      >
                        {t("manage.media_lib.delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </div>
      </SettingsSection>
    </div>
  )
}

export default MediaSettingsPage
