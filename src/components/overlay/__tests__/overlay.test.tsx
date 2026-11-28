import {
  createDisclosure as hopeDisclosure,
  HopeProvider,
} from "@hope-ui/solid"
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { createRoot, createSignal, type JSX } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createDisclosure,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  modalSizeClass,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Tooltip,
} from ".."

afterEach(cleanup)

const hope = (ui: () => JSX.Element) =>
  render(() => <HopeProvider>{ui()}</HopeProvider>)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const closeButtons = () =>
  [...document.querySelectorAll("button")].filter((b) =>
    b.textContent?.includes("Close"),
  )

describe("createDisclosure", () => {
  it("matches hope's value for value", () => {
    const steps = (d: ReturnType<typeof createDisclosure>) => {
      const seen = [d.isOpen(), d.isControlled()]
      d.onOpen()
      seen.push(d.isOpen())
      d.onToggle()
      seen.push(d.isOpen())
      d.onToggle()
      seen.push(d.isOpen(), d.triggerProps()["aria-expanded"])
      seen.push(d.disclosureProps().hidden)
      d.onClose()
      seen.push(d.isOpen(), d.disclosureProps().hidden)
      return seen
    }
    createRoot((dispose) => {
      for (const opts of [{}, { defaultIsOpen: true }, { isOpen: true }]) {
        const calls: string[] = []
        const hopeCalls: string[] = []
        const ours = steps(
          createDisclosure({
            ...opts,
            onOpen: () => calls.push("open"),
            onClose: () => calls.push("close"),
          }),
        )
        const theirs = steps(
          hopeDisclosure({
            ...opts,
            onOpen: () => hopeCalls.push("open"),
            onClose: () => hopeCalls.push("close"),
          }) as ReturnType<typeof createDisclosure>,
        )
        expect(ours).toEqual(theirs)
        expect(calls).toEqual(hopeCalls)
      }
      dispose()
    })
  })
})

describe("modalSizeClass", () => {
  it("looks hope's sizes up, default md, responsive objects by breakpoint", () => {
    expect(modalSizeClass()).toBe("max-w-[28rem]")
    expect(modalSizeClass("xl")).toBe("max-w-[36rem]")
    expect(modalSizeClass({ "@initial": "xs", "@md": "md" })).toBe(
      "max-w-[20rem] md:max-w-[28rem]",
    )
    expect(
      modalSizeClass({
        "@initial": "xs",
        "@md": "md",
        "@lg": "lg",
        "@xl": "xl",
        "@2xl": "2xl",
      }),
    ).toBe(
      "max-w-[20rem] md:max-w-[28rem] lg:max-w-[32rem] xl:max-w-[36rem] 2xl:max-w-[42rem]",
    )
  })
})

const TestModal = (p: {
  onClose: () => void
  extra?: Record<string, unknown>
  close?: boolean
  onDrop?: (e: DragEvent) => void
}) => (
  <Modal opened onClose={p.onClose} {...(p.extra ?? {})}>
    <ModalOverlay />
    <ModalContent onDrop={p.onDrop}>
      {p.close && <ModalCloseButton />}
      <ModalHeader>Title</ModalHeader>
      <ModalBody>
        <input id="first" />
        <input id="modal-input" />
      </ModalBody>
      <ModalFooter class="flex gap-2">
        <button>ok</button>
      </ModalFooter>
    </ModalContent>
  </Modal>
)

