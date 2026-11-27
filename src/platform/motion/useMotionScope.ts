import { onCleanup } from "solid-js"
import type { CancellableMotion } from "./MotionIntent"
export class MotionScope {
  controls = new Set<CancellableMotion>()
  disposed = false
  get size() {
    return this.controls.size
  }
  track(c: CancellableMotion) {
    if (this.disposed) {
      c.cancel()
      return () => {}
    }
    this.controls.add(c)
    void c.finished?.then(() => this.controls.delete(c))
    return () => this.controls.delete(c)
  }
  cleanup() {
    if (this.disposed) return
    this.disposed = true
    this.controls.forEach((c) => c.cancel())
    this.controls.clear()
  }
}
export function useMotionScope() {
  const scope = new MotionScope()
  onCleanup(() => scope.cleanup())
  return scope
}
