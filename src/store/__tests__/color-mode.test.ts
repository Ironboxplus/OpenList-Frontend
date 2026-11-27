import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// hope-ui's key, so the choice users already made carries over
const KEY = "hope-ui-color-mode"

const systemDark = (dark: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    (q: string) =>
      ({
        matches: dark && q === "(prefers-color-scheme: dark)",
        media: q,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  )

const load = async () => {
  vi.resetModules()
  return import("../color-mode")
}

describe("colour mode store", () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it("starts from the saved choice", async () => {
    systemDark(true)
    localStorage.setItem(KEY, "light")
    const { colorMode } = await load()
    expect(colorMode()).toBe("light")
  })

  it("follows the system when nothing is saved", async () => {
    systemDark(true)
    expect((await load()).colorMode()).toBe("dark")
    systemDark(false)
    expect((await load()).colorMode()).toBe("light")
  })

  it("ignores a saved value it does not know", async () => {
    systemDark(false)
    localStorage.setItem(KEY, "sepia")
    expect((await load()).colorMode()).toBe("light")
  })

  it("toggles and saves the choice", async () => {
    systemDark(false)
    const { colorMode, toggleColorMode, setColorMode } = await load()
    toggleColorMode()
    expect(colorMode()).toBe("dark")
    expect(localStorage.getItem(KEY)).toBe("dark")
    setColorMode("light")
    expect(colorMode()).toBe("light")
    expect(localStorage.getItem(KEY)).toBe("light")
  })

  it("picks a value per mode, as hope's useColorModeValue did", async () => {
    systemDark(false)
    const { colorModeValue, toggleColorMode } = await load()
    const v = colorModeValue("white", "black")
    expect(v()).toBe("white")
    toggleColorMode()
    expect(v()).toBe("black")
  })
})