describe("Modal", () => {
  it("is a labelled dialog with hope's parts and no X unless asked for", async () => {
    hope(() => <TestModal onClose={() => {}} />)
    await waitFor(() => expect(dialog()).not.toBeNull())
    const title = [...dialog()!.querySelectorAll("[id]")].find(
      (e) => e.textContent === "Title",
    )!
    expect(dialog()!.getAttribute("aria-labelledby")).toBe(title.id)
    expect(closeButtons()).toHaveLength(0)
    expect(dialog()!.textContent).toContain("ok")
    expect(dialog()!.className).toContain("max-w-[28rem]")
    cleanup()
    hope(() => <TestModal onClose={() => {}} close />)
    await waitFor(() => expect(dialog()).not.toBeNull())
    expect(closeButtons()).toHaveLength(1)
  })

  it("focuses initialFocus on opening", async () => {
    hope(() => (
      <TestModal onClose={() => {}} extra={{ initialFocus: "#modal-input" }} />
    ))
    await waitFor(() => expect(document.activeElement?.id).toBe("modal-input"))
  })

  it("Escape closes; closeOnEsc={false} keeps it open", async () => {
    const onClose = vi.fn()
    hope(() => <TestModal onClose={onClose} />)
    await waitFor(() => expect(dialog()).not.toBeNull())
    fireEvent.keyDown(dialog()!, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
    const kept = vi.fn()
    hope(() => <TestModal onClose={kept} extra={{ closeOnEsc: false }} />)
    await waitFor(() => expect(dialog()).not.toBeNull())
    fireEvent.keyDown(dialog()!, { key: "Escape" })
    expect(kept).not.toHaveBeenCalled()
  })

  it("a click outside closes; closeOnOverlayClick={false} keeps it open", async () => {
    const outside = document.createElement("div")
    document.body.append(outside)
    const onClose = vi.fn()
    hope(() => <TestModal onClose={onClose} />)
    await waitFor(() => expect(dialog()).not.toBeNull())
    await sleep(20)
    fireEvent.pointerDown(outside)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    cleanup()
    const kept = vi.fn()
    hope(() => (
      <TestModal onClose={kept} extra={{ closeOnOverlayClick: false }} />
    ))
    await waitFor(() => expect(dialog()).not.toBeNull())
    await sleep(20)
    fireEvent.pointerDown(outside)
    await sleep(20)
    expect(kept).not.toHaveBeenCalled()
    outside.remove()
  })

  it("passes DOM handlers of ModalContent through (drop)", async () => {
    const onDrop = vi.fn()
    hope(() => <TestModal onClose={() => {}} onDrop={onDrop} />)
    await waitFor(() => expect(dialog()).not.toBeNull())
    fireEvent.drop(dialog()!)
    expect(onDrop).toHaveBeenCalledTimes(1)
  })
})

describe("Menu", () => {
  it("runs a MenuItem's onClick after the menu has closed, as onSelect", async () => {
    const seen: boolean[] = []
    hope(() => (
      <Menu>
        <MenuTrigger>open</MenuTrigger>
        <MenuContent>
          <MenuItem
            onClick={() =>
              seen.push(document.querySelector("[role=menu]") !== null)
            }
          >
            go
          </MenuItem>
          <MenuItem danger>bad</MenuItem>
        </MenuContent>
      </Menu>
    ))
    const trigger = document.querySelector("button")!
    trigger.focus()
    fireEvent.keyDown(trigger, { key: "Enter" })
    const item = await waitFor(() => {
      const el = [...document.querySelectorAll("[role=menuitem]")].find(
        (e) => e.textContent === "go",
      ) as HTMLElement
      expect(el).toBeDefined()
      return el
    })
    const bad = [...document.querySelectorAll("[role=menuitem]")].find(
      (e) => e.textContent === "bad",
    )!
    expect(bad.className).toContain("text-destructive")
    item.focus()
    fireEvent.keyDown(item, { key: "Enter" })
    expect(seen).toEqual([])
    await waitFor(() => expect(seen).toEqual([false]))
  })
})

// The layout parts are plain elements carrying Tailwind classes, not hope's Box.
const hopeClasses = (root: ParentNode) =>
  [...root.querySelectorAll("*")]
    .filter((e) => /(^|\s)hope-/.test(e.getAttribute("class") ?? ""))
    .map((e) => e.tagName)

describe("the layout parts", () => {
  it("are plain elements: a labelled title, and the callers' classes", async () => {
    hope(() => <TestModal onClose={() => {}} />)
    await waitFor(() => expect(dialog()).not.toBeNull())
    expect(hopeClasses(dialog()!)).toEqual([])
    const title = [...dialog()!.querySelectorAll("[id]")].find(
      (e) => e.textContent === "Title",
    )!
    expect(title.tagName).toBe("DIV")
    expect(title.className).toContain("px-5")
    const footer = dialog()!.querySelector("button")!.parentElement!
    expect(footer.className).toContain("justify-end")
    expect(footer.className).toContain("gap-2")
  })

  it("keep the same shape on a drawer and a popover", async () => {
    hope(() => (
      <Drawer opened onClose={() => {}}>
        <DrawerContent>
          <DrawerHeader class="text-primary">Head</DrawerHeader>
          <DrawerBody>body</DrawerBody>
          <DrawerFooter>foot</DrawerFooter>
        </DrawerContent>
      </Drawer>
    ))
    await waitFor(() => expect(dialog()).not.toBeNull())
    expect(hopeClasses(dialog()!)).toEqual([])
    const head = [...dialog()!.querySelectorAll("[id]")].find(
      (e) => e.textContent === "Head",
    )!
    expect(head.className).toContain("text-primary")
    cleanup()
    hope(() => (
      <Popover opened motionPreset="none">
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent class="w-96">
          <PopoverHeader class="border-b-0">head</PopoverHeader>
          <PopoverBody class="overflow-y-auto">inside</PopoverBody>
        </PopoverContent>
      </Popover>
    ))
    const body = await waitFor(() => {
      const el = [...document.querySelectorAll("div")].find(
        (d) => d.textContent === "inside",
      )
      expect(el).toBeDefined()
      return el!
    })
    expect(body.className).toContain("overflow-y-auto")
    expect(hopeClasses(document.body)).toEqual([])
    const content = body.parentElement!
    expect(content.className).toContain("w-96")
    expect(content.className).toContain("flex-col")
  })
})

describe("Popover", () => {
  it("hands a render function onClose, which closes it", async () => {
    hope(() => (
      <Popover>
        {({ onClose }: { onClose: () => void }) => (
          <>
            <PopoverTrigger>t</PopoverTrigger>
            <PopoverContent>
              <PopoverBody>
                <button onClick={onClose}>cancel</button>
              </PopoverBody>
            </PopoverContent>
          </>
        )}
      </Popover>
    ))
    fireEvent.click(document.querySelector("button")!)
    const cancel = await waitFor(() => {
      const el = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === "cancel",
      )
      expect(el).toBeDefined()
      return el!
    })
    expect(closeButtons()).toHaveLength(0)
    fireEvent.click(cancel)
    await waitFor(() =>
      expect(
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent === "cancel" && !b.closest("[data-closed]"),
        ),
      ).toBe(false),
    )
  })

  it("follows `opened` when controlled", async () => {
    const [opened, setOpened] = createSignal(false)
    hope(() => (
      <Popover opened={opened()} motionPreset="none">
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent>
          <PopoverBody>inside</PopoverBody>
        </PopoverContent>
      </Popover>
    ))
    expect(document.body.textContent).not.toContain("inside")
    setOpened(true)
    await waitFor(() => expect(document.body.textContent).toContain("inside"))
  })
})

