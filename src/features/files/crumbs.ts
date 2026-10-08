// Breadcrumb model for the Files page. Pure, so the path rules (own files vs
// share links, encoding, parent) are testable without the router.
import { encodePath } from "~/utils/path"

export interface FileCrumb {
  kind: "root" | "share" | "dir"
  /** Folder name; empty for the roots, which the view labels itself. */
  label: string
  /** Absolute, URL-encoded, without the site base path. */
  href: string
}

/** `pathname` is the router pathname with the base path already trimmed and decoded. */
export const fileCrumbs = (pathname: string, isShare: boolean): FileCrumb[] => {
  const segments = pathname.split("/").filter(Boolean)
  if (isShare) {
    const root = `/@s/${segments[1] ?? ""}`
    const rest = segments.slice(2)
    return [
      { kind: "share", label: "", href: root },
      ...rest.map((label, i) => ({
        kind: "dir" as const,
        label,
        href: encodePath(`${root}/${rest.slice(0, i + 1).join("/")}`),
      })),
    ]
  }
  return [
    { kind: "root", label: "", href: "/" },
    ...segments.map((label, i) => ({
      kind: "dir" as const,
      label,
      href: encodePath("/" + segments.slice(0, i + 1).join("/")),
    })),
  ]
}

/** The folder one level up, if there is one. */
export const parentCrumb = (crumbs: FileCrumb[]): FileCrumb | undefined =>
  crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined
