import { Show, createSignal, onMount } from "solid-js"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { SimpleSelect } from "~/components/ui/simple-select"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"
import { SettingsSection } from "~/features/settings/form/SettingsSection"
import { useT } from "~/hooks"
import type { MediaConfig } from "~/types"
import { notify } from "~/utils"
import { adminGetMediaConfigs, adminSaveMediaConfig } from "~/utils/media_api"
import { Field } from "./Field"

interface ThumbnailSettingsProps {
  mediaType: "image" | "book"
}

interface ScraperConfig {
  store_thumbnail?: string
  thumbnail_mode?: string
  thumbnail_path?: string
  [key: string]: string | undefined
}

/**
 * 图片 / 书籍类型独立的缩略图设置。
 * 配置写入 MediaConfig.scraper_config，后端刮削时优先读取；
 * 未配置时回落到「媒体设置」里的全局缩略图设置。
 */
export const ThumbnailSettings = (props: ThumbnailSettingsProps) => {
  const t = useT()
  const [loading, setLoading] = createSignal(true)
  const [saving, setSaving] = createSignal(false)
  const [cfg, setCfg] = createSignal<MediaConfig | null>(null)
  const [storeThumbnail, setStoreThumbnail] = createSignal(false)
  const [mode, setMode] = createSignal<"base64" | "runtime" | "local">(
    "runtime",
  )
  const [path, setPath] = createSignal("/imgs")

  const parse = (raw?: string): ScraperConfig => {
    if (!raw) return {}
    try {
      const obj = JSON.parse(raw)
      return obj && typeof obj === "object" ? obj : {}
    } catch {
      return {}
    }
  }

  const load = async () => {
    setLoading(true)
    const resp = await adminGetMediaConfigs()
    if (resp.code === 200) {
      const found = (resp.data as MediaConfig[]).find(
        (c) => c.media_type === props.mediaType,
      )
      if (found) {
        setCfg(found)
        const sc = parse(found.scraper_config)
        setStoreThumbnail(sc.store_thumbnail === "true")
        setMode(
          sc.thumbnail_mode === "local" || sc.thumbnail_mode === "base64"
            ? sc.thumbnail_mode
            : "runtime",
        )
        setPath(sc.thumbnail_path || "/imgs")
      }
    }
    setLoading(false)
  }
  onMount(load)

  const save = async () => {
    const current = cfg()
    if (!current) {
      notify.error(t("manage.media_lib.thumb_config_missing"))
      return
    }
    setSaving(true)
    const sc = parse(current.scraper_config)
    if (props.mediaType === "image") {
      sc.store_thumbnail = storeThumbnail() ? "true" : "false"
    }
    sc.thumbnail_mode = mode()
    sc.thumbnail_path = path()
    const resp = await adminSaveMediaConfig({
      ...current,
      scraper_config: JSON.stringify(sc),
    })
    setSaving(false)
    if (resp.code === 200) {
      notify.success(t("manage.media_lib.thumb_saved"))
      await load()
    } else {
      notify.error(
        t("manage.media_lib.thumb_save_failed") + ": " + resp.message,
      )
    }
  }

  return (
    <SettingsSection
      title={
        props.mediaType === "image"
          ? t("manage.media_lib.thumb_image_title")
          : t("manage.media_lib.thumb_book_title")
      }
      description={t("manage.media_lib.thumb_scope", {
        type:
          props.mediaType === "image"
            ? t("manage.media_lib.type_image")
            : t("manage.media_lib.type_book"),
      })}
      actions={
        <Button disabled={saving()} onClick={save}>
          {t("manage.media_lib.save")}
        </Button>
      }
    >
      <Show when={!loading()} fallback={<Skeleton class="my-4 h-24 w-full" />}>
        <div class="flex flex-col gap-4 py-4">
          <Show when={props.mediaType === "image"}>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Switch
                class="flex items-center gap-2"
                checked={storeThumbnail()}
                onChange={setStoreThumbnail}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel class="text-sm font-medium">
                  {t("manage.media_lib.thumb_store")}
                </SwitchLabel>
              </Switch>
              <span class="text-xs text-muted-foreground">
                {t("manage.media_lib.thumb_store_tips")}
              </span>
            </div>
          </Show>

          <Field
            label={t("manage.media_lib.thumb_mode")}
            help={
              mode() === "base64"
                ? t("manage.media_lib.mode_base64_tips")
                : mode() === "runtime"
                  ? t("manage.media_lib.mode_runtime_tips")
                  : t("manage.media_lib.mode_local_tips")
            }
          >
            <SimpleSelect
              aria-label={t("manage.media_lib.thumb_mode")}
              options={[
                { value: "base64", label: t("manage.media_lib.mode_base64") },
                { value: "runtime", label: t("manage.media_lib.mode_runtime") },
                { value: "local", label: t("manage.media_lib.mode_local") },
              ]}
              value={mode()}
              onChange={(v) => setMode(v as "base64" | "runtime" | "local")}
            />
          </Field>

          <Show when={mode() === "local"}>
            <Field
              label={t("manage.media_lib.thumb_path")}
              help={t("manage.media_lib.thumb_path_tips_local")}
            >
              <Input
                placeholder="/imgs"
                value={path()}
                onInput={(e) => setPath(e.currentTarget.value)}
              />
            </Field>
          </Show>

          <Alert variant="info">
            <AlertDescription>
              {t("manage.media_lib.thumb_rerun")}
            </AlertDescription>
          </Alert>
        </div>
      </Show>
    </SettingsSection>
  )
}
