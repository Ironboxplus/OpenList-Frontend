import { afterEach, describe, expect, it, vi } from "vitest"
// Only the route table is under test; the pages themselves are not rendered.
vi.mock("~/features/settings/SettingsHome", () => ({
  SettingsHome: () => null,
}))
vi.mock("~/features/shell/states", () => ({ Forbidden: () => null }))
vi.mock("~/store", () => ({ me: () => ({}) }))
import { setBackendKind } from "~/utils/backend"
import { getRoutes } from "../routes"

const paths = () => getRoutes().map((r) => r.to)

afterEach(() => setBackendKind("go"))

describe("getRoutes per backend", () => {
  it("mounts our plugin page and S3 on the Go backend, not the upstream add/config pages", () => {
    setBackendKind("go")
    expect(paths()).toEqual(
      expect.arrayContaining(["/plugins", "/settings/s3"]),
    )
    expect(paths()).not.toContain("/plugins/add")
    expect(paths()).not.toContain("/plugins/config/:id")
  })

  it("mounts one plugin page at /plugins on either backend", () => {
    for (const kind of ["go", "ts-worker"] as const) {
      setBackendKind(kind)
      expect(paths().filter((p) => p === "/plugins")).toHaveLength(1)
    }
  })

  it("mounts the upstream plugin pages and no S3 on the TS backend", () => {
    setBackendKind("ts-worker")
    expect(paths()).toEqual(
      expect.arrayContaining([
        "/plugins",
        "/plugins/add",
        "/plugins/config/:id",
      ]),
    )
    expect(paths()).not.toContain("/settings/s3")
  })
})
