import { base_path } from "./config"

export const standardizePath = (path: string, noRootSlash?: boolean) => {
  if (path.endsWith("/")) {
    path = path.slice(0, -1)
  }
  if (!path.startsWith("/")) {
    path = "/" + path
  }
  if (noRootSlash && path === "/") {
    return ""
  }
  return path
}

export const pathResolve = (...paths: string[]) => {
  return new URL(pathJoin(...paths), location.origin).pathname
}

export const pathJoin = (...paths: string[]) => {
  return paths.join("/").replace(/\/{2,}/g, "/")
}

export const joinBase = (...paths: string[]) => {
  return pathJoin(base_path, ...paths)
}

export const trimBase = (path: string) => {
  const res = path.replace(base_path, "")
  if (res.startsWith("/")) {
    return res
  }
  return "/" + res
}

// trimUserBase makes a path relative to the logged-in user's base_path so the
// rest of the app (fetch, breadcrumb, navigation) always works in base-relative
// terms — which is exactly what the backend's user.JoinPath expects. The backend
// re-prepends base_path, so feeding it an absolute path that already contains
// base_path double-prefixes it (e.g. login-redirect landing on the absolute URL)
// and 404s outside the user's root. Normalizing here confines a restricted user
// to their base_path:
//   - exact base or a child of base  => stripped to the relative remainder
//   - anything else (already relative, or an @-route)  => returned unchanged
// A base of "" or "/" (unrestricted user) is a no-op.
export const trimUserBase = (path: string, userBase: string | undefined) => {
  if (!userBase || userBase === "/") return path
  // normalize base: leading slash, no trailing slash, no empty segments
  const base = "/" + userBase.split("/").filter(Boolean).join("/")
  if (base === "/") return path
  if (path === base) return "/"
  if (path.startsWith(base + "/")) return path.slice(base.length) || "/"
  return path
}

export const pathBase = (path: string) => {
  return path.split("/").pop()
}

export const pathDir = (path: string) => {
  return path.split("/").slice(0, -1).join("/")
}

export const encodePath = (path: string, all?: boolean) => {
  return path
    .split("/")
    .map((p) =>
      all
        ? encodeURIComponent(p)
        : p
            .replace(/%/g, "%25")
            .replace(/\?/g, "%3F")
            .replace(/#/g, "%23")
            .replace(/ /g, "%20"),
    )
    .join("/")
}

export const ext = (path: string): string => {
  return path.split(".").pop() ?? ""
}

export const baseName = (fullName: string) => {
  return fullName.split(".").slice(0, -1).join(".")
}

export function createMatcher(path: string) {
  const segments = path.split("/").filter(Boolean)
  const len = segments.length

  return (location: string) => {
    const locSegments = location.split("/").filter(Boolean)
    const lenDiff = locSegments.length - len
    if (lenDiff < 0) return null

    let matchPath = len ? "" : "/"

    for (let i = 0; i < len; i++) {
      const segment = segments[i]
      const locSegment = locSegments[i]

      if (
        segment.localeCompare(locSegment, undefined, {
          sensitivity: "base",
        }) !== 0
      ) {
        return null
      }
      matchPath += `/${locSegment}`
    }

    return matchPath
  }
}
