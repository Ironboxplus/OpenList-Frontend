import { TbChevronRight } from "solid-icons/tb"
import { createEffect, For, type JSX, on, Show } from "solid-js"
import { focusRing } from "~/components/ui/focus"
import { cn } from "~/utils/cn"
import { joinBase } from "~/utils/path"

export interface BreadcrumbItem {
  label: JSX.Element
  /** Router path (base not applied). Absent: plain text (a group, or the last item). */
  href?: string
}

const plain = "no-underline hover:no-underline"

/**
 * The TopBar breadcrumb of tablet and desktop, shared by Files and Settings:
 * scrollable, keeps the last item in view, every item but the last is a link
 * that goes through the router (modifier-clicks keep the browser's default).
 */
export const Breadcrumb = (props: {
  items: BreadcrumbItem[]
  onNavigate: (href: string) => void
  onHover?: (href: string) => void
  /** Extra attributes on the <nav> (test and style hooks). */
  attrs?: Record<string, string>
}) => {
  let box: HTMLElement | undefined
  createEffect(
    on(
      () => props.items.map((i) => i.href).join("\n"),
      () => {
        queueMicrotask(() => {
          if (box) box.scrollLeft = box.scrollWidth
        })
      },
    ),
  )
  return (
    <nav
      ref={box}
      aria-label="breadcrumb"
      {...props.attrs}
      class="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ol class="m-0 flex list-none items-center gap-0.5 p-0 text-sm">
        <For each={props.items}>
          {(item, i) => {
            const last = () => i() === props.items.length - 1
            const target = () => (last() ? undefined : item.href)
            return (
              <>
                <Show when={i() > 0}>
                  <TbChevronRight class="size-3.5 shrink-0 text-muted-foreground" />
                </Show>
                <li class="shrink-0">
                  <Show
                    when={target()}
                    fallback={
                      <span
                        aria-current={last() ? "page" : undefined}
                        class={cn(
                          "flex items-center gap-1.5 px-1.5 py-1",
                          last()
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.label}
                      </span>
                    }
                  >
                    {(href) => (
                      <a
                        href={joinBase(href())}
                        onClick={(e) => {
                          if (
                            e.button !== 0 ||
                            e.metaKey ||
                            e.ctrlKey ||
                            e.shiftKey
                          )
                            return
                          e.preventDefault()
                          props.onNavigate(href())
                        }}
                        onMouseEnter={() => props.onHover?.(href())}
                        class={cn(
                          focusRing,
                          plain,
                          "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                        )}
                      >
                        {item.label}
                      </a>
                    )}
                  </Show>
                </li>
              </>
            )
          }}
        </For>
      </ol>
    </nav>
  )
}
