import { describe, it, expect } from "vitest"
import { utf16ToUtf8IfNeeded } from "../subtitle-manager"

// Build an ArrayBuffer from a byte array for fixture clarity.
const bytes = (...b: number[]) => new Uint8Array(b).buffer

// Encode a string as UTF-16LE with BOM (what popgo-style .ass files look like).
const utf16le = (s: string) => {
  const out = [0xff, 0xfe]
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    out.push(c & 0xff, (c >> 8) & 0xff)
  }
  return new Uint8Array(out).buffer
}
const utf16be = (s: string) => {
  const out = [0xfe, 0xff]
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    out.push((c >> 8) & 0xff, c & 0xff)
  }
  return new Uint8Array(out).buffer
}

describe("utf16ToUtf8IfNeeded", () => {
  it("decodes a UTF-16LE (BOM) .ass body and strips the BOM char", () => {
    const out = utf16ToUtf8IfNeeded(utf16le("[Script Info]\nDialogue: hi"))
    expect(out).toBe("[Script Info]\nDialogue: hi")
    expect(out!.charCodeAt(0)).not.toBe(0xfeff)
  })

  it("decodes UTF-16BE (BOM) too", () => {
    expect(utf16ToUtf8IfNeeded(utf16be("中文字幕"))).toBe("中文字幕")
  })

  it("preserves multibyte CJK across the UTF-16→string boundary", () => {
    expect(utf16ToUtf8IfNeeded(utf16le("魔法少女小圆"))).toBe("魔法少女小圆")
  })

  it("returns null for UTF-8 content (no BOM) so the source is left untouched", () => {
    // "[Sc" in ASCII/UTF-8 — no UTF-16 BOM
    expect(utf16ToUtf8IfNeeded(bytes(0x5b, 0x53, 0x63))).toBeNull()
  })

  it("returns null for UTF-8 with BOM (libass handles that itself)", () => {
    expect(utf16ToUtf8IfNeeded(bytes(0xef, 0xbb, 0xbf, 0x41))).toBeNull()
  })
})
