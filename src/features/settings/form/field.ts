// The one description of a form field. Pages build FieldSpecs (from backend
// setting items, driver items or by hand); FieldRenderer draws them. Label,
// help and option text are i18n keys so a spec is plain data.
import { DriverItem, Flag, SettingItem, Type } from "~/types"

export interface FieldOption {
  value: string
  /** i18n key of the visible text. */
  labelKey?: string
  /** Already-translated text (e.g. a user name); wins over labelKey. */
  label?: string
}

export interface FieldSpec {
  /** DOM id of the control and key of the field. */
  id: string
  type: Type
  labelKey: string
  helpKey?: string
  required?: boolean
  readonly?: boolean
  placeholder?: string
  /** Mask the text while typing (passwords). */
  secret?: boolean
  options?: FieldOption[]
  /** Select: type to filter the options. */
  searchable?: boolean
  /** Select: several values (the value is a string[]). */
  multiple?: boolean
  /** Select: text shown when nothing is chosen. */
  emptyLabelKey?: string
  invalid?: boolean
  /** A setting on its way out: offers a delete control next to the label. */
  deprecated?: boolean
  /** MultiPath: paths are chosen relative to this folder. */
  basePath?: string
  /** String: a button that fills the field with a generated value. */
  generate?: () => string
  /** Text / String: fixed-width font (source code, keys). */
  mono?: boolean
  /** Text: visible lines. */
  rows?: number
  /** String: text with a folder chooser (`folder`: pick only, no typing). */
  picker?: "path" | "folder"
}

export type FieldValue = string | number | boolean | string[] | undefined | null
/** What a control hands back: the DOM's string, a switch's boolean, or the ids of a multi select. */
export type FieldRaw = string | boolean | string[]

const optionList = (csv: string | undefined, prefix: string): FieldOption[] =>
  csv
    ? csv.split(",").map((v) => ({ value: v, labelKey: `${prefix}.${v}` }))
    : []

/** A row of /admin/setting/list. Its value is always a string on the wire. */
export const settingField = (item: SettingItem): FieldSpec => ({
  id: item.key,
  type: item.type,
  labelKey: `settings.${item.key}`,
  helpKey: item.help ? `settings.${item.key}-tips` : undefined,
  readonly: item.flag === Flag.READONLY,
  deprecated: item.flag === Flag.DEPRECATED,
  options: optionList(item.options, `settings.${item.key}s`),
})

/** The control value for a setting: the wire string, a switch reads "true". */
export const settingValue = (item: SettingItem): FieldValue =>
  item.type === Type.Bool ? item.value === "true" : item.value

/** What to store back into a setting for what its control emitted. */
export const settingFromRaw = (raw: FieldRaw): string => String(raw)

/**
 * A storage driver's form item. Driver `common` items (mount path, order...)
 * live under storages.common.*, the driver's own under drivers.<driver>.*.
 */
export const driverField = (item: DriverItem, driver: string): FieldSpec => {
  const ns = driver === "common" ? "storages.common" : `drivers.${driver}`
  return {
    id: item.name,
    type: item.type,
    labelKey: `${ns}.${item.name}`,
    helpKey: item.help ? `${ns}.${item.name}-tips` : undefined,
    required: item.required,
    secret: item.name === "password",
    options: optionList(item.options, `${ns}.${item.name}s`),
  }
}

/**
 * The value a driver form stores for what a control emitted: numbers are
 * parsed (an emptied number box is NaN, as it always was), switches stay
 * booleans, everything else is the text.
 */
export const driverFromRaw = (
  type: Type,
  raw: FieldRaw,
): string | number | boolean => {
  if (typeof raw === "boolean") return raw
  const text = Array.isArray(raw) ? raw.join(",") : raw
  switch (type) {
    case Type.Number:
      return parseInt(text)
    case Type.Float:
      return parseFloat(text)
    default:
      return text
  }
}

/** Default of a driver item as the typed value the form starts with. */
export const driverDefault = (
  type: Type,
  value?: string,
): string | number | boolean => {
  switch (type) {
    case Type.Bool:
      return value ? value === "true" : false
    case Type.Number:
      return value ? parseInt(value) : 0
    case Type.Float:
      return value ? parseFloat(value) : 0
    default:
      return value ? value : ""
  }
}
