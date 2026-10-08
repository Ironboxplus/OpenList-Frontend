import { describe, expect, it } from "vitest"
import { cn } from "../cn"

describe("cn", () => {
  it("keeps font size when a token color is added", () => {
    expect(cn("text-sm", "text-foreground")).toBe("text-sm text-foreground")
  })
  it("still lets a later token color win over an earlier one", () => {
    expect(cn("text-foreground", "text-primary-foreground")).toBe(
      "text-primary-foreground",
    )
  })
  it("lets a later font size win", () => {
    expect(cn("text-sm", "text-xs")).toBe("text-xs")
  })
})
