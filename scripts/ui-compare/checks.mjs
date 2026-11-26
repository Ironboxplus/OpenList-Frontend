// Quantitative layout checks of the audit. `layoutChecks` runs inside the page
// (page.evaluate serialises it), so it must not touch anything outside itself.
// It returns { findings: [{ type, el, detail }], counts: { type: n } }: every
// finding is counted, the first CAP of each type are described.
export function layoutChecks() {
  const CAP = 10
  const findings = []
  const counts = {}
  const add = (type, el, detail) => {
    counts[type] = (counts[type] || 0) + 1
    if (counts[type] <= CAP) findings.push({ type, el: el ? describe(el) : "", detail })
  }

  function describe(el) {
    const cls = (typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).slice(0, 3).join(".")
    const data = [...el.attributes]
      .filter((a) => a.name.startsWith("data-"))
      .slice(0, 2)
      .map((a) => `[${a.name}]`)
      .join("")
    const r = el.getBoundingClientRect()
    const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 24)
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}${data} "${text}" @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`
  }

  const vw = innerWidth
  const vh = innerHeight
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    const cs = getComputedStyle(el)
    return cs.visibility === "visible" && cs.display !== "none" && Number(cs.opacity) !== 0
  }
  const inViewport = (r) => r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh

  // ---- colours: getComputedStyle may answer oklch()/color(), a canvas turns any of them into bytes
  const cv = document.createElement("canvas")
  cv.width = cv.height = 1
  const g = cv.getContext("2d", { willReadFrequently: true })
  const cache = new Map()
  const rgba = (css) => {
    if (cache.has(css)) return cache.get(css)
    g.clearRect(0, 0, 1, 1)
    g.fillStyle = "#000"
    g.fillStyle = css
    g.fillRect(0, 0, 1, 1)
    const d = g.getImageData(0, 0, 1, 1).data
    const v = [d[0], d[1], d[2], d[3] / 255]
    cache.set(css, v)
    return v
  }
  const over = (top, under) => {
    const a = top[3]
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat([1])
  }
  const bgOf = (el) => {
    const stack = []
    for (let e = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor)
      if (c[3] > 0) stack.push(c)
      if (c[3] >= 0.99) break
    }
    let acc = [255, 255, 255, 1]
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc)
    return acc
  }
  const diff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

  const all = [...document.querySelectorAll("body *")].filter(
    (el) => !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "PATH", "CIRCLE", "RECT", "LINE", "POLYLINE", "POLYGON", "G", "DEFS", "USE"].includes(el.tagName.toUpperCase()),
  )
  const vis = all.filter(visible)

  // ---- horizontal overflow of the page
  const se = document.scrollingElement
  if (se && se.scrollWidth > vw + 1) add("page-hscroll", null, `scrollWidth ${se.scrollWidth} > ${vw}`)

  // ---- content cut off with no way to reach it
  const clips = (v) => v === "hidden" || v === "clip"
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
  for (const el of vis) {
    const cs = getComputedStyle(el)
    if (el === document.body || el === document.documentElement) continue
    const ex = clips(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0
    const ey = clips(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0
    if ((ex || ey) && (el.innerText || "").trim()) {
      const ell = cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none"
      add(
        ell ? "clip-ellipsis" : "clip",
        el,
        `${ex ? `x ${el.scrollWidth}>${el.clientWidth} ` : ""}${ey ? `y ${el.scrollHeight}>${el.clientHeight}` : ""}`.trim(),
      )
    }
  }
  const textEls = vis.filter(hasOwnText)
  for (const el of textEls) {
    if (getComputedStyle(el).position === "fixed") continue
    const r = el.getBoundingClientRect()
    for (const axis of ["x", "y"]) {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a)
        const o = axis === "x" ? acs.overflowX : acs.overflowY
        if (o === "visible") continue
        if (acs.position === "fixed" && a !== el.parentElement) break
        if (acs.textOverflow === "ellipsis") break
        if (clips(o)) {
          const ar = a.getBoundingClientRect()
          const ix = Math.max(0, Math.min(r.right, ar.right) - Math.max(r.left, ar.left))
          const iy = Math.max(0, Math.min(r.bottom, ar.bottom) - Math.max(r.top, ar.top))
          const hidden = 1 - (ix * iy) / (r.width * r.height)
          if (hidden > 0.15 && inViewport(ar)) add("text-clipped", el, `${axis}: ${Math.round(hidden * 100)}% hidden by ${describe(a)}`)
        }
        break
      }
    }
  }

  // ---- offscreen to the right/left with nothing to scroll
  for (const el of vis) {
    const r = el.getBoundingClientRect()
    if (r.right <= vw + 1 && r.left >= -1) continue
    if (getComputedStyle(el).position === "fixed") continue
    let scrolls = false
    for (let a = el.parentElement; a; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX
      if (o !== "visible") {
        scrolls = true
        break
      }
    }
    if (!scrolls && hasOwnText(el)) add("offscreen-x", el, `left ${Math.round(r.left)} right ${Math.round(r.right)} of ${vw}`)
  }

  // ---- borders that cannot be seen
  for (const el of vis) {
    const cs = getComputedStyle(el)
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const w = parseFloat(cs[`border${side}Width`])
      if (!(w > 0) || cs[`border${side}Style`] === "none" || cs[`border${side}Style`] === "hidden") continue
      const col = rgba(cs[`border${side}Color`])
      const own = bgOf(el)
      const outside = el.parentElement ? bgOf(el.parentElement) : own
      const seen = over(col, own)
      const d = Math.min(diff(seen, own), diff(over(col, outside), outside))
      // a transparent border on a control is how it keeps its size, not a missing frame
      const control = el.matches('button, a, input, select, textarea, label, [role], [class*="hope-"]') || el.getBoundingClientRect().width < 120 || el.getBoundingClientRect().height < 40
      if (d <= 6 && !(col[3] === 0 && control)) add("border-invisible", el, `${side.toLowerCase()} ${w}px diff ${Math.round(d)} (alpha ${col[3].toFixed(2)})`)
      else if (d <= 24 && el.getBoundingClientRect().width > 120 && el.getBoundingClientRect().height > 40)
        add("border-faint", el, `${side.toLowerCase()} ${w}px diff ${Math.round(d)}`)
      break
    }
  }

  // ---- empty gaps between stacked siblings, and uneven side insets
  for (const c of vis) {
    const cr = c.getBoundingClientRect()
    const kids = [...c.children]
      .filter(visible)
      .filter((k) => !["absolute", "fixed"].includes(getComputedStyle(k).position))
      .map((k) => [k, k.getBoundingClientRect()])
      .sort((a, b) => a[1].top - b[1].top)
    if (kids.length < 2) continue
    const ccs = getComputedStyle(c)
    if (ccs.display.includes("flex") && ccs.flexDirection.startsWith("row")) continue
    if (ccs.display === "grid") continue
    if (ccs.justifyContent.includes("between")) continue
    for (let i = 1; i < kids.length; i++) {
      const [pk, pr] = kids[i - 1]
      const [nk, nr] = kids[i]
      const gap = nr.top - pr.bottom
      const overlapX = Math.min(pr.right, nr.right) - Math.max(pr.left, nr.left)
      if (gap > 120 && overlapX > 0.4 * Math.min(pr.width, nr.width) && nr.bottom < cr.bottom - 4) {
        add("gap", nk, `${Math.round(gap)}px below ${describe(pk)}`)
      }
    }
  }
  for (const c of document.querySelectorAll("main, [data-shell-content], [data-files-frame]")) {
    if (!visible(c)) continue
    const cr = c.getBoundingClientRect()
    for (const k of c.children) {
      if (!visible(k)) continue
      const kr = k.getBoundingClientRect()
      if (kr.width < 0.5 * cr.width) continue
      const l = kr.left - cr.left
      const r = cr.right - kr.right
      if (Math.abs(l - r) > 48) add("asymmetric-inset", k, `left ${Math.round(l)} right ${Math.round(r)} inside ${describe(c)}`)
    }
  }

  // ---- text boxes drawn over each other (only what is on top at its centre)
  const boxes = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue
    const p = n.parentElement
    if (!p || !visible(p) || ["SCRIPT", "STYLE", "TEXTAREA"].includes(p.tagName)) continue
    const rg = document.createRange()
    rg.selectNodeContents(n)
    const r = rg.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || !inViewport(r)) continue
    const top = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2)))
    if (!top || !(p.contains(top) || top.contains(p))) continue
    boxes.push({ p, r, t: n.textContent.trim().slice(0, 20) })
  }
  boxes.sort((a, b) => a.r.left - b.r.left)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (b.r.left >= a.r.right) break
      if (a.p.contains(b.p) || b.p.contains(a.p) || a.p === b.p) continue
      const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
      const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (ix <= 0 || iy <= 0) continue
      const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height)
      if ((ix * iy) / small > 0.3) add("text-overlap", a.p, `"${a.t}" over "${b.t}" (${describe(b.p)})`)
    }
  }

  // ---- click targets under 32px
  const sel = 'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="option"], input:not([type="hidden"]), select, textarea, summary'
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    if (!inViewport(r)) continue
    const cs = getComputedStyle(el)
    if (el.tagName === "A" && cs.display === "inline") continue
    if (el.closest("label") && el.closest("label").getBoundingClientRect().height >= 32) continue
    if (el.parentElement?.closest(sel)) continue
    if (r.width < 32 || r.height < 32) add("small-target", el, `${Math.round(r.width)}x${Math.round(r.height)}`)
  }

  return { findings, counts }
}
