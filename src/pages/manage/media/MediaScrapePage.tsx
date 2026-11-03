import CommonSettings from "../settings/Common"
import { useT } from "~/hooks"
import { Group } from "~/types"

/** 刮削相关设置项（TMDB API Key ~ Scrape concurrency） */
const SCRAPE_KEYS = [
  "media_tmdb_key",
  "media_tmdb_api_url",
  "media_discogs_token",
  "media_discogs_api_url",
  "media_scrape_language",
  "media_book_source",
  "media_google_books_key",
  "media_download_cover",
  "media_store_thumbnail",
  "media_thumbnail_mode",
  "media_thumbnail_path",
  "media_scrape_concurrency",
]

const MediaScrapePage = () => {
  const t = useT()
  return (
    <div class="flex w-full flex-col gap-4">
      <h1 class="sr-only">{t("manage.sidemenu.media_scrape")}</h1>
      <p class="m-0 text-sm text-muted-foreground">
        {t("manage.media_lib.scrape_desc")}
      </p>
      <CommonSettings
        group={Group.MEDIA}
        keys={SCRAPE_KEYS}
        readOnlyKey={(key, all) => {
          if (key !== "media_thumbnail_path") return false
          const mode = all.find((i) => i.key === "media_thumbnail_mode")?.value
          return mode !== "local"
        }}
      />
    </div>
  )
}

export default MediaScrapePage
