const KEY = "client-id"

let fallback: string | undefined

const generate = (): string => {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  // randomUUID needs a secure context; plain-http LAN access has none.
  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Names this browser profile to the backend, which lets a returning device
 * replace its own earlier login session instead of piling up new ones. Stable
 * across logins and logouts; not a credential.
 */
export const getClientId = (): string => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved
    const id = generate()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // Storage blocked: one id for the life of the page.
    return (fallback ??= generate())
  }
}
