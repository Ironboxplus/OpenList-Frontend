// Consecutive-failure tracking for a background poll. A poll that fails once
// is noise; one that fails STALE_AFTER times in a row means what is on screen
// is no longer being updated, and the UI says so (without a toast).

export const STALE_AFTER = 3

export interface PollHealth {
  failures: number
  stale: boolean
}

export const healthy: PollHealth = { failures: 0, stale: false }

export const pollFailed = (h: PollHealth): PollHealth => {
  const failures = h.failures + 1
  return { failures, stale: failures >= STALE_AFTER }
}

export const pollSucceeded = (): PollHealth => healthy
