import { cleanup, render, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, describe, expect, it } from "vitest"
import { AnimatedNumber, splitNumber } from "../animated-number"

afterEach(cleanup)

describe("splitNumber", () => {
  it("finds the number in a figure and keeps the rest around it", () => {
    expect(splitNumber("12.5 MB/s")).toEqual({
      prefix: "",
      value: 12.5,
      decimals: 1,
      suffix: " MB/s",
    })
    expect(splitNumber("7")).toEqual({
      prefix: "",
      value: 7,
      decimals: 0,
      suffix: "",
    })
    expect(splitNumber("↓ 1,024 KB")).toEqual({
      prefix: "↓ ",
      value: 1024,
      decimals: 0,
      suffix: " KB",
    })
  })
  it("leaves words alone", () => {
    expect(splitNumber("—")).toBeNull()
    expect(splitNumber("")).toBeNull()
  })
})

describe("AnimatedNumber", () => {
  it("shows the value it is given, and ends on a new one", async () => {
    const [v, setV] = createSignal<string | number>(3)
    const { container } = render(() => <AnimatedNumber value={v()} />)
    expect(container.textContent).toBe("3")
    setV("40 MB")
    await waitFor(() => expect(container.textContent).toBe("40 MB"))
  })
  it("shows words as they are", () => {
    const { container } = render(() => <AnimatedNumber value="—" />)
    expect(container.textContent).toBe("—")
  })
})
