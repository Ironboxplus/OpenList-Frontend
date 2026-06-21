import { createSignal, type Signal } from "solid-js"

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const defaultStorage = (): StorageLike | undefined =>
  typeof localStorage !== "undefined" ? localStorage : undefined

/** Read and JSON-parse a value, falling back safely on missing/corrupt data. */
export const readPersisted = <T>(
  storage: StorageLike | undefined,
  key: string,
  fallback: T,
): T => {
  if (!storage) return fallback
  const raw = storage.getItem(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Write a JSON-serialised value; `undefined` removes the key. */
export const writePersisted = (
  storage: StorageLike | undefined,
  key: string,
  value: unknown,
): void => {
  if (!storage) return
  if (value === undefined) {
    storage.removeItem(key)
    return
  }
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / serialization failure — non-fatal */
  }
}

/**
 * A Solid signal whose value is mirrored to persistent storage, so it survives
 * navigation and reloads. Reads the initial value from storage (or `fallback`).
 */
export const createPersistedSignal = <T>(
  key: string,
  fallback: T,
  storage: StorageLike | undefined = defaultStorage(),
): Signal<T> => {
  const [get, set] = createSignal<T>(readPersisted(storage, key, fallback))
  const persistedSet = ((value: any) => {
    const next =
      typeof value === "function" ? (value as (p: T) => T)(get()) : value
    writePersisted(storage, key, next)
    return set(next)
  }) as typeof set
  return [get, persistedSet]
}
