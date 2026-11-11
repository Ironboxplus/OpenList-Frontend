import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { SettingsSection } from "~/features/settings/form/SettingsSection"
import { useT } from "~/hooks"
import {
  adminSubtitlePrefetchProgress,
  type SubtitlePrefetchProgress as Progress,
} from "~/utils/media_api"

const POLL_MS = 3000

/** Read-only progress of the library subtitle prefetch (已抽 N / 共 M). */
export const SubtitlePrefetchProgress = () => {
  const t = useT()
  const [progress, setProgress] = createSignal<Progress>()
  const [failed, setFailed] = createSignal(false)

  const load = async () => {
    try {
      const resp = await adminSubtitlePrefetchProgress()
      if (resp.code === 200) {
        setProgress(resp.data)
        setFailed(false)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    }
  }

  onMount(() => {
    void load()
    const timer = window.setInterval(load, POLL_MS)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <SettingsSection title={t("manage.media_lib.prefetch_title")}>
      <div class="flex flex-col gap-1 py-3 text-sm" data-testid="prefetch">
        <Show when={failed()}>
          <span class="text-muted-foreground">
            {t("manage.media_lib.prefetch_load_failed")}
          </span>
        </Show>
        <Show when={progress()}>
          {(p) => (
            <>
              <Show
                when={p().enabled}
                fallback={
                  <span class="text-muted-foreground">
                    {t("manage.media_lib.prefetch_idle")}
                  </span>
                }
              >
                <Show
                  when={p().total > 0}
                  fallback={
                    <span class="text-muted-foreground">
                      {t("manage.media_lib.prefetch_enabled_idle")}
                    </span>
                  }
                >
                  <span>
                    {t("manage.media_lib.prefetch_progress", {
                      files: p().files,
                      total: p().total,
                      tracks: p().tracks,
                    })}
                  </span>
                </Show>
                <Show when={p().running && p().current}>
                  <span class="break-all text-xs text-muted-foreground">
                    {t("manage.media_lib.prefetch_running", {
                      path: p().current,
                    })}
                  </span>
                </Show>
                <Show when={p().failed > 0}>
                  <span class="break-all text-xs text-muted-foreground">
                    {t("manage.media_lib.prefetch_failed", {
                      count: p().failed,
                      error: p().error,
                    })}
                  </span>
                </Show>
              </Show>
            </>
          )}
        </Show>
      </div>
    </SettingsSection>
  )
}
