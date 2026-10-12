import { TbRefresh, TbTrash } from "solid-icons/tb"
import {
  createMemo,
  type JSX,
  Match,
  Show,
  Switch as SwitchBlock,
} from "solid-js"
import { FolderChooseInput } from "~/components/FolderTree"
import { MultiPathInput } from "~/components/MultiPathInput"
import { Button } from "~/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from "~/components/ui/combobox"
import { Input, Textarea } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Switch, SwitchControl, SwitchThumb } from "~/components/ui/switch"
import { useT } from "~/hooks"
import { Type } from "~/types"
import { cn } from "~/utils/cn"
import type { FieldOption, FieldRaw, FieldSpec, FieldValue } from "./field"

export interface FieldRendererProps {
  field: FieldSpec
  value: FieldValue
  /** Gets what the control produced; the page decides how to store it. */
  onChange?: (raw: FieldRaw) => void
  /** Asked for on a deprecated setting; the page confirms and deletes. */
  onDelete?: () => void
  hideLabel?: boolean
  /** Label above the control at every width (dialogs and narrow cards). */
  stacked?: boolean
  /** Extra control belonging to this field, drawn under it (e.g. "apply to subfolders"). */
  after?: JSX.Element
  class?: string
}

/** The text a number box shows: an emptied (NaN) number is an empty box. */
const display = (v: FieldValue): string => {
  if (v === undefined || v === null) return ""
  if (typeof v === "number" && Number.isNaN(v)) return ""
  return Array.isArray(v) ? v.join(",") : String(v)
}

/**
 * Draws one form field. This is the only place that knows how each field
 * type looks: label and help on the left, the control on the right on wide
 * screens, stacked on phones. Fields never decide what a value means.
 */
