import { MotionTokens } from "./MotionTokens"
export type MotionIntentKind =
  "workspace" | "pane" | "preview" | "modal" | "collection"
export interface CancellableMotion {
  cancel(): void
  finished?: Promise<unknown>
}
export interface MotionIntent {
  id: number
  kind: MotionIntentKind
  direction?: "forward" | "back" | "lateral" | "open" | "close"
  source?: HTMLElement
  target?: HTMLElement
  startedAt: number
}
export interface MotionIntentLease {
  intent: MotionIntent
  signal: AbortSignal
  isCurrent(): boolean
  track(c: CancellableMotion): () => void
  cancel(): void
  cleanup(): void
}
class Lease implements MotionIntentLease {
  readonly ctrl = new AbortController()
  readonly signal = this.ctrl.signal
  readonly controls = new Set<CancellableMotion>()
  closed = false
  timer?: ReturnType<typeof setTimeout>
  constructor(
    readonly intent: MotionIntent,
    readonly key: string,
    readonly owner: MotionIntentManager,
    watchdog: number,
  ) {
    if (watchdog) this.timer = setTimeout(() => this.cleanup(), watchdog)
  }
  isCurrent() {
    return !this.closed && this.owner.activeFor(this.key)?.id === this.intent.id
  }
  track(c: CancellableMotion) {
    if (this.closed) {
      c.cancel()
      return () => {}
    }
    this.controls.add(c)
    void c.finished?.then(() => {
      this.controls.delete(c)
      if (!this.controls.size) this.cleanup()
    })
    return () => this.controls.delete(c)
  }
  cancel() {
    this.close(true)
  }
  cleanup() {
    this.close(true)
  }
  close(cancel: boolean) {
    if (this.closed) return
    this.closed = true
    this.ctrl.abort()
    clearTimeout(this.timer)
    if (cancel) this.controls.forEach((c) => c.cancel())
    this.controls.clear()
    this.owner.release(this.key, this)
  }
}
export class MotionIntentManager {
  n = 1
  active = new Map<string, Lease>()
  watchdog: number
  constructor(o: { watchdogMs?: number } = {}) {
    this.watchdog = o.watchdogMs ?? MotionTokens.duration.watchdog
  }
  begin(
    input: Omit<MotionIntent, "id" | "startedAt"> & { key?: string },
  ): MotionIntentLease {
    if (input.kind === "workspace" && !input.key)
      throw new Error(
        "workspace motion intents require an explicit stable string lane",
      )
    const key = input.key ?? `${input.kind}:default`
    this.active.get(key)?.cancel()
    const lease = new Lease(
      { ...input, id: this.n++, startedAt: performance.now() },
      key,
      this,
      this.watchdog,
    )
    this.active.set(key, lease)
    return lease
  }
  activeFor(key: string) {
    return this.active.get(key)?.intent
  }
  release(key: string, lease: Lease) {
    if (this.active.get(key) === lease) this.active.delete(key)
  }
}
