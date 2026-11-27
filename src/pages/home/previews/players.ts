import type Artplayer from "artplayer"

// The external players a video offers (the viewer's More menu and the file
// list's right-click menu), and the artplayer previews' height plugin. Moved
// out of video_box.tsx with the player page (plan P2).

export const players: {
  icon: string
  name: string
  scheme: string
  platforms: string[]
}[] = [
  {
    icon: "iina",
    name: "IINA",
    scheme: "iina://weblink?url=$edurl",
    platforms: ["MacOS"],
  },
  {
    icon: "potplayer",
    name: "PotPlayer",
    scheme: "potplayer://$durl",
    platforms: ["Windows"],
  },
  {
    icon: "vlc",
    name: "VLC",
    scheme: "vlc://$durl",
    platforms: ["Windows", "MacOS", "Linux", "Android", "iOS"],
  },
  {
    icon: "android",
    name: "Android",
    scheme: "intent:$durl#Intent;type=video/*;S.title=$name;end",
    platforms: ["Android"],
  },
  {
    icon: "nplayer",
    name: "nPlayer",
    scheme: "nplayer-$durl",
    platforms: ["Android", "iOS"],
  },
  {
    icon: "omniplayer",
    name: "OmniPlayer",
    scheme: "omniplayer://weblink?url=$durl",
    platforms: ["MacOS"],
  },
  {
    icon: "figplayer",
    name: "Fig Player",
    scheme: "figplayer://weblink?url=$durl",
    platforms: ["Windows", "MacOS"],
  },
  {
    icon: "vivid",
    name: "Vivid Player",
    scheme: "vividplayer://play?src=direct&u=$edurl&title=$name",
    platforms: ["Windows"],
  },
  {
    icon: "infuse",
    name: "Infuse",
    scheme: "infuse://x-callback-url/play?url=$durl",
    platforms: ["MacOS", "iOS"],
  },
  {
    icon: "fileball",
    name: "Fileball",
    scheme: "filebox://play?url=$durl",
    platforms: ["MacOS", "iOS"],
  },
  {
    icon: "mxplayer",
    name: "MX Player",
    scheme:
      "intent:$durl#Intent;package=com.mxtech.videoplayer.ad;S.title=$name;end",
    platforms: ["Android"],
  },
  {
    icon: "mxplayer-pro",
    name: "MX Player Pro",
    scheme:
      "intent:$durl#Intent;package=com.mxtech.videoplayer.pro;S.title=$name;end",
    platforms: ["Android"],
  },
  {
    icon: "iPlay",
    name: "iPlay",
    scheme: "iplay://play/any?type=url&url=$bdurl",
    platforms: ["iOS"],
  },
  {
    // mpv-handler format (github.com/akiirui/mpv-handler): URL-safe base64
    // payload, with the matching external subtitle passed via subfile so the
    // sidecar .srt/.ass/.vtt auto-loads. Falls back to a plain launch when the
    // video has no sidecar subtitle (empty subfile is stripped by convertURL).
    icon: "mpv",
    name: "mpv",
    scheme: "mpv://play/$Bdurl/?subfile=$Bsub",
    platforms: ["Windows", "MacOS", "Linux", "Android"],
  },
]

export const AutoHeightPlugin = (player: Artplayer) => {
  const { $container, $video } = player.template
  const $videoBox = $container.parentElement!

  player.on("ready", () => {
    const offsetBottom = "1.75rem" // position bottom of "More" button + padding
    $videoBox.style.maxHeight = `calc(100vh - ${$videoBox.offsetTop}px - ${offsetBottom})`
    $videoBox.style.minHeight = "320px" // min width of mobile phone
    player.autoHeight()
  })
  player.on("resize", () => {
    player.autoHeight()
  })
  player.on("error", () => {
    if ($video.style.height) return
    $container.style.height = "60vh"
    $video.style.height = "100%"
  })
}
