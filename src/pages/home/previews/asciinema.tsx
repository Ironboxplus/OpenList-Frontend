import { asPreview } from "~/utils"
// @ts-ignore
import * as AsciinemaPlayer from "asciinema-player"
import "asciinema-player/dist/bundle/asciinema-player.css"
import { onMount } from "solid-js"
import { objStore } from "~/store"
export default function Preview() {
  let d!: HTMLDivElement

  onMount(() => {
    AsciinemaPlayer.create(asPreview(objStore.raw_url), d)
  })
  return <div class="w-full" ref={d} />
}
