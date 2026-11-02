export interface DeviceInfo {
  browser: string
  os: string
}

// Order matters: Edge and Opera also say Chrome, Chrome also says Safari.
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
]

// iPhone UAs say "like Mac OS X", Android UAs say "Linux".
const SYSTEMS: [RegExp, string][] = [
  [/Windows/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux|X11/, "Linux"],
]

const pick = (table: [RegExp, string][], ua: string) =>
  table.find(([re]) => re.test(ua))?.[1] ?? ""

/** A short "browser on system" for a session row; empty parts when unknown. */
export const describeUA = (ua: string): DeviceInfo => ({
  browser: pick(BROWSERS, ua),
  os: pick(SYSTEMS, ua),
})
