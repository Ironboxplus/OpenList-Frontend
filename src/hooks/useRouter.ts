import {
  NavigateOptions,
  SetParams,
  useLocation,
  useNavigate,
  useParams,
  _mergeSearchString,
} from "@solidjs/router"
import { createMemo, untrack } from "solid-js"
import {
  encodePath,
  joinBase,
  log,
  pathJoin,
  trimBase,
  trimUserBase,
} from "~/utils"
import { clearHistory, me, pageOf } from "~/store"

/** The path the address names, in the user's base-relative terms. */
export const addressPath = (raw: string) => {
  const path = trimBase(decodeURIComponent(raw))
  // Special @-routes (/@login, /@manage, /@s shares, ...) are not file paths
  // and must not be confined to the user's base_path.
  if (path.startsWith("/@")) {
    return path
  }
  // Confine to the user's base_path: keep every consumer (fetch, breadcrumb,
  // navigation, links) working in base-relative terms. This prevents an
  // absolute path (e.g. a login-redirect landing on the full URL) from being
  // double-prefixed by the backend's user.JoinPath and 404-ing outside the
  // user's root.
  return trimUserBase(path, me().base_path)
}

const useRouter = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  // A file open over its folder: the page is still the folder (store/viewer.ts).
  const pathname = createMemo(() => pageOf(addressPath(location.pathname)))
  const isShare = createMemo(() => {
    return pathname().startsWith("/@s")
  })
  return {
    to: (
      path: string,
      ignore_root?: boolean,
      options?: Partial<NavigateOptions>,
    ) => {
      if (!ignore_root && path.startsWith("/")) {
        path = joinBase(path)
      }
      log("to:", path)
      clearHistory(decodeURIComponent(path))
      navigate(path, options)
    },
    /** Another file of the folder in the open viewer, in place of this one. */
    replace: (to: string) => {
      const path = joinBase(encodePath(pathJoin(pathname(), to), true))
      navigate(path + location.search, {
        replace: true,
        scroll: false,
        state: history.state,
      })
    },
    pushHref: (to: string): string => {
      return encodePath(pathJoin(pathname(), to))
    },
    back: () => {
      navigate(-1)
    },
    forward: () => {
      navigate(1)
    },
    pathname: pathname,
    isShare: isShare,
    search: location.search,
    searchParams: location.query,
    setSearchParams: (
      params: SetParams,
      options?: Partial<NavigateOptions>,
    ) => {
      const searchString = untrack(() =>
        _mergeSearchString(location.search, params),
      )
      navigate(location.pathname + searchString + location.hash, {
        scroll: false,
        ...options,
        resolve: true,
      })
    },
    params: params,
  }
}

export { useRouter }
