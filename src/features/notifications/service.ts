// The app-wide error center, kept per signed-in user.
import { me } from "~/store/user"
import { createErrorStore, type ErrorInput } from "./store"

export const errorCenter = createErrorStore({
  storage: localStorage,
  user: () => me().username ?? "",
  now: Date.now,
})

/**
 * The only way an error reaches the error center. Callers pass what they know;
 * whether it is worth recording is decided by the store.
 */
export const recordError = (input: ErrorInput): boolean =>
  errorCenter.record(input)
