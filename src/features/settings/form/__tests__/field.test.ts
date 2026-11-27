import { describe, expect, it } from "vitest"
import { Flag, Type, type DriverItem, type SettingItem } from "~/types"
import { driverField, settingField } from "../field"

const driverItem = (name: string, over: Partial<DriverItem> = {}) =>
  ({
    name,
    type: Type.Select,
    default: "",
    options: "",
    required: false,
    help: "",
    ...over,
  }) as DriverItem

const setting = (key: string) =>
  ({
    key,
    value: "0",
    type: Type.Number,
    help: "",
    options: "",
    group: 0,
    flag: Flag.PUBLIC,
  }) as unknown as SettingItem

describe("driverField", () => {
  it("says what an empty common order item does", () => {
    for (const name of ["order_by", "order_direction", "extract_folder"])
      expect(driverField(driverItem(name), "common").emptyLabelKey).toBe(
        `storages.common.${name}_default`,
      )
  })

  it("leaves other items to the generic empty text", () => {
    expect(
      driverField(driverItem("webdav_policy"), "common").emptyLabelKey,
    ).toBeUndefined()
    expect(
      driverField(driverItem("order_by"), "115").emptyLabelKey,
    ).toBeUndefined()
  })
})

describe("settingField", () => {
  it("shows 0 of the device limits as words", () => {
    expect(settingField(setting("max_devices")).zeroLabelKey).toBe(
      "global.unlimited",
    )
    expect(settingField(setting("device_session_ttl")).zeroLabelKey).toBe(
      "global.never_expires",
    )
    expect(
      settingField(setting("token_expires_in")).zeroLabelKey,
    ).toBeUndefined()
  })
})
