import { type JSX, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import { useT } from "~/hooks"

export interface SettingsFormProps {
  /** Anything differs from what was loaded: Save and Reset wake up. */
  dirty: boolean
  saving?: boolean
  /** Reset is reloading from the server. */
  resetting?: boolean
  onSave: () => void
  onReset: () => void
  /** Extra buttons left of Reset (e.g. "load defaults"). */
  extra?: JSX.Element
  children: JSX.Element
}

/**
 * A settings page body: its section cards, then a Save / Reset bar pinned to
 * the bottom of the viewport. On phones the bar sits above the tab bar and the
 * home-indicator safe area (the shell publishes that height as --shell-bottom).
 */
export const SettingsForm = (props: SettingsFormProps) => {
  const t = useT()
  return (
    <form
      class="flex w-full flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (props.dirty && !props.saving) props.onSave()
      }}
    >
      {props.children}
      <div
        data-testid="settings-action-bar"
        class="sticky z-10 -mx-4 flex flex-wrap items-center gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur"
        style={{ bottom: "var(--shell-bottom, 0px)" }}
      >
        <span class="text-xs text-muted-foreground" aria-live="polite">
          <Show when={props.dirty}>{t("settings.form.unsaved")}</Show>
        </span>
        <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
          {props.extra}
          <Button
            type="button"
            variant="outline"
            disabled={!props.dirty || props.saving || props.resetting}
            onClick={() => props.onReset()}
          >
            {t("settings.form.reset")}
          </Button>
          <Button type="submit" disabled={!props.dirty || props.saving}>
            {t("global.save")}
          </Button>
        </div>
      </div>
    </form>
  )
}
