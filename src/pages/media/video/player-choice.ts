/** The players the media library overlay can play a video with in the page. */
export type PlayerChoice = "movi" | "artplayer"

const CHOICE_KEY = "media_video_player"

export const getPlayerChoice = (): PlayerChoice =>
  localStorage.getItem(CHOICE_KEY) === "artplayer" ? "artplayer" : "movi"

export const setPlayerChoice = (choice: PlayerChoice) =>
  localStorage.setItem(CHOICE_KEY, choice)

/**
 * Which player opens a video. Movi is the default; a cloud transcode (the HLS
 * master) goes to Artplayer whatever was chosen, since that path is built on
 * its HLS handling.
 */
export const pickEngine = (
  choice: PlayerChoice,
  transcode: boolean,
): PlayerChoice => (transcode ? "artplayer" : choice)

export interface ProgressSave {
  position: number
  duration: number
  played: boolean
}

/**
 * Watch-progress cadence of the overlay, the same as the Artplayer path: at
 * most one save per 10 s while playing, one on pause, one at the end (played),
 * one when the player closes; nothing before the 2 s mark unless played. The
 * last seen position is kept, so closing still saves after the element is gone.
 */
export const createProgressTracker = (
  save: (p: ProgressSave) => void,
  now: () => number = Date.now,
  interval = 10_000,
) => {
  let lastSavedAt = 0
  let pos = 0
  let dur = 0
  let finished = false
  const flush = (played: boolean) => {
    if (pos < 2 && !played) return
    save({ position: pos, duration: dur, played })
  }
  const see = (position: number, duration: number) => {
    pos = position || 0
    dur = duration || 0
  }
  return {
    timeupdate(position: number, duration: number) {
      see(position, duration)
      const t = now()
      if (t - lastSavedAt < interval) return
      lastSavedAt = t
      flush(false)
    },
    pause(position: number, duration: number) {
      see(position, duration)
      if (!finished) flush(false)
    },
    ended(position: number, duration: number) {
      see(position, duration)
      finished = true
      flush(true)
    },
    close() {
      if (!finished) flush(false)
    },
    position: () => pos,
  }
}
