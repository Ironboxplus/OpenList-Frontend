import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { notify } from "~/utils/notify"
import { Flag, Group, Type } from "~/types"
import S3Settings from "../settings/S3"
import {
  clickButton,
  expectGolden,
  lastCall,
  mockApi,
  renderPage,
  settle,
  setValue,
  writes,
} from "./harness"
import { resetRouter } from "./mocks"

const s = (key: string, value: string, type = Type.String) => ({
  key,
  value,
  type,
  help: "",
  options: "",
  group: Group.S3,
  flag: Flag.PRIVATE,
})

const SETTINGS = [
  s("s3_enabled", "true", Type.Bool),
  s("s3_port", "5246", Type.Number),
  s("s3_access_key_id", "AK"),
  s("s3_secret_access_key", "SK"),
  s("s3_buckets", JSON.stringify([{ name: "one", path: "/one" }])),
]

beforeEach(() => {
  resetRouter()
  vi.mocked(notify.error).mockClear()
  mockApi({
    "GET /admin/setting/list": () => structuredClone(SETTINGS),
    "POST /admin/setting/save": () => null,
    "GET /public/settings": () => ({}),
  })
})

describe("S3 settings payload", () => {
  it("edits, adds and removes buckets then saves the whole list", async () => {
    renderPage(() => <S3Settings />)
    await settle()
    setValue(document.getElementById("s3_port")!, "9000")
    await clickButton("Add")
    expect(document.querySelectorAll("[data-field=bucket-name]")).toHaveLength(
      2,
    )
    setValue(document.querySelectorAll("[data-field=bucket-name]")[1], "two")
    setValue(
      document.querySelectorAll("tbody tr td:nth-child(2) input")[1],
      "/two",
    )
    await clickButton("Save")
    expectGolden(
      "settings-s3-save",
      lastCall("POST", "/admin/setting/save")!.body,
    )
  })

  it("refuses to save an empty or duplicate bucket", async () => {
    renderPage(() => <S3Settings />)
    await settle()
    await clickButton("Add")
    await clickButton("Save")
    expect(writes()).toHaveLength(0)
    expect(notify.error).toHaveBeenCalledTimes(1)
    setValue(document.querySelectorAll("[data-field=bucket-name]")[1], "one")
    setValue(
      document.querySelectorAll("tbody tr td:nth-child(2) input")[1],
      "/x",
    )
    await clickButton("Save")
    expect(writes()).toHaveLength(0)
    expect(notify.error).toHaveBeenCalledTimes(2)
  })

  it("generate fills fresh key id and secret", async () => {
    renderPage(() => <S3Settings />)
    await settle()
    await clickButton(/generate/i)
    await clickButton("Save")
    const body = lastCall("POST", "/admin/setting/save")!.body as any[]
    const get = (k: string) => body.find((x) => x.key === k).value as string
    expect(get("s3_access_key_id")).not.toBe("AK")
    expect(get("s3_access_key_id")).toMatch(/^[A-Za-z0-9+/=]{20}$/)
    expect(get("s3_secret_access_key")).toMatch(/^[A-Za-z0-9+/=]{40}$/)
  })
})
