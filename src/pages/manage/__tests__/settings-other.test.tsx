import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())

import { Flag, Group, Type } from "~/types"
import OtherSettings from "../settings/Other"
import {
  buttonByText,
  clickButton,
  expectGolden,
  mockApi,
  renderPage,
  settle,
  setValue,
  writes,
} from "./harness"
import { clipboard, resetRouter } from "./mocks"

const s = (key: string, value = "", type = Type.String) => ({
  key,
  value,
  type,
  help: "",
  options: "",
  group: Group.SINGLE,
  flag: Flag.PRIVATE,
})

const SETTINGS = [
  s("aria2_uri", "http://aria:6800/jsonrpc"),
  s("aria2_secret", "sec"),
  s("token", "TOKEN123"),
  s("qbittorrent_url", "http://q:8080"),
  s("qbittorrent_seedtime", "60", Type.Number),
  s("transmission_uri", "http://t:9091/transmission/rpc"),
  s("transmission_seedtime", "30", Type.Number),
  s("115_temp_dir", "/t115"),
  s("115_open_temp_dir", "/t115o"),
  s("123_pan_temp_dir", "/t123"),
  s("123_open_temp_dir", "/t123o"),
  s("123_open_callback_url", "https://cb"),
  s("pikpak_temp_dir", "/tpik"),
  s("thunder_temp_dir", "/tth"),
  s("thunder_browser_temp_dir", "/tthb"),
  s("thunderx_temp_dir", "/tthx"),
  s("guangyapan_temp_dir", "/tgy"),
]

beforeEach(() => {
  resetRouter()
  clipboard.copy.mockClear()
  mockApi({
    "GET /admin/setting/list": () => structuredClone(SETTINGS),
    "POST /admin/setting/reset_token": () => "NEWTOKEN",
  })
})

const SAVE_ENDPOINTS = [
  "set_aria2",
  "set_qbit",
  "set_transmission",
  "set_115",
  "set_115_open",
  "set_123_pan",
  "set_123_open",
  "set_pikpak",
  "set_thunder",
  "set_thunder_browser",
  "set_thunderx",
  "set_guangyapan",
]

describe("other settings payloads", () => {
  it("each section saves to its own endpoint with its own fields", async () => {
    mockApi({
      "GET /admin/setting/list": () => structuredClone(SETTINGS),
      ...Object.fromEntries(
        SAVE_ENDPOINTS.map((e) => [`POST /admin/setting/${e}`, () => "ok"]),
      ),
    })
    renderPage(() => <OtherSettings />)
    await settle()
    const by = (id: string, v: string) =>
      setValue(document.getElementById(id)!, v)
    by("aria2_uri", "http://aria2:6800/jsonrpc")
    by("aria2_secret", "s3")
    by("qbittorrent_url", "http://qb:1")
    by("qbittorrent_seedtime", "90")
    by("transmission_uri", "http://tr:2")
    by("transmission_seedtime", "45")
    by("115_temp_dir", "/n115")
    by("115_open_temp_dir", "/n115o")
    by("123_temp_dir", "/n123")
    by("123_open_temp_dir", "/n123o")
    by("123_open_callback_url", "https://cb2")
    by("pikpak_temp_dir", "/npik")
    by("thunder_temp_dir", "/nth")
    by("thunder_browser_temp_dir", "/nthb")
    by("thunderX_temp_dir", "/nthx")
    by("guangyapan_temp_dir", "/ngy")
    const saves = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "Save",
    )
    expect(saves).toHaveLength(SAVE_ENDPOINTS.length)
    for (const b of saves) {
      b.click()
      await settle()
    }
    expectGolden(
      "settings-other-saves",
      writes().map((c) => [c.path, c.body]),
    )
  })

  it("copies the token and resets it", async () => {
    renderPage(() => <OtherSettings />)
    await settle()
    await clickButton("Copy Token")
    expect(clipboard.copy).toHaveBeenCalledWith("TOKEN123")
    await clickButton("Reset Token")
    expectGolden(
      "settings-other-reset-token",
      writes().map((c) => [c.path, c.body ?? null]),
    )
    expect(
      (document.querySelector("input[readonly]") as HTMLInputElement).value,
    ).toBe("NEWTOKEN")
  })
})
