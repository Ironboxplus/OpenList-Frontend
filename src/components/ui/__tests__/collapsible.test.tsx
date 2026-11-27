import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, describe, expect, it } from "vitest"
import { AdvancedGroup } from "../advanced-group"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../collapsible"

afterEach(cleanup)

const content = () =>
  document.querySelector<HTMLElement>('[data-motion="collapsible"]')!

describe("Collapsible", () => {
  it("keeps folded content in the document, hidden and inert", () => {
    render(() => (
      <Collapsible>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>
          <input aria-label="inside" />
        </CollapsibleContent>
      </Collapsible>
    ))
    expect(content()).not.toBeNull()
    expect(content().hidden).toBe(true)
    expect(content().inert).toBe(true)
    expect(document.querySelector('[aria-label="inside"]')).not.toBeNull()
  })

  it("opens and folds again on its trigger", async () => {
    const { getByText } = render(() => (
      <Collapsible>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>
    ))
    fireEvent.click(getByText("More"))
    await waitFor(() => expect(content().hidden).toBe(false))
    expect(content().inert).toBe(false)
    expect(getByText("More").getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(getByText("More"))
    await waitFor(() => expect(content().hidden).toBe(true))
    expect(content().inert).toBe(true)
    // once settled it follows its content, no height left behind
    expect(content().style.height).toBe("")
  })

  it("starts open when asked", () => {
    render(() => (
      <Collapsible defaultOpen>
        <CollapsibleTrigger>More</CollapsibleTrigger>
        <CollapsibleContent>body</CollapsibleContent>
      </Collapsible>
    ))
    expect(content().hidden).toBe(false)
    expect(content().inert).toBe(false)
  })
})

describe("AdvancedGroup", () => {
  it("shows how many items it holds and how many were changed", async () => {
    const [open, setOpen] = createSignal(false)
    const { getByTestId, queryByTestId } = render(() => (
      <AdvancedGroup
        title="Advanced"
        count={8}
        changed={2}
        open={open()}
        onOpenChange={setOpen}
        testid="adv"
      >
        <span>item</span>
      </AdvancedGroup>
    ))
    const trigger = getByTestId("adv")
    expect(trigger.textContent).toContain("Advanced")
    expect(trigger.textContent).toContain("(8)")
    expect(queryByTestId("changed-mark")?.textContent).toContain("2 changed")
    fireEvent.click(trigger)
    expect(open()).toBe(true)
    await waitFor(() => expect(content().hidden).toBe(false))
  })

  it("does not fold fewer than two items: they show in line, with no trigger", () => {
    const { queryByTestId, getByText } = render(() => (
      <AdvancedGroup
        title="Advanced"
        count={1}
        changed={0}
        open={false}
        onOpenChange={() => {}}
        testid="adv"
      >
        <span>only item</span>
      </AdvancedGroup>
    ))
    expect(queryByTestId("adv")).toBeNull()
    expect(document.querySelector('[data-motion="collapsible"]')).toBeNull()
    expect(getByText("only item").closest("[hidden]")).toBeNull()
  })

  it("keeps a group's title when its only item is shown in line", () => {
    const { getByText } = render(() => (
      <AdvancedGroup
        heading
        title="Link"
        count={1}
        changed={0}
        open={false}
        onOpenChange={() => {}}
      >
        <span>only item</span>
      </AdvancedGroup>
    ))
    expect(getByText("Link")).toBeTruthy()
    expect(getByText("only item").closest("[hidden]")).toBeNull()
  })

  it("has no changed mark when everything is at its default", () => {
    const { queryByTestId } = render(() => (
      <AdvancedGroup
        title="Advanced"
        count={3}
        changed={0}
        open={false}
        onOpenChange={() => {}}
      >
        <span>item</span>
      </AdvancedGroup>
    ))
    expect(queryByTestId("changed-mark")).toBeNull()
  })
})
