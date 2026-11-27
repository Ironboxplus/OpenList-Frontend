// What the app says in passing: the kit's toast (components/ui/toast), one
// kind of toast for the whole app. The calls keep their shape; a second
// argument adds details, an action (Undo) or a time on screen.
import type { JSXElement } from "solid-js"
import { toast, type ToastKind, type ToastOptions } from "~/components/ui/toast"
import { firstUpperCase } from "./str"

type Extra = Omit<ToastOptions, "kind" | "title">

const say = (kind: ToastKind) => (message: string, extra?: Extra) =>
  toast.show({ kind, title: firstUpperCase(message), ...extra })

const notify = {
  /** Anything to show as it is (the guests' announcement). */
  render: (element: JSXElement, extra?: Extra) =>
    toast.show({ kind: "info", title: element, ...extra }),
  success: say("success"),
  error: say("error"),
  info: say("info"),
  warning: say("warning"),
}

export { notify }
