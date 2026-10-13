export interface MpvItem {
  /** direct link of the media file, built by `rawLink(obj, true)` */
  url: string
  /** external subtitle links of this file (may be empty) */
  subUrls: string[]
}

// Characters that still mean something inside a double-quoted string in at
// least one of bash, zsh, fish, PowerShell or cmd: `"` ends the string, `$`
// and the backtick start a substitution (bash/zsh/fish/PowerShell), `\` escapes
// (bash/zsh/fish) and `!` is bash/zsh history expansion. `encodeURIComponent`
// already encodes all of them except `!`, so for links built with
// `encodeAll=true` this is a no-op beyond `!`; it is also the safety net for
// links that were not (the query string of a share link, a sign, a subtitle URL
// from the backend). A percent-encoded character is the same URL, so this never
// changes what is requested.
const SHELL_SPECIAL = /["$`\\!]/g

const quote = (url: string) =>
  `"${url.replace(SHELL_SPECIAL, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"))}"`

// With those five characters gone, a double-quoted URL is literal in bash, zsh,
// fish and PowerShell: `'`, `&`, `#`, `?`, `;`, `(`, `)` and spaces are inert
// inside double quotes there. cmd has no `$`, backtick or history; `&` is inert
// inside its double quotes. The one cmd hazard is `%NAME%` expanding an
// environment variable, but a URL's `%` is always followed by two hex digits
// (`%E4%B8%AD`), so `%E4%` would only expand if an environment variable literally
// named like a hex pair existed; unset names are left untouched on a command
// line. That is ignorable.
//
// mpv's per-file option group `--{ ... --}` is emitted with its braces quoted:
// bare `--{` is a syntax error in PowerShell (a script block) and an incomplete
// brace expansion in fish, while `"--{"` reaches mpv as the same argument in
// every shell.
const GROUP_START = '"--{"'
const GROUP_END = '"--}"'

/**
 * One line to paste into a terminal: `mpv "<url>" [--sub-file="<sub>"...]`. With
 * several files mpv plays them as a playlist; files with subtitles are wrapped
 * in a per-file group so a subtitle only applies to its own file.
 */
export const mpvCommand = (items: MpvItem[]): string => {
  const parts = items.map(({ url, subUrls }) => {
    const file = quote(url)
    if (subUrls.length === 0) return file
    const subs = subUrls.map((s) => `--sub-file=${quote(s)}`).join(" ")
    return items.length === 1
      ? `${file} ${subs}`
      : `${GROUP_START} ${file} ${subs} ${GROUP_END}`
  })
  return ["mpv", ...parts].join(" ")
}
