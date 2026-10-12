import { fireEvent, render, screen } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"

vi.mock("~/hooks", async () => {
  const i18n = await import("@solid-primitives/i18n")
  const { dict } = await import("~/lang/en/entry")
  const flat = i18n.flatten(dict) as unknown as Record<string, string>
  return {
    useT: () => (key: string, params?: Record<string, string | number>) => {
      const tpl = flat[key]
      if (typeof tpl !== "string") return key
      return params ? i18n.resolveTemplate(tpl, params) : tpl
    },
  }
})

import { createDeleteConfirm } from "../DeleteConfirm"
import { ConfirmDialog } from "../ConfirmDialog"
import { DataState } from "~/components/ui/data-state"
import { SettingsForm } from "../SettingsForm"
import { SettingsSection } from "../SettingsSection"

/** Kobalte keeps a closing dialog mounted until its CSS animation ends (never, in jsdom). */
const expectClosed = () => {
  const ok = screen.queryByTestId("confirm-ok")
  expect(!ok || ok.closest("[data-closed]")).toBeTruthy()
}

describe("SettingsForm", () => {
  it("Save and Reset are disabled until something changed", () => {
    const onSave = vi.fn()
    const onReset = vi.fn()
    const [dirty, setDirty] = createSignal(false)
    render(() => (
      <SettingsForm dirty={dirty()} onSave={onSave} onReset={onReset}>
        <SettingsSection title="Card" description="what it is for">
          <p>row</p>
        </SettingsSection>
      </SettingsForm>
    ))
    expect(screen.getByText("Card")).toBeTruthy()
    expect(screen.getByText("what it is for")).toBeTruthy()
    const save = screen.getByText("Save") as HTMLButtonElement
    const reset = screen.getByText("Reset") as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(reset.disabled).toBe(true)
    setDirty(true)
    expect(save.disabled).toBe(false)
    expect(screen.getByText("You have unsaved changes")).toBeTruthy()
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledTimes(1)
    fireEvent.click(reset)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it("the action bar is pinned above the shell's bottom inset", () => {
    render(() => (
      <SettingsForm dirty onSave={() => {}} onReset={() => {}}>
        <p>x</p>
      </SettingsForm>
    ))
    const bar = screen.getByTestId("settings-action-bar")
    expect(bar.className).toContain("sticky")
    expect(bar.style.bottom).toBe("var(--shell-bottom, 0px)")
  })

  it("never saves twice while a save is running", () => {
    const onSave = vi.fn()
    render(() => (
      <SettingsForm dirty saving onSave={onSave} onReset={() => {}}>
        <p>x</p>
      </SettingsForm>
    ))
    expect((screen.getByText("Save") as HTMLButtonElement).disabled).toBe(true)
  })
})

describe("ConfirmDialog / DeleteConfirm", () => {
  it("asks first, runs the action only after Confirm, then closes", async () => {
    const run = vi.fn(async () => {})
    const del = createDeleteConfirm<{ name: string }>({
      name: (r) => r.name,
      run,
    })
    render(() => (
      <>
        <button onClick={() => del.ask({ name: "photos" })}>ask</button>
        {del.dialog()}
      </>
    ))
    fireEvent.click(screen.getByText("ask"))
    await new Promise((r) => setTimeout(r, 20))
    expect(document.body.textContent).toContain(
      "Are you sure you want to delete [photos]?",
    )
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId("confirm-ok"))
    await new Promise((r) => setTimeout(r, 20))
    expect(run).toHaveBeenCalledWith({ name: "photos" })
    expectClosed()
  })

  it("Cancel leaves everything alone", async () => {
    const run = vi.fn(async () => {})
    const del = createDeleteConfirm<string>({ name: (s) => s, run })
    render(() => (
      <>
        <button onClick={() => del.ask("a")}>ask</button>
        {del.dialog()}
      </>
    ))
    fireEvent.click(screen.getByText("ask"))
    await new Promise((r) => setTimeout(r, 20))
    fireEvent.click(screen.getByText("Cancel"))
    await new Promise((r) => setTimeout(r, 20))
    expect(run).not.toHaveBeenCalled()
    expectClosed()
  })

  it("ConfirmDialog shows the labels it is given", async () => {
    const onConfirm = vi.fn()
    render(() => (
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Reset it?"
        description="Cannot be undone"
        confirmLabel="Yes reset"
        onConfirm={onConfirm}
      />
    ))
    await new Promise((r) => setTimeout(r, 20))
    expect(document.body.textContent).toContain("Reset it?")
    fireEvent.click(screen.getByText("Yes reset"))
    expect(onConfirm).toHaveBeenCalled()
  })
})

describe("DataState", () => {
  it("failed shows the message and retries", () => {
    const retry = vi.fn()
    render(() => (
      <DataState error="could not reach server" onRetry={retry}>
        <p>content</p>
      </DataState>
    ))
    expect(screen.getByText("could not reach server")).toBeTruthy()
    expect(screen.queryByText("content")).toBeNull()
    fireEvent.click(screen.getByText("Retry"))
    expect(retry).toHaveBeenCalled()
  })

  it("loading before any data, content otherwise", () => {
    const [empty, setEmpty] = createSignal(true)
    const { container } = render(() => (
      <DataState loading empty={empty()}>
        <p>content</p>
      </DataState>
    ))
    expect(container.querySelector("[data-state=loading]")).toBeTruthy()
    setEmpty(false)
    expect(screen.getByText("content")).toBeTruthy()
  })

  it("empty shows its text and action", () => {
    render(() => (
      <DataState
        empty
        emptyText="no items"
        emptyAction={<button>make one</button>}
      >
        <p>content</p>
      </DataState>
    ))
    expect(screen.getByText("no items")).toBeTruthy()
    expect(screen.getByText("make one")).toBeTruthy()
  })
})
