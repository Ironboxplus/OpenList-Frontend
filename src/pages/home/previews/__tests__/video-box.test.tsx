import { render } from "@solidjs/testing-library"
import { Suspense } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"

const { sidecar, state } = vi.hoisted(() => ({
  sidecar: vi.fn<(path: string) => Promise<string[]>>(),
  state: {} as { setName: (n: string) => void },
}))

vi.mock("@hope-ui/solid", () => {
  const Pass = (p: any) => <div>{p.children}</div>
  return {
    Flex: Pass,
    VStack: Pass,
    HStack: Pass,
    Tooltip: Pass,
    Icon: () => null,
    Image: () => null,
    IconButton: () => <button />,
    Anchor: (p: any) => <a href={p.href}>{p.children}</a>,
  }
})
vi.mock("artplayer", () => ({ default: {} }))
vi.mock("solid-icons/bs", () => ({ BsArrowRight: () => null }))
vi.mock("solid-icons/tb", () => ({ TbTerminal2: () => null }))
vi.mock("~/components", () => ({ SelectWrapper: () => null }))
vi.mock("~/components/ui/switch", () => {
  const Pass = (p: any) => <div>{p.children}</div>
  return {
    Switch: Pass,
    SwitchControl: Pass,
    SwitchLabel: Pass,
    SwitchThumb: Pass,
  }
})
vi.mock("../VideoTreeList", () => ({ VideoTreeList: () => null }))
vi.mock("~/types", () => ({ ObjType: { VIDEO: 2 } }))
vi.mock("~/hooks", () => ({
  useRouter: () => ({ replace: vi.fn(), pathname: () => "/m/a.mkv" }),
  useLink: () => ({
    currentObjLink: () => "http://x/d",
    objPath: (o: { name: string }) => `/m/${o.name}`,
  }),
  usePath: () => ({ handleFolder: vi.fn() }),
  useCopyLink: () => ({ copyMpvCommand: vi.fn() }),
  useT: () => (k: string) => k,
  getGlobalPage: () => 1,
}))
vi.mock("~/store", async () => {
  const { createStore } = await import("solid-js/store")
  const [objStore, set] = createStore({
    obj: { name: "a.mkv" },
    objs: [{ name: "a.mkv", type: 2 }],
    raw_url: "http://x/raw",
  })
  state.setName = (n) => set("obj", "name", n)
  return {
    objStore,
    password: () => "",
    setShouldKeepState: vi.fn(),
    getPagination: () => ({ type: "all" }),
  }
})
vi.mock("~/utils", () => ({
  convertURL: (scheme: string, a: { sub_url?: string }) =>
    `${scheme}|sub=${a.sub_url ?? ""}`,
  fetchSidecarSubtitles: sidecar,
  getPlatform: () => "Unknown",
  pathDir: (p: string) => p.slice(0, p.lastIndexOf("/")),
}))

import { VideoBox } from "../video_box"

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0))
}

// The preview sits under a Suspense boundary in the app.
const mount = () =>
  render(() => (
    <Suspense fallback={<i data-testid="fallback" />}>
      <VideoBox onAutoNextChange={() => {}}>
        <div data-testid="player" />
      </VideoBox>
    </Suspense>
  ))

const mpvHref = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("a"))
    .map((a) => a.getAttribute("href")!)
    .find((h) => h.startsWith("mpv://"))!

describe("VideoBox sidecar subtitle for external players", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    sidecar.mockReset()
    state.setName("a.mkv")
  })

  it("renders the player while the subtitle request is pending, then adds it to the link", async () => {
    let release!: (v: string[]) => void
    sidecar.mockImplementation(() => new Promise((res) => (release = res)))
    const r = mount()
    await settle()
    expect(r.container.querySelector("[data-testid=player]")).not.toBeNull()
    expect(r.container.querySelector("[data-testid=fallback]")).toBeNull()
    expect(mpvHref(r.container)).toMatch(/sub=$/)

    release(["https://h/sub-a.srt"])
    await settle()
    expect(mpvHref(r.container)).toMatch(/sub=https:\/\/h\/sub-a\.srt$/)
  })

  it("drops a result that arrives after the path changed", async () => {
    let releaseA!: (v: string[]) => void
    sidecar.mockImplementation((path: string) =>
      path === "/m/a.mkv"
        ? new Promise((res) => (releaseA = res))
        : Promise.resolve(["https://h/sub-b.srt"]),
    )
    const r = mount()
    await settle()
    state.setName("b.mkv")
    await settle()
    expect(mpvHref(r.container)).toMatch(/sub=https:\/\/h\/sub-b\.srt$/)
    releaseA(["https://h/sub-a.srt"])
    await settle()
    expect(mpvHref(r.container)).toMatch(/sub=https:\/\/h\/sub-b\.srt$/)
  })

  it("leaves the link without a subtitle when the request fails", async () => {
    sidecar.mockRejectedValue(new Error("boom"))
    const r = mount()
    await settle()
    expect(r.container.querySelector("[data-testid=player]")).not.toBeNull()
    expect(mpvHref(r.container)).toMatch(/sub=$/)
  })
})
