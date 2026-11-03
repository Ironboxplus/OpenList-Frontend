import { For, Show } from "solid-js"
import { TbCheck, TbPalette } from "solid-icons/tb"
import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover"
import { useT } from "~/hooks"
import {
  ACCENT_PRESETS,
  accentColor,
  mediaAccentEnabled,
  resetAccentColor,
  setAccentColor,
  setMediaAccentEnabled,
} from "~/store/accent"

/** Choose the colour the media pages use (kept in this browser). */
export const MediaAccentPicker = () => {
  const t = useT()
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger
        as={Button}
        variant="ghost"
        size="sm"
        class="shrink-0 gap-2 text-muted-foreground"
        aria-label={t("media.accent.title")}
        title={t("media.accent.title")}
      >
        <TbPalette class="size-4 shrink-0" />
        <span class="hidden sm:inline">{t("media.accent.title")}</span>
      </PopoverTrigger>
      <PopoverContent class="flex w-56 flex-col gap-3">
        <PopoverTitle class="text-sm font-medium">
          {t("media.accent.title")}
        </PopoverTitle>
        <div class="flex flex-wrap gap-2">
          <For each={ACCENT_PRESETS}>
            {(preset) => (
              <button
                type="button"
                title={preset.name}
                aria-label={preset.name}
                class="flex size-6 items-center justify-center rounded-full border-2 border-transparent"
                classList={{ "border-ring": accentColor() === preset.color }}
                style={{ background: preset.color }}
                onClick={() => setAccentColor(preset.color)}
              >
                <Show when={accentColor() === preset.color}>
                  <TbCheck class="size-3 text-white" />
                </Show>
              </button>
            )}
          </For>
        </div>
        <Button variant="ghost" size="sm" onClick={resetAccentColor}>
          {t("media.accent.reset")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMediaAccentEnabled(!mediaAccentEnabled())}
        >
          {mediaAccentEnabled() ? t("media.accent.on") : t("media.accent.off")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
