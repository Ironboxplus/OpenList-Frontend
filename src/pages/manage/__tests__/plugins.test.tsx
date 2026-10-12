import { fireEvent } from "@solidjs/testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("~/hooks", async (orig) =>
  (await import("./mocks")).hooksMock(await orig()),
)
vi.mock("~/utils/notify", async () => (await import("./mocks")).notifyMock())
const setPluginEnabled = vi.fn()
vi.mock("~/plugins", () => ({
  plugins: () => [
    {
      id: "ui.demo",
      name: "Demo UI",
      version: "1.0",
      enabled: true,
      contributions: [{ slot: "home" }],
    },
  ],
  setPluginEnabled: (...a: unknown[]) => setPluginEnabled(...a),
}))

import Plugins from "../plugins/Plugins"
import {
  buttonByText,
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

const GO = [
  { name: "hello", enabled: true, loaded: true },
  {
    name: "broken",
    enabled: true,
    loaded: false,
    error: "compile failed: line 3",
  },
  { name: "off", enabled: false, loaded: false },
]

const CLUSTER = {
  config: {
    enabled: true,
    key: "********",
    label: "node-a",
    addr: "https://a.example.com",
    seeds: ["https://b.example.com"],
    apply_remote: false,
    announce_interval_sec: 30,
  },
  status: {
    node_id: "n1aaaaaaaa",
    label: "node-a",
    addr: "https://a.example.com",
    enabled: true,
    active: true,
    nodes: [
      {
        node_id: "n1aaaaaaaa",
        label: "node-a",
        addr: "https://a.example.com",
        self: true,
        online: true,
        last_seen: 0,
        storages: [
          { mount_path: "/s1", driver: "Local", status: "work" },
          { mount_path: "/s2", driver: "Local", status: "work" },
        ],
      },
      {
        node_id: "n2bbbbbbbb",
        label: "node-b",
        addr: "",
        self: false,
        online: false,
        last_seen: 1,
        storages: [{ mount_path: "/t1", driver: "Local", status: "work" }],
      },
    ],
    groups: [
      {
        id: "g1",
        name: "main",
        members: [
          {
            node_id: "n1aaaaaaaa",
            label: "node-a",
            mount_path: "/s1",
            online: true,
            present: true,
            is_origin: true,
            self: true,
          },
        ],
        fields: ["token"],
        cred_hash: "abcd",
        version: 2,
        origin: "n1aaaaaaaa",
        updated_at: 1,
        has_cred: true,
      },
    ],
    connections: [
      { node_id: "n2bbbbbbbb", addr: "", outbound: true, since: 1 },
    ],
    events: [
      { time: 1, kind: "apply", group_id: "g1", detail: "applied token" },
    ],
    stats: {
      nodes_total: 2,
      nodes_online: 1,
      groups_total: 1,
      creds_total: 1,
      connections: 1,
    },
  },
}

beforeEach(() => {
  resetRouter()
  setPluginEnabled.mockClear()
  vi.spyOn(window, "confirm").mockReturnValue(true)
  mockApi({
    "GET /admin/plugin/list": () => ({ go: structuredClone(GO), frontend: [] }),
    "GET /admin/plugin/get": (c) => ({
      name: c.query.name,
      source: "package main // src",
    }),
    "POST /admin/plugin/save": () => structuredClone(GO),
    "POST /admin/plugin/delete": () => structuredClone(GO.slice(0, 1)),
    "POST /admin/plugin/enable": () => structuredClone(GO),
    "GET /admin/cluster/config": () => structuredClone(CLUSTER),
    "GET /admin/cluster/key": () => ({ key: "REALKEY" }),
    "POST /admin/cluster/config": () => structuredClone(CLUSTER),
    "POST /admin/cluster/groups": () => structuredClone(CLUSTER.status),
  })
})

const buttons = (text: string) =>
  [...document.querySelectorAll("button")].filter(
    (b) => b.textContent?.trim() === text,
  ) as HTMLButtonElement[]

const textInputs = () =>
  [...document.querySelectorAll("input")].filter(
    (i) => i.type !== "checkbox",
  ) as HTMLInputElement[]

describe("backend plugins", () => {
  it("lists plugins with state and the full load error", async () => {
    renderPage(() => <Plugins />)
    await settle()
    expect(document.body.textContent).toContain("hello")
    expect(document.body.textContent).toContain("compile failed: line 3")
    expect(document.body.textContent).toContain("Demo UI")
  })

  it("new plugin: name and source are posted trimmed", async () => {
    renderPage(() => <Plugins />)
    await settle()
    await clickButton("New plugin")
    setValue(textInputs()[0], "  mine ")
    setValue(document.querySelector("textarea")!, "package main // mine")
    await clickButton("Save & load")
    expectGolden("plugin-save", lastCall("POST", "/admin/plugin/save")!.body)
  })

  it("edit loads the source, delete confirms, toggle posts enabled", async () => {
    renderPage(() => <Plugins />)
    await settle()
    fireEvent.click(buttons("Edit")[0])
    await settle()
    expect(
      (document.querySelector("textarea") as HTMLTextAreaElement).value,
    ).toBe("package main // src")
    fireEvent.click(document.querySelectorAll("input[type=checkbox]")[2]) // "off"
    await settle()
    fireEvent.click(buttons("Delete")[1])
    await settle()
    // the new UI uses a dialog; the old one window.confirm
    const confirm = buttons("Confirm")[0]
    if (confirm) fireEvent.click(confirm)
    await settle()
    expectGolden(
      "plugin-writes",
      writes().map((c) => [c.path, c.body ?? null]),
    )
  })

  it("frontend plugins can be switched", async () => {
    renderPage(() => <Plugins />)
    await settle()
    const boxes = document.querySelectorAll("input[type=checkbox]")
    // go plugins first (3), then the single frontend plugin; cluster switches follow
    fireEvent.click(boxes[3])
    expect(setPluginEnabled).toHaveBeenCalledWith("ui.demo", false)
  })
})

describe("cluster config", () => {
  it("the key stays masked until revealed, then fetches it once", async () => {
    renderPage(() => <Plugins />)
    await settle()
    const key = document.querySelector(
      "input[type=password]",
    ) as HTMLInputElement
    expect(key.value).toBe("********")
    expect(lastCall("GET", "/admin/cluster/key")).toBeUndefined()
    fireEvent.click(document.querySelector("button[aria-label='show key']")!)
    await settle()
    expect(lastCall("GET", "/admin/cluster/key")).toBeTruthy()
    expect(textInputs().some((i) => i.value === "REALKEY")).toBe(true)
  })

  it("saving the config posts the edited object with seeds split into lines", async () => {
    renderPage(() => <Plugins />)
    await settle()
    const byValue = (v: string) => textInputs().find((i) => i.value === v)!
    setValue(byValue("node-a"), "node-z")
    const seeds = [...document.querySelectorAll("textarea")].find(
      (t) => t.value === "https://b.example.com",
    )!
    setValue(seeds, "https://c.example.com\n\n https://d.example.com ")
    setValue(byValue("30"), "45")
    const boxes = [...document.querySelectorAll("input[type=checkbox]")]
    fireEvent.click(boxes[boxes.length - 1]) // apply_remote
    const saves = buttons("Save")
    saves[saves.length - 1].click()
    await settle()
    expectGolden(
      "cluster-config-save",
      lastCall("POST", "/admin/cluster/config")!.body,
    )
  })

  it("groups: new empty groups are dropped, existing ones saved as specs", async () => {
    renderPage(() => <Plugins />)
    await settle()
    await clickButton("+ New group")
    const names = textInputs().filter((i) =>
      i.placeholder?.startsWith("Group name"),
    )
    expect(names).toHaveLength(2)
    expect(buttonByText("Save groups")).toBeTruthy()
    await clickButton("Save groups")
    const body = lastCall("POST", "/admin/cluster/groups")!.body as any
    expect(body.groups.map((g: any) => g.id)).toEqual(["g1"])
    expectGolden("cluster-groups-save", body)
  })
})
