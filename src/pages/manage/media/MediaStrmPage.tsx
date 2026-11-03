import { Button } from "~/components/ui/button"
import { SettingsSection } from "~/features/settings/form/SettingsSection"
import { createSignal, onMount } from "solid-js"
import CommonSettings from "../settings/Common"
import { useT } from "~/hooks"
import { Group, type MediaType } from "~/types"
import { notify } from "~/utils"
import { adminGenerateStrm, getMediaStatus } from "~/utils/media_api"
import { mediaStatus, setMediaStatus } from "~/store/media"

/** STRM 相关设置项 */
const STRM_KEYS = [
  "media_strm_on_scan",
  "media_strm_overwrite",
  "media_strm_same_dir",
  "media_strm_path",
  "media_strm_template",
]

const GENERATE_TYPES: { type: MediaType; label: string }[] = [
  { type: "video", label: "manage.media_lib.strm_gen_video" },
  { type: "music", label: "manage.media_lib.strm_gen_music" },
  { type: "image", label: "manage.media_lib.strm_gen_image" },
  { type: "book", label: "manage.media_lib.strm_gen_book" },
]

const MediaStrmPage = () => {
  const t = useT()
  const [generating, setGenerating] = createSignal<string | null>(null)

  const loadStatus = async () => {
    const resp = await getMediaStatus()
    if (resp.code === 200) setMediaStatus(resp.data)
  }
  onMount(loadStatus)

  const generate = async (mediaType?: MediaType) => {
    setGenerating(mediaType ?? "all")
    const resp = await adminGenerateStrm(mediaType)
    setGenerating(null)
    if (resp.code === 200) {
      notify.success(
        t("manage.media_lib.strm_generated", {
          count: resp.data.written,
          path: resp.data.path,
        }),
      )
      loadStatus()
    } else {
      notify.error(t("manage.media_lib.strm_gen_failed") + ": " + resp.message)
    }
  }

  return (
    <div class="flex w-full flex-col gap-4">
      <h1 class="sr-only">{t("manage.sidemenu.media_strm")}</h1>
      <p class="m-0 text-sm text-muted-foreground">
        {t("manage.media_lib.strm_desc")}
      </p>

      <CommonSettings group={Group.MEDIA} keys={STRM_KEYS} />

      <SettingsSection title={t("manage.media_lib.strm_manual")}>
        <div class="flex flex-col gap-3 py-4">
          <p class="m-0 text-sm text-muted-foreground">
            {t("manage.media_lib.strm_output")}
            {mediaStatus().strm_same_dir
              ? t("manage.media_lib.strm_output_same_dir")
              : mediaStatus().strm_path ||
                t("manage.media_lib.strm_output_missing")}
          </p>
          <div class="flex flex-wrap gap-2">
            {GENERATE_TYPES.map((item) => (
              <Button
                variant="outline"
                size="sm"
                disabled={generating() === item.type}
                onClick={() => generate(item.type)}
              >
                {t(item.label)}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={generating() === "all"}
              onClick={() => generate()}
            >
              {t("manage.media_lib.strm_gen_all")}
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}

export default MediaStrmPage
