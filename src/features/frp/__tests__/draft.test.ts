import { describe, expect, it } from "vitest"
import type { FrpView } from "~/types"
import {
  draftErrors,
  draftFromView,
  emptyProxy,
  parseDomains,
  proxyErrors,
  toSaveRequest,
} from "../draft"

const view: FrpView = {
  enabled: true,
  server_addr: "frp.example.com",
  server_port: 7000,
  tls: true,
  token_set: true,
  expose_cluster: false,
  state: "stopped",
  state_message: "",
  proxies: [
    {
      id: "p1",
      name: "web",
      type: "http",
      custom_domains: ["a.example.com"],
      subdomain: "",
      remote_port: 0,
      secret_set: false,
    },
    {
      id: "p2",
      name: "ssh",
      type: "stcp",
      custom_domains: [],
      subdomain: "",
      remote_port: 0,
      secret_set: true,
    },
  ],
}

describe("secrets in the save request", () => {
  it("leaves the token and keys out when nothing was touched", () => {
    const req = toSaveRequest(draftFromView(view))
    expect("token" in req).toBe(false)
    expect(req.proxies.every((p) => !("secret_key" in p))).toBe(true)
  })

  it("sends a typed token, and an empty one to clear it", () => {
    const d = draftFromView(view)
    d.token = { kind: "set", value: "tok" }
    expect(toSaveRequest(d).token).toBe("tok")
    d.token = { kind: "clear" }
    expect(toSaveRequest(d).token).toBe("")
  })

  it("sends a replaced key for an stcp proxy, and clears the key of one that stopped being stcp", () => {
    const d = draftFromView(view)
    d.proxies[1].secret = { kind: "set", value: "k" }
    expect(toSaveRequest(d).proxies[1].secret_key).toBe("k")
    d.proxies[1].secret = { kind: "keep" }
    d.proxies[1].type = "tcp"
    d.proxies[1].remotePort = "6000"
    expect(toSaveRequest(d).proxies[1].secret_key).toBe("")
  })

  it("carries the proxy id through, also for a rename", () => {
    const d = draftFromView(view)
    d.proxies[1].name = "ssh2"
    expect(toSaveRequest(d).proxies[1].id).toBe("p2")
  })
})

describe("request shape", () => {
  it("sends only the fields of the proxy's type", () => {
    const d = draftFromView(view)
    d.proxies[0].remotePort = "9999"
    const [web] = toSaveRequest(d).proxies
    expect(web.custom_domains).toEqual(["a.example.com"])
    expect(web.remote_port).toBe(0)
    d.proxies[0].type = "tcp"
    const [tcp] = toSaveRequest(d).proxies
    expect(tcp.custom_domains).toEqual([])
    expect(tcp.remote_port).toBe(9999)
  })
})

describe("parseDomains", () => {
  it("splits on lines and commas and drops blanks", () => {
    expect(parseDomains(" a.com, b.com\n\nc.com ,")).toEqual([
      "a.com",
      "b.com",
      "c.com",
    ])
  })
})

describe("proxy validation", () => {
  // proxyErrors(p, list, i): p is list[i], the one entry its name is not compared with
  const alone = (p: ReturnType<typeof emptyProxy>) => proxyErrors(p, [p], 0)

  it("checks the name like the backend", () => {
    const p = { ...emptyProxy(), name: "bad name", subdomain: "x" }
    expect(alone(p)).toContain("name_invalid")
    const ok = { ...emptyProxy(), name: "good-1_x", subdomain: "x" }
    expect(alone(ok)).toEqual([])
  })
  it("finds duplicate names", () => {
    const a = { ...emptyProxy(), name: "a", subdomain: "x" }
    const b = { ...emptyProxy(), name: "a", subdomain: "y" }
    expect(proxyErrors(b, [a, b], 1)).toContain("name_duplicate")
    expect(proxyErrors(a, [a, b], 0)).toContain("name_duplicate")
  })
  it("an edited proxy does not clash with its own old self", () => {
    const old = { ...emptyProxy(), id: "p1", name: "web", subdomain: "x" }
    const other = { ...emptyProxy(), id: "p2", name: "raw", subdomain: "y" }
    // edited without a rename: a copy with the same name in the same slot
    expect(proxyErrors({ ...old }, [{ ...old }, other], 0)).toEqual([])
    // renamed to its own old name again, or to a fresh one
    expect(proxyErrors({ ...old, name: "web2" }, [old, other], 0)).toEqual([])
    // but not onto another proxy's name
    expect(proxyErrors({ ...old, name: "raw" }, [old, other], 0)).toContain(
      "name_duplicate",
    )
    // a new proxy goes at the end of the list
    expect(
      proxyErrors(
        { ...emptyProxy(), name: "web", subdomain: "z" },
        [old, other, { ...emptyProxy(), name: "web", subdomain: "z" }],
        2,
      ),
    ).toContain("name_duplicate")
  })
  it("needs a host for http, a port for tcp, a key for stcp", () => {
    const http = { ...emptyProxy(), name: "h" }
    expect(alone(http)).toContain("http_needs_host")
    const tcp = {
      ...emptyProxy(),
      name: "t",
      type: "tcp" as const,
      remotePort: "70000",
    }
    expect(alone(tcp)).toContain("tcp_needs_port")
    const stcp = { ...emptyProxy(), name: "s", type: "stcp" as const }
    expect(alone(stcp)).toContain("stcp_needs_secret")
    // a stored key counts, a cleared one does not
    expect(alone({ ...stcp, secretSet: true })).toEqual([])
    expect(
      alone({ ...stcp, secretSet: true, secret: { kind: "clear" } }),
    ).toContain("stcp_needs_secret")
  })
})

describe("draftErrors", () => {
  it("lets a disabled client be saved half done", () => {
    const d = draftFromView({
      ...view,
      enabled: false,
      server_addr: "",
      proxies: [],
    })
    expect(draftErrors(d)).toEqual([])
  })
  it("asks an enabled client to be complete", () => {
    const d = draftFromView({ ...view, server_addr: "", proxies: [] })
    expect(draftErrors(d)).toEqual(
      expect.arrayContaining(["server_required", "no_proxy"]),
    )
    const e = draftFromView(view)
    e.serverPort = "0"
    expect(draftErrors(e)).toContain("port_invalid")
    e.serverPort = "7000"
    e.serverAddr = "frp.example.com/x"
    expect(draftErrors(e)).toContain("server_invalid")
  })
  it("passes a complete one", () => {
    expect(draftErrors(draftFromView(view))).toEqual([])
  })
})
