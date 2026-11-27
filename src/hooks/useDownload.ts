import axios from "axios"
import {
  downloadDenied,
  getSettingBool,
  local,
  me,
  password,
  selectedObjs as _selectedObjs,
} from "~/store"
import { bus, fsList, notify, pathBase, pathJoin } from "~/utils"
import { getLinkByDirAndObj, useLink, useRouter, useT } from "~/hooks"
import { useSelectedLink } from "~/hooks"
import { Obj, UserMethods } from "~/types"

/**
 * Saves one file from this tab. An <a download> to the page's own origin saves
 * the response under the file's name, whatever its type, and opens nothing
 * (the prototype's finding, research 03 §八.1). Across origins the browser
 * ignores `download`: a /d that redirects to a storage's CDN (115 and the
 * like) opens there in a new tab, as every download did before, under the
 * name the CDN gives (plan §0.3-1, a backend change not yet approved).
 */
export const saveFile = (url: string, name: string) => {
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.target = "_blank"
  a.rel = "noopener"
  a.style.display = "none"
  document.body.append(a)
  a.click()
  a.remove()
}

/** Whether this user may download folders and many files as one zip. */
export const packageAllowed = () =>
  UserMethods.is_admin(me()) || getSettingBool("package_download")

interface File {
  path: string
  dir: string
  url: string
  name: string
}

function isEmpty(value: string | object): boolean {
  return value === undefined || value === null || value === ""
}
function isNullOrUndefined(value: string | object): boolean {
  return value === undefined || value === null
}

async function getSaveDir(rpc_url: string, rpc_secret: string) {
  let save_dir: string = "/downloads/openlist"

  const resp = await axios.post(rpc_url, {
    id: Math.random().toString(),
    jsonrpc: "2.0",
    method: "aria2.getGlobalOption",
    params: ["token:" + (rpc_secret ?? "")],
  })
  console.log(resp)
  if (resp.status === 200) {
    if (!isEmpty(resp.data.result.dir)) {
      save_dir = resp.data.result.dir
    }
    save_dir = save_dir.endsWith("/") ? save_dir.slice(0, -1) : save_dir
  }
  return save_dir
}
export const useDownload = () => {
  const { rawLinks } = useSelectedLink()
  const t = useT()
  // The owner of a share can switch downloads off; say so instead of failing.
  const denied = () => {
    if (!downloadDenied()) return false
    notify.warning(t("shares.download_disabled"))
    return true
  }
  const { pathname, isShare } = useRouter()
  const { rawLink } = useLink()
  return {
    batchDownloadSelected: () => {
      if (denied()) return
      _selectedObjs()
        .filter((obj) => !obj.is_dir)
        .forEach((obj) => saveFile(rawLink(obj, true), obj.name))
    },
    /**
     * The download of the list, the menus and the viewers (plan §0.2 下载):
     * one file saves where it is; several files or a folder go as one package
     * (the selection is what the package takes). Without the package right,
     * plain files still save one by one.
     */
    downloadObjs: (objs: Obj[]) => {
      if (denied() || !objs.length) return
      const files = objs.filter((obj) => !obj.is_dir)
      if (objs.length === 1 && files.length === 1) {
        saveFile(rawLink(files[0], true), files[0].name)
        return
      }
      if (packageAllowed()) {
        bus.emit("tool", "package_download")
        return
      }
      if (files.length < objs.length) {
        notify.warning(t("home.toolbar.package_download_disabled"))
        return
      }
      files.forEach((obj) => saveFile(rawLink(obj, true), obj.name))
    },
    sendToAria2: async () => {
      if (denied()) return
      const selectedObjs = _selectedObjs()
      const fetchFolderStructure = async (
        pre: string,
        obj: Obj,
      ): Promise<File[] | string> => {
        if (!obj.is_dir) {
          return [
            {
              path: pathJoin(pre, obj.name),
              dir: pre,
              url: getLinkByDirAndObj(
                pathJoin(pathname(), pre),
                obj,
                "direct",
                isShare(),
                true,
              ),
              name: obj.name,
            },
          ]
        } else {
          const resp = await fsList(
            pathJoin(pathname(), pre, obj.name),
            isShare() ? "" : password(),
          )
          if (resp.code !== 200) {
            return resp.message
          }
          const res: File[] = []
          for (const _obj of resp.data.content ?? []) {
            const _res = await fetchFolderStructure(
              pathJoin(pre, obj.name),
              _obj,
            )
            if (typeof _res === "string") {
              return _res
            } else {
              res.push(..._res)
            }
          }
          return res
        }
      }
      const { aria2_rpc_url, aria2_rpc_secret } = local
      if (!aria2_rpc_url) {
        notify.warning(t("home.toolbar.aria2_not_set"))
        return
      }
      try {
        let save_dir = "/downloads/openlist"
        // TODO: select dir, but it seems there is no way to get the full path
        // if (window.showDirectoryPicker) {
        //   const dirHandle = await window.showDirectoryPicker()
        //   save_dir = dirHandle.name
        //   console.log(dirHandle)
        //   return
        // }
        save_dir = await getSaveDir(aria2_rpc_url, aria2_rpc_secret)
        let isStartAria2Mission = false
        notify.info(`${t("home.package_download.fetching_struct")}`)
        for (const obj of selectedObjs) {
          const res = await fetchFolderStructure("", obj)

          if (typeof res !== "object" || res.length === undefined) {
            notify.error(
              `${t("home.package_download.fetching_struct_failed")}: ${res}`,
            )
            return res
          } else {
            for (let key = 0; key < res.length; key++) {
              if (
                isEmpty(res[key].path) ||
                isNullOrUndefined(res[key].dir) ||
                isEmpty(res[key].url) ||
                isEmpty(res[key].name)
              ) {
                notify.error(
                  `${t(
                    "home.package_download.fetching_struct_failed",
                  )}: ${JSON.stringify(res[key])}`,
                )
                continue
              }
              if (!isStartAria2Mission) {
                isStartAria2Mission = true
                notify.info(`${t("home.package_download.downloading")}`)
              }
              const resp = await axios.post(aria2_rpc_url, {
                id: Math.random().toString(),
                jsonrpc: "2.0",
                method: "aria2.addUri",
                params: [
                  "token:" + (aria2_rpc_secret ?? ""),
                  [res[key].url],
                  {
                    out: res[key].name,
                    dir: save_dir + res[key].dir,
                    "check-certificate": "false",
                  },
                ],
              })
              console.log(resp)
            }
          }
        }
        notify.success(t("home.toolbar.send_aria2_success"))
      } catch (e) {
        console.error(e)
        notify.error(`failed to send to aria2: ${e}`)
      }
    },
    playlistDownloadSelected: () => {
      if (denied()) return
      const selectedObjs = _selectedObjs().filter((obj) => !obj.is_dir)
      let saveName = pathBase(pathname())
      if (selectedObjs.length === 1) {
        saveName = selectedObjs[0].name
      }
      if (!saveName) {
        saveName = t("manage.sidemenu.home")
      }
      const m3u8Content = selectedObjs.reduce(
        (acc, obj, index) =>
          `${acc}#EXTINF:-1,${obj.name}\n${rawLinks(true)[index]}\n`,
        "#EXTM3U\n",
      )
      const m3u8Blob = new Blob([m3u8Content], {
        type: "application/x-mpegURL",
      })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(m3u8Blob)
      a.download = `${saveName}.m3u8`
      a.click()
      URL.revokeObjectURL(a.href)
    },
  }
}
