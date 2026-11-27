import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { AdvancedGroup } from "~/components/ui/advanced-group"
import { useRouter, useT } from "~/hooks"
import type { SettingItem } from "~/types"
import { joinBase } from "~/utils/path"
import { cardKeys, type SettingsCard } from "../layouts"
import { SETTINGS } from "../registry"
import { FieldRenderer } from "./FieldRenderer"
import { settingField, settingFromRaw, settingValue } from "./field"
import type { SettingsGroup } from "./settings-group"
import { SettingsSection } from "./SettingsSection"

export interface SettingsCardsProps {
  group: SettingsGroup
  cards: SettingsCard[]
  /** The setting a search led to: its group opens and it is marked. */
  focus?: string
  /** Asked for on a deprecated setting. */
  onDelete?: (key: string) => void
}

/**
 * A settings group laid out as cards (layouts.ts): each card says what it
 * governs, shows its common settings in line and folds the rare ones under
 * Advanced, which opens by itself when one of them is not at its default or
 * is the one a search led to (research 05 §二.2, §二.4).
 */
export const SettingsCards = (props: SettingsCardsProps) => {
  const t = useT()
  const { to } = useRouter()
  const byKey = createMemo(
    () => new Map(props.group.settings.map((row) => [row.key, row])),
  )
  // keys of the group that no card names: shown all the same, last
  const rest = createMemo(() => {
    const named = new Set([
      ...cardKeys(props.cards),
      ...props.cards.flatMap((c) => c.elsewhere?.keys ?? []),
    ])
    return props.group.settings
      .map((row) => row.key)
      .filter((key) => !named.has(key))
  })
  // the defaults tell which folded settings were changed: read once there
  // are folded settings to mark
  let asked = false
  createEffect(() => {
    if (asked) return
    if (props.cards.some((c) => c.advanced?.some((k) => byKey().has(k)))) {
      asked = true
      void props.group.readDefaults()
    }
  })

  const Field = (p: { row: SettingItem; card?: SettingsCard }) => {
    const special = () => p.card?.special?.[p.row.key]
    const spec = () => {
      const base = settingField(p.row)
      return {
        ...base,
        helpKey: p.card?.help?.[p.row.key] ?? base.helpKey,
        zeroLabelKey: special()?.labelKey ?? base.zeroLabelKey,
        specialValue: special()?.value,
      }
    }
    return (
      <FieldRenderer
        field={spec()}
        value={settingValue(p.row)}
        focused={props.focus === p.row.key}
        onChange={(raw) => props.group.set(p.row.key, settingFromRaw(raw))}
        onDelete={() => props.onDelete?.(p.row.key)}
      />
    )
  }

  const Card = (p: { card: SettingsCard }) => {
    const rows = (keys: string[] | undefined) =>
      (keys ?? [])
        .map((key) => byKey().get(key))
        .filter((row): row is SettingItem => !!row)
    const folded = createMemo(() => rows(p.card.advanced))
    const elsewhere = () =>
      p.card.elsewhere &&
      SETTINGS.find((s) => s.id === p.card.elsewhere!.entry && !s.external)
    const changed = createMemo(() => {
      const d = props.group.defaults()
      if (!d) return 0
      return folded().filter(
        (row) => d[row.key] !== undefined && d[row.key] !== row.value,
      ).length
    })
    const [open, setOpen] = createSignal(false)
    // open once the values are known, never shut again behind the user
    createEffect(
      on(
        () =>
          folded().length > 0 &&
          (props.group.defaults() !== undefined ||
            folded().some((row) => row.key === props.focus)),
        (ready) => {
          if (!ready) return
          if (changed() > 0 || folded().some((row) => row.key === props.focus))
            setOpen(true)
        },
      ),
    )
    return (
      <SettingsSection
        id={`card-${p.card.id}`}
        card={p.card.id}
        title={t(p.card.title)}
        description={t(p.card.scope)}
      >
        <For each={rows(p.card.keys)}>
          {(row) => <Field row={row} card={p.card} />}
        </For>
        <Show when={folded().length > 0}>
          <div class="py-2">
            <AdvancedGroup
              title={t("settings.layout.advanced")}
              count={folded().length}
              changed={changed()}
              open={open()}
              onOpenChange={setOpen}
              testid={`advanced-${p.card.id}`}
            >
              <For each={folded()}>
                {(row) => <Field row={row} card={p.card} />}
              </For>
            </AdvancedGroup>
          </div>
        </Show>
        <Show when={elsewhere()}>
          {(page) => (
            <p class="py-3 text-sm text-muted-foreground">
              {t("settings.layout.elsewhere", {
                count: p.card.elsewhere!.keys.length,
              })}{" "}
              <a
                data-elsewhere
                href={joinBase(page().route)}
                class="font-medium text-primary underline-offset-4 hover:underline"
                onClick={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey) return
                  e.preventDefault()
                  to(page().route)
                }}
              >
                {t(page().title)}
              </a>
            </p>
          )}
        </Show>
      </SettingsSection>
    )
  }

  // a search led here: bring the setting into view once it is drawn
  createEffect(
    on(
      () => props.focus && byKey().has(props.focus),
      (there) => {
        if (!there) return
        // (setting keys are plain words: no escaping needed in the selector)
        requestAnimationFrame(() =>
          document
            .querySelector(`[data-field="${props.focus}"]`)
            ?.scrollIntoView?.({ block: "center" }),
        )
      },
    ),
  )

  return (
    <>
      <For each={props.cards}>{(card) => <Card card={card} />}</For>
      <Show when={rest().length > 0}>
        <SettingsSection
          id="card-rest"
          card="rest"
          title={t("settings.layout.rest")}
        >
          <For each={rest()}>
            {(k) => (
              <Show when={byKey().get(k)}>
                {(row) => <Field row={row()} />}
              </Show>
            )}
          </For>
        </SettingsSection>
      </Show>
    </>
  )
}