export const FieldRenderer = (props: FieldRendererProps) => {
  const t = useT()
  const f = () => props.field
  const emit = (raw: FieldRaw) => props.onChange?.(raw)
  const optionText = (o: FieldOption | undefined) =>
    o ? (o.label ?? (o.labelKey ? t(o.labelKey) : o.value)) : ""
  const options = createMemo(() => f().options ?? [])
  const selected = createMemo(() => {
    const v = props.value
    return Array.isArray(v)
      ? options().filter((o) => v.includes(o.value))
      : options().find((o) => o.value === display(v))
  })
  const invalid = () => (f().invalid ? true : undefined)

  const Text = () => (
    <div class="flex w-full gap-2">
      <Input
        id={f().id}
        type={
          f().secret
            ? "password"
            : f().type === Type.Number || f().type === Type.Float
              ? "number"
              : "text"
        }
        step={f().type === Type.Float ? "any" : undefined}
        autocomplete={f().secret ? "new-password" : undefined}
        value={display(props.value)}
        readOnly={f().readonly}
        required={f().required}
        placeholder={f().placeholder}
        aria-invalid={invalid()}
        onInput={(e) => emit(e.currentTarget.value)}
      />
      <Show when={f().generate && !f().readonly}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="shrink-0"
          aria-label={t("common.generate_value")}
          onClick={() => emit(f().generate!())}
        >
          <TbRefresh class="size-4" />
        </Button>
      </Show>
    </div>
  )

  const Choice = () => (
    <Select<FieldOption>
      multiple={f().multiple}
      options={options()}
      optionValue="value"
      optionTextValue={(o) => optionText(o)}
      value={selected() as FieldOption & FieldOption[]}
      onChange={(next: unknown) => {
        if (Array.isArray(next))
          emit((next as FieldOption[]).map((o) => o.value))
        else if (next) emit((next as FieldOption).value)
      }}
      disabled={f().readonly}
      required={f().required}
      validationState={f().invalid ? "invalid" : "valid"}
      placeholder={t(f().emptyLabelKey ?? "global.choose")}
      itemComponent={(p) => (
        <SelectItem item={p.item}>{optionText(p.item.rawValue)}</SelectItem>
      )}
    >
      <SelectTrigger id={f().id} aria-label={t(f().labelKey)}>
        <SelectValue<FieldOption>>
          {(s) =>
            f().multiple
              ? s.selectedOptions().map(optionText).join(", ")
              : optionText(s.selectedOption())
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  )

  // The combobox filters by what is typed. While the box still shows the
  // chosen option's own text nothing is being searched, so show everything.
  const searchFilter = (o: FieldOption, typed: string) => {
    const q = typed.trim().toLowerCase()
    const current = optionText(
      selected() as FieldOption | undefined,
    ).toLowerCase()
    if (!q || q === current) return true
    return (
      optionText(o).toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q)
    )
  }

  const Searchable = () => (
    <Combobox<FieldOption>
      options={options()}
      optionValue="value"
      optionTextValue={(o) => optionText(o)}
      optionLabel={(o) => optionText(o)}
      defaultFilter={searchFilter}
      value={selected() as FieldOption}
      onChange={(next) => next && emit(next.value)}
      disabled={f().readonly}
      triggerMode="focus"
      placeholder={t(f().emptyLabelKey ?? "global.choose")}
      itemComponent={(p) => (
        <ComboboxItem item={p.item}>{optionText(p.item.rawValue)}</ComboboxItem>
      )}
    >
      <ComboboxControl aria-label={t(f().labelKey)}>
        <ComboboxInput id={f().id} />
        <ComboboxTrigger />
      </ComboboxControl>
      <ComboboxContent />
    </Combobox>
  )

  return (
    <div
      data-field={f().id}
      class={cn(
        "grid gap-2 py-3",
        !props.stacked &&
          "md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-6",
        props.class,
      )}
    >
      <Show when={!props.hideLabel}>
        <div class="flex min-w-0 flex-col gap-1">
          <div class="flex items-center gap-1.5">
            <label for={f().id} class="text-sm font-medium break-words">
              {t(f().labelKey)}
              <Show when={f().required}>
                <span aria-hidden="true" class="ml-0.5 text-destructive">
                  *
                </span>
              </Show>
            </label>
            <Show when={f().deprecated && props.onDelete}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-6 text-destructive"
                aria-label={t("global.delete")}
                onClick={() => props.onDelete?.()}
              >
                <TbTrash class="size-4" />
              </Button>
            </Show>
          </div>
          <Show when={f().helpKey}>
            <p class="text-xs text-muted-foreground">{t(f().helpKey!)}</p>
          </Show>
        </div>
      </Show>
      <div
        class={cn(
          "flex min-w-0 flex-col gap-2",
          props.hideLabel && !props.stacked && "md:col-span-2",
        )}
      >
        <SwitchBlock
          fallback={
            <p class="text-sm text-muted-foreground">
              {t("settings_other.unknown_type")}
            </p>
          }
        >
          <Match when={f().type === Type.Bool}>
            <Switch
              id={f().id}
              checked={props.value === true}
              onChange={(on) => emit(on)}
              readOnly={f().readonly}
              aria-label={t(f().labelKey)}
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
            </Switch>
          </Match>
          <Match when={f().type === Type.Text}>
            <Textarea
              id={f().id}
              value={display(props.value)}
              readOnly={f().readonly}
              placeholder={f().placeholder}
              aria-invalid={invalid()}
              onInput={(e) => emit(e.currentTarget.value)}
            />
          </Match>
          <Match when={f().type === Type.MultiPath}>
            <MultiPathInput
              id={f().id}
              value={display(props.value)}
              valid={!f().invalid}
              readOnly={f().readonly}
              placeholder={f().placeholder}
              basePath={f().basePath}
              onChange={(v) => emit(v)}
            />
          </Match>
          <Match when={f().type === Type.Select && f().searchable}>
            <Searchable />
          </Match>
          <Match when={f().type === Type.Select}>
            <Choice />
          </Match>
          <Match when={f().picker}>
            <FolderChooseInput
              id={f().id}
              value={display(props.value)}
              onlyFolder={f().picker === "folder"}
              onChange={(path) => emit(path)}
            />
          </Match>
          <Match
            when={
              f().type === Type.String ||
              f().type === Type.Number ||
              f().type === Type.Float
            }
          >
            <Text />
          </Match>
        </SwitchBlock>
        {props.after}
      </div>
    </div>
  )
}
