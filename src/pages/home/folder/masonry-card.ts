import { ObjType } from "~/types"

/** What a waterfall card should render for a given object. */
export type MasonryCardKind =
  | "image" // the image itself
  | "video-thumb" // a video that has a thumbnail
  | "video-skeleton" // a video with no thumbnail → skeleton placeholder
  | "text" // text file → its (lazily fetched) content
  | "icon" // folders, audio, unknown → an icon card

/** Pure decision: given an object, which card kind to render. */
export const masonryCardKind = (obj: {
  type: ObjType
  thumb?: string
}): MasonryCardKind => {
  switch (obj.type) {
    case ObjType.IMAGE:
      return "image"
    case ObjType.VIDEO:
      return obj.thumb ? "video-thumb" : "video-skeleton"
    case ObjType.TEXT:
      return "text"
    default:
      return "icon"
  }
}

/**
 * Pure decision: what a click does. Images open the shared gallery (keyboard
 * arrows + swipe + zoom); everything else navigates to its own page.
 */
export const masonryClickAction = (obj: {
  type: ObjType
}): "gallery" | "navigate" =>
  obj.type === ObjType.IMAGE ? "gallery" : "navigate"

/** Whether the filename bar should stay visible (true) or only show on hover. */
export const masonryNameAlwaysVisible = (obj: {
  type: ObjType
  thumb?: string
}): boolean => {
  const kind = masonryCardKind(obj)
  // Media that fills the card reads cleaner with a hover-only label.
  return !(kind === "image" || kind === "video-thumb")
}

/** Clamp fetched text to a small, render-friendly preview. */
export const clampPreview = (text: string, max = 1200): string =>
  text.length > max ? text.slice(0, max) : text
