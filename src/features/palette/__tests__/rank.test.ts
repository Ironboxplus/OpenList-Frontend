import { describe, expect, it } from "vitest"
import { rank, rankAll } from "../rank"

const traffic = {
  title: "流量",
  keywords: ["限速", "带宽", "bandwidth", "rate limit", "traffic", "download speed"],
}
const sso = { title: "Single Sign-On", keywords: ["oidc", "github", "单点登录", "oauth"] }
const newSync = { title: "新建同步作业", keywords: ["sync", "new sync job", "同步"] }
const files = { title: "文件", keywords: ["files", "browse"] }

describe("rank", () => {
  it("returns a positive neutral score for a blank query", () => {
    expect(rank("", files)).toBeGreaterThan(0)
    expect(rank("   ", files)).toBeGreaterThan(0)
  })

  const matches: [string, string, typeof traffic][] = [
    ["chinese keyword substring", "限速", traffic],
    ["english keyword", "bandwidth", traffic],
    ["english keyword prefix", "band", traffic],
    ["title exact", "流量", traffic],
    ["keyword on another page", "oidc", sso],
    ["keyword word-prefix", "sign", sso],
    ["case insensitive", "GITHUB", sso],
    ["chinese char-by-char subsequence", "新同", newSync],
    ["chinese full phrase", "同步作业", newSync],
    ["latin subsequence", "trfc", traffic],
    ["multi token, both found", "new job", newSync],
    ["full-width letters normalise", "ｓｙｎｃ", newSync],
  ]
  it.each(matches)("matches: %s", (_n, q, item) => {
    expect(rank(q, item)).toBeGreaterThan(0)
  })

  const misses: [string, string, typeof traffic][] = [
    ["pinyin initials are NOT supported", "xs", traffic],
    ["pinyin initials, longer", "llxs", traffic],
    ["pinyin full is NOT supported", "xiansu", traffic],
    ["unrelated", "zzz", files],
    ["chars out of order", "步同", newSync],
    ["one token missing", "new banana", newSync],
  ]
  it.each(misses)("does not match: %s", (_n, q, item) => {
    expect(rank(q, item)).toBe(0)
  })

  it("orders exact > prefix > word start > substring > subsequence", () => {
    const score = (title: string) => rank("sync", { title, keywords: [] })
    const exact = score("sync")
    const prefix = score("syncing jobs")
    const word = score("new sync")
    const sub = score("async")
    const subseq = score("s-y-n-c")
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(word)
    expect(word).toBeGreaterThan(sub)
    expect(sub).toBeGreaterThan(subseq)
    expect(subseq).toBeGreaterThan(0)
  })

  it("weighs a title hit above the same keyword hit", () => {
    const inTitle = rank("traffic", { title: "traffic", keywords: [] })
    const inKeyword = rank("traffic", { title: "流量", keywords: ["traffic"] })
    expect(inTitle).toBeGreaterThan(inKeyword)
  })

  it("rewards a tighter subsequence", () => {
    const tight = rank("新同", { title: "新建同步", keywords: [] })
    const loose = rank("新同", { title: "新建一个很长的同步", keywords: [] })
    expect(tight).toBeGreaterThan(loose)
  })
})

describe("rankAll", () => {
  const items = [files, traffic, newSync, sso]
  it("drops non-matches and sorts by score, stable on ties", () => {
    const out = rankAll("sync", items)
    expect(out).toEqual([newSync])
  })
  it("keeps the original order for a blank query", () => {
    expect(rankAll("", items)).toEqual(items)
  })
  it("puts the better match first", () => {
    const a = { title: "async tools", keywords: [] }
    const b = { title: "sync", keywords: [] }
    expect(rankAll("sync", [a, b])).toEqual([b, a])
  })
})
