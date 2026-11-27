import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { AdvancedGroup } from "~/components/ui/advanced-group"
import { useT } from "~/hooks"
import type { SettingItem } from "~/types"
import { cardKeys, type SettingsCard } from "../layouts"
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
  const byKey = createMemo(
    () => new Map(props.group.settings.map((row) => [row.key, row])),
  )
  // keys of the group that no card names: shown all the same, last
  const rest = createMemo(() => {
    const named = new Set(cardKeys(props.cards))
    return props.group.settings
      .map((row) => row.key)
      .filter((key) => !named.has(key))
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
