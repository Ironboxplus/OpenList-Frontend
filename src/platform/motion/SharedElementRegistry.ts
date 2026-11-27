const brand = Symbol("SharedElementRegistration")
export interface SharedElementRegistration {
  readonly [brand]: SharedElementRegistry
}
interface Registration extends SharedElementRegistration {
  identity: string
  element: Element
}
export class SharedElementRegistry {
  byId = new Map<string, Registration>()
  byElement = new WeakMap<Element, Registration>()
  tokens = new WeakSet<SharedElementRegistration>()
  register(identity: string, element: Element): SharedElementRegistration {
    const remove = (r?: Registration) => r && this.remove(r)
    remove(this.byId.get(identity))
    remove(this.byElement.get(element))
    const r: Registration = { [brand]: this, identity, element }
    this.byId.set(identity, r)
    this.byElement.set(element, r)
    this.tokens.add(r)
    return r
  }
  get(id: string) {
    return this.byId.get(id)?.element
  }
  unregister(t: SharedElementRegistration) {
    if (t[brand] === this && this.tokens.has(t)) this.remove(t as Registration)
  }
  remove(r: Registration) {
    if (this.byId.get(r.identity) === r) this.byId.delete(r.identity)
    if (this.byElement.get(r.element) === r) this.byElement.delete(r.element)
  }
  clear() {
    this.byId.clear()
  }
}
