// What the first requests of a page load add up to. The one place that turns
// "settings answered / failed" and "init_status said ..." into a decision.
import type { ApiResult } from "~/platform/api/client"
import type { UnifiedError } from "~/platform/contracts/task"

export type StartupState =
  /** Settings loaded: render the app. */
  | "ready"
  /** The backend says it has not been set up: go to the setup wizard. */
  | "uninitialized"
  | "offline"
  | "forbidden"
  | "backend"

/** The states that replace the whole page with an error. */
export type StartupFailure = Exclude<StartupState, "ready" | "uninitialized">

export const isStartupFailure = (s: StartupState): s is StartupFailure =>
  s !== "ready" && s !== "uninitialized"

export interface StartupFacts {
  /** The /public/settings failure, absent when settings loaded. */
  settingsError?: Pick<UnifiedError, "category">
  /** navigator.onLine. */
  online: boolean
  /**
   * What /public/init_status answered. Only an explicit `false` means the
   * backend is uninitialized; a backend without the endpoint (404), a network
   * error or `true` all mean "already set up" and leave the decision to the
   * settings request.
   */
  initialized?: boolean
}

/**
 * When the browser itself is offline nothing the server did matters; otherwise
 * a refused connection, a timeout or a 5xx all mean "the backend is not
 * answering", and a 403 is a permission wall. An uninitialized backend wins
 * over a failed settings request: it refuses settings (503) until it is set up.
 */
export const startupStateFor = ({
  settingsError,
  online,
  initialized,
}: StartupFacts): StartupState => {
  if (initialized === false) return "uninitialized"
  if (!settingsError) return "ready"
  if (!online) return "offline"
  if (settingsError.category === "permission") return "forbidden"
  return "backend"
}

/**
 * Reads the /public/init_status result. Anything but a successful answer
 * carrying a boolean (404 from a backend without the endpoint, a network
 * error, a malformed body) is "unknown", never "uninitialized".
 */
export const initializedFrom = (
  result: ApiResult<{ initialized?: unknown }>,
): boolean | undefined =>
  result.ok && typeof result.data?.initialized === "boolean"
    ? result.data.initialized
    : undefined