describe("Tooltip (no wrapper element)", () => {
  const mount = (disabled = false) =>
    hope(() => (
      <div id="parent">
        <Tooltip label="the tip" disabled={disabled} withArrow>
          <button id="child">x</button>
        </Tooltip>
      </div>
    ))

  it("keeps the child where it was and gives it the trigger's props", () => {
    mount()
    const child = document.getElementById("child")!
    expect(child.parentElement?.id).toBe("parent")
    expect(document.getElementById("parent")!.children).toHaveLength(1)
    // Kobalte marks its trigger closed / expanded
    expect(child.hasAttribute("data-closed")).toBe(true)
  })

  it("opens on hover after Kobalte's delay, labelled by the tooltip", async () => {
    mount()
    const child = document.getElementById("child")!
    fireEvent.pointerEnter(child)
    await waitFor(
      () =>
        expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
          "the tip",
        ),
      { timeout: 2000 },
    )
    expect(child.getAttribute("aria-describedby")).toBe(
      document.querySelector('[role="tooltip"]')!.id,
    )
  })

  it("keeps the child's own handlers: a menu trigger under it still opens its menu", async () => {
    // Download.tsx: MenuTrigger as={CenterIcon}, and CenterIcon is a Tooltip
    const TipButton = (p: Record<string, unknown>) => (
      <Tooltip label="the tip">
        <button data-both {...p}>
          dl
        </button>
      </Tooltip>
    )
    hope(() => (
      <Menu>
        <MenuTrigger as={TipButton} />
        <MenuContent>
          <MenuItem>go</MenuItem>
        </MenuContent>
      </Menu>
    ))
    const both = document.querySelector<HTMLElement>("[data-both]")!
    fireEvent.pointerEnter(both)
    // jsdom has no PointerEvent, and Kobalte opens on a primary-button press:
    // a MouseEvent carries `button`
    both.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
    )
    await waitFor(() =>
      expect(document.querySelector("[role=menu]")).not.toBeNull(),
    )
  })

  it("never opens when disabled", async () => {
    mount(true)
    fireEvent.pointerEnter(document.getElementById("child")!)
    await sleep(1000)
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })
})
