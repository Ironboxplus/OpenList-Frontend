// Which full-page state a failed startup request maps to.
import type { UnifiedError } from "~/platform/contracts/task"

export type StartupState = "offline" | "forbidden" | "backend"

/**
 * `online` is navigator.onLine. When the browser itself is offline nothing the
 * server did matters; otherwise a refused connection, a timeout or a 5xx all
 * mean "the backend is not answering", and a 403 is a permission wall.
 */
export const startupStateFor = (
  error: Pick<UnifiedError, "category">,
  online: boolean,
): StartupState => {
  if (!online) return "offline"
  if (error.category === "permission") return "forbidden"
  return "backend"
}
