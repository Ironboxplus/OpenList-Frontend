// Shared plumbing for the manage-page payload tests. Pages are rendered for
// real and talk to a fake transport: the axios instance `r` keeps its own
// interceptors, only the adapter underneath is replaced, so every request a
// page sends is recorded exactly as it would go on the wire.
import { fireEvent } from "@solidjs/testing-library"
import * as fs from "node:fs"
import * as path from "node:path"
import { expect } from "vitest"
import { r } from "~/utils/request"

export interface Call {
  method: string
  path: string
  query: Record<string, string>
  body?: unknown
  headers: Record<string, string>
}

export const calls: Call[] = []

export type Handler = (call: Call) => unknown
/** Returned by a handler to answer with a business error instead of data. */
import { vi } from "vitest"
export const failure = (
  code: number,
  message: string,
  data: unknown = null,
) => ({
  __failure: { code, message, data },
})

let routes: Record<string, Handler> = {}

const parseBody = (data: unknown): unknown => {
  if (typeof data !== "string") return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

/** Route keys look like "GET /admin/setting/list" (no query string). */
export const mockApi = (table: Record<string, Handler>) => {
  routes = table
  vi.spyOn(console, "log").mockImplementation(() => {})
  calls.length = 0
  r.defaults.adapter = async (config) => {
    const url = new URL(String(config.url), "http://fake")
    const query: Record<string, string> = {}
    url.searchParams.forEach((v, k) => (query[k] = v))
    const call: Call = {
      method: String(config.method).toUpperCase(),
      path: url.pathname,
      query,
      body: parseBody(config.data),
      headers: Object.fromEntries(
        Object.entries(config.headers?.toJSON?.() ?? {}).map(([k, v]) => [
          k.toLowerCase(),
          String(v),
        ]),
      ),
    }
    calls.push(call)
    const handler = routes[`${call.method} ${call.path}`]
    const out = handler ? handler(call) : undefined
    const body =
      out && typeof out === "object" && "__failure" in out
        ? (out as any).__failure
        : { code: 200, message: "success", data: out ?? null }
    return {
      data: body,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    } as any
  }
}

/** The recorded writes, in order, without the query noise of reads. */
export const writes = (): Call[] => calls.filter((c) => c.method !== "GET")

export const lastCall = (method: string, p: string): Call | undefined =>
  [...calls].reverse().find((c) => c.method === method && c.path === p)

/** Flush the microtask queue enough for chained fetch -> setState -> effect. */
export const settle = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++)
    await new Promise((res) => setTimeout(res, 0))
}

/** Type into a text control the way both old and new controls listen. */
export const setValue = (el: Element, value: string) => {
  const input = el as HTMLInputElement | HTMLTextAreaElement
  input.value = value
  fireEvent.input(input)
  fireEvent.change(input)
}

/** Flip a checkbox-like control (native input, switch input or checkbox). */
export const toggleInput = (el: Element) => {
  fireEvent.click(el)
}

// ---- golden payloads -------------------------------------------------------
// A golden file is the JSON a page posted when it was still on the old
// components. `pnpm test` compares against it; UPDATE_GOLDEN=1 re-records it
// (only ever done against pre-rewrite code, or when the contract changes).
const goldenDir = path.resolve(__dirname, "golden")

const canonical = (v: unknown) => JSON.parse(JSON.stringify(v ?? null))

export const golden = (
  name: string,
): { read(): unknown; write(v: unknown): void } => ({
  read: () =>
    JSON.parse(fs.readFileSync(path.join(goldenDir, `${name}.json`), "utf8")),
  write: (v) => {
    fs.mkdirSync(goldenDir, { recursive: true })
    fs.writeFileSync(
      path.join(goldenDir, `${name}.json`),
      JSON.stringify(canonical(v), null, 2) + "\n",
    )
  },
})

/** Compare to (or, with UPDATE_GOLDEN=1, record) the golden file `name`. */
export const expectGolden = (name: string, actual: unknown) => {
  const g = golden(name)
  if (process.env.UPDATE_GOLDEN) {
    g.write(actual)
    return
  }
  expect(canonical(actual)).toEqual(g.read())
}

// ---- rendering -------------------------------------------------------------
import { HopeProvider } from "@hope-ui/solid"
import { render } from "@solidjs/testing-library"
import { Router } from "@solidjs/router"
import type { JSX } from "solid-js"

/** Render a page the way the app does: inside the provider hope-ui needs. */
export const renderPage = (page: () => JSX.Element) =>
  render(() => (
    <Router>
      <HopeProvider>{page()}</HopeProvider>
    </Router>
  ))

/**
 * Pick an option in a select field by its element id and the option's visible
 * text: open the combobox, then click the option in the listbox.
 */
export const chooseOption = async (id: string, optionText: string | RegExp) => {
  const trigger = document.getElementById(id)!
  if (trigger.tagName === "INPUT") {
    // searchable (combobox): focusing opens it; start from an empty query
    fireEvent.focus(trigger)
    fireEvent.click(trigger)
  } else {
    fireEvent.keyDown(trigger, { key: "Enter" })
  }
  await settle(3)
  const opt = [...document.querySelectorAll("[role=option]")].find((o) =>
    typeof optionText === "string"
      ? o.textContent?.trim() === optionText
      : optionText.test(o.textContent ?? ""),
  )
  if (!opt) throw new Error(`no option ${optionText} for #${id}`)
  fireEvent.click(opt)
  await settle()
}

/** The first <button> whose visible text is exactly `text`. */
export const buttonByText = (text: string | RegExp): HTMLButtonElement => {
  const hit = [...document.querySelectorAll("button")].find((b) =>
    typeof text === "string"
      ? b.textContent?.trim() === text
      : text.test(b.textContent ?? ""),
  )
  if (!hit) throw new Error(`no button "${text}"`)
  return hit as HTMLButtonElement
}

export const clickButton = async (text: string | RegExp) => {
  fireEvent.click(buttonByText(text))
  await settle()
}

/** Answer a "are you sure?" dialog when the page raised one. */
export const confirmIfAsked = async () => {
  const c = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Confirm",
  )
  if (c) {
    fireEvent.click(c)
    await settle()
  }
}

/** Flip a switch field by its id (Kobalte keeps the checkbox at `<id>-input`). */
export const toggleField = (id: string) => {
  const el =
    document.getElementById(`${id}-input`) ?? document.getElementById(id)
  if (!el) throw new Error(`no switch #${id}`)
  fireEvent.click(el)
}

/** Open the "..." menu of the nth row (or card) of a ResourceList. */
export const openRowMenu = async (index = 0) => {
  const triggers = document.querySelectorAll("[data-testid=row-actions]")
  if (!triggers[index]) throw new Error(`no row menu #${index}`)
  fireEvent.keyDown(triggers[index], { key: "Enter" })
  await settle(3)
}

/** Pick an item of the open row menu by its visible text. */
export const chooseMenuItem = async (label: string | RegExp) => {
  const item = [...document.querySelectorAll("[role=menuitem]")].find((i) =>
    typeof label === "string"
      ? i.textContent?.trim() === label
      : label.test(i.textContent ?? ""),
  )
  if (!item) throw new Error(`no menu item ${label}`)
  fireEvent.keyDown(item, { key: "Enter" })
  await settle(3)
}
