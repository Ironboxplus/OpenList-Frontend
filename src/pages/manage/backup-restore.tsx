import { Button } from "~/components/ui/button"
import { FieldRenderer, SettingsSection } from "~/features/settings/form"
import { r, handleRespWithoutNotify, notify } from "~/utils"
import { useFetch, useManageTitle, useT } from "~/hooks"
import {
  Meta,
  Storage,
  SettingItem,
  User,
  PResp,
  Resp,
  PEmptyResp,
  PPageResp,
  ShareInfo,
  Type,
} from "~/types"
import { createSignal, For } from "solid-js"
import crypto from "crypto-js"
import { cn } from "~/utils/cn"

interface Data {
  encrypted: string
  settings: SettingItem[]
  users: User[]
  storages: Storage[]
  metas: Meta[]
  shares: ShareInfo[]
}
type LogType = "success" | "error" | "info"
const LogMap = {
  success: { icon: "✅", class: "text-success" },
  error: { icon: "❌", class: "text-destructive" },
  info: { icon: "ℹ️", class: "text-muted-foreground" },
}
const Log = (props: { msg: string; type: LogType }) => {
  return (
    <div class="flex w-full gap-1 text-sm">
      <span>{LogMap[props.type].icon}</span>
      <span class={cn("break-all", LogMap[props.type].class)}>{props.msg}</span>
    </div>
  )
}

const BackupRestore = () => {
  const [override, setOverride] = createSignal(false)
  const [password, setPassword] = createSignal("")
  const t = useT()
  useManageTitle("manage.sidemenu.backup-restore")
  let logRef!: HTMLDivElement
  const [log, setLog] = createSignal<
    {
      type: LogType
      msg: string
    }[]
  >([])
  const appendLog = (msg: string, type: LogType) => {
    setLog((prev) => [...prev, { type, msg }])
    logRef.scrollTop = logRef.scrollHeight
  }
  const [getSettingsLoading, getSettings] = useFetch((): PResp<any> =>
    r.get("/admin/setting/list"),
  )
  const [getUsersLoading, getUsers] = useFetch((): PPageResp<User> =>
    r.get("/admin/user/list"),
  )
  const [getMetasLoading, getMetas] = useFetch((): PPageResp<Meta> =>
    r.get("/admin/meta/list"),
  )
  const [getStoragesLoading, getStorages] = useFetch((): PPageResp<Storage> =>
    r.get("/admin/storage/list"),
  )
  const [getSharesLoading, getShares] = useFetch((): PPageResp<ShareInfo> =>
    r.get("/share/list"),
  )
  const backupLoading = () => {
    return (
      getSettingsLoading() ||
      getUsersLoading() ||
      getMetasLoading() ||
      getStoragesLoading() ||
      getSharesLoading()
    )
  }
  function encrypt(data: any, key: string): string {
    if (key == "") return data
    const encJson = crypto.AES.encrypt(JSON.stringify(data), key).toString()
    return crypto.enc.Base64.stringify(crypto.enc.Utf8.parse(encJson))
  }

  function decrypt(
    data: any,
    key: string,
    raw: boolean,
    encrypted: boolean,
  ): string {
    if (!encrypted) return data
    const decData = crypto.enc.Base64.parse(data).toString(crypto.enc.Utf8)
    if (raw) return crypto.AES.decrypt(decData, key).toString(crypto.enc.Utf8)
    return JSON.parse(
      crypto.AES.decrypt(decData, key).toString(crypto.enc.Utf8),
    )
  }

  const backup = async () => {
    appendLog(t("br.start_backup"), "info")
    const allData: Data = {
      encrypted: "",
      settings: [],
      users: [],
      storages: [],
      metas: [],
      shares: [],
    }
    if (password() != "") allData.encrypted = encrypt("encrypted", password())
    for (const item of [
      { name: "settings", fn: getSettings, page: false },
      { name: "users", fn: getUsers, page: true },
      { name: "storages", fn: getStorages, page: true },
      { name: "metas", fn: getMetas, page: true },
      { name: "shares", fn: getShares, page: true },
    ] as const) {
      const resp = await item.fn()
      handleRespWithoutNotify(
        resp as Resp<any>,
        (data) => {
          appendLog(
            t("br.success_backup_item", {
              item: t(`manage.sidemenu.${item.name}`),
            }),
            "success",
          )
          if (item.page) {
            for (let i = 0; i < data.content.length; i++) {
              const obj = data.content[i]
              for (const key in obj) {
                obj[key] = encrypt(obj[key], password())
              }
            }
            allData[item.name] = data.content
          } else {
            for (let i = 0; i < data.length; i++) {
              const obj = data[i]
              for (const key in obj) {
                obj[key] = encrypt(obj[key], password())
              }
            }
            allData[item.name] = data
          }
        },
        (msg) => {
          appendLog(
            t("br.failed_backup_item", {
              item: t(`manage.sidemenu.${item.name}`),
            }) +
              ":" +
              msg,
            "error",
          )
        },
      )
    }
    download(
      "openlist_backup_" + new Date().toLocaleString() + ".json",
      allData,
    )
    appendLog(t("br.finish_backup"), "info")
  }
  const [addSettingsLoading, addSettings] = useFetch(
    (data: SettingItem[]): PEmptyResp => r.post("/admin/setting/save", data),
  )
  const [addUserLoading, addUser] = useFetch((user: User): PEmptyResp => {
    return r.post(`/admin/user/create`, user)
  })
  const [addStorageLoading, addStorage] = useFetch(
    (storage: Storage): PEmptyResp => {
      return r.post(`/admin/storage/create`, storage)
    },
  )
  const [addMetaLoading, addMeta] = useFetch((meta: Meta): PEmptyResp => {
    return r.post(`/admin/meta/create`, meta)
  })
  const [addShareLoading, addShare] = useFetch(
    (share: ShareInfo): PEmptyResp => {
      return r.post(`/share/create`, share)
    },
  )
  const [updateUserLoading, updateUser] = useFetch((user: User): PEmptyResp => {
    return r.post(`/admin/user/update`, user)
  })
  const [updateStorageLoading, updateStorage] = useFetch(
    (storage: Storage): PEmptyResp => {
      return r.post(`/admin/storage/update`, storage)
    },
  )
  const [updateMetaLoading, updateMeta] = useFetch((meta: Meta): PEmptyResp => {
    return r.post(`/admin/meta/update`, meta)
  })
  const [updateShareLoading, updateShare] = useFetch(
    (share: ShareInfo): PEmptyResp => {
      return r.post(`/share/update`, share)
    },
  )
  async function handleOvrData<T>(
    dataArray: T[],
    getDataFunc: { (): PResp<{ content: T[]; total: number }> },
    addDataFunc: {
      (t: T): PEmptyResp
    },
    updateDataFunc: {
      (t: T): PEmptyResp
    },
    idFieldName: keyof T,
    itemName: string,
  ) {
    const currentData = (await getDataFunc()).data.content
    for (const i in dataArray) {
      const currentItem = dataArray[i]
      const currentIdValue = currentItem[idFieldName]
      const currentDataItem = currentData.find(
        (d) => d[idFieldName] === currentIdValue,
      )
      const method = currentDataItem ? "update" : "add"
      const handleDataFunc = method === "add" ? addDataFunc : updateDataFunc
      await handleRespWithoutNotify(
        await handleDataFunc(currentItem),
        () => {
          appendLog(
            t("br.success_restore_item", {
              item: t(itemName),
            }) +
              "-" +
              `[${currentIdValue}]`,
            "success",
          )
        },
        (msg) => {
          appendLog(
            t("br.failed_restore_item", {
              item: t(itemName),
            }) +
              "-" +
              `[${currentIdValue}]` +
              ":" +
              msg,
            "error",
          )
        },
      )
    }
  }
  const restoreLoading = () => {
    return (
      addSettingsLoading() ||
      addUserLoading() ||
      addStorageLoading() ||
      addMetaLoading() ||
      addShareLoading() ||
      updateUserLoading() ||
      updateStorageLoading() ||
      updateMetaLoading() ||
      updateShareLoading()
    )
  }
  const restore = async () => {
    appendLog(t("br.start_restore"), "info")
    const file = document.createElement("input")
    file.type = "file"
    file.accept = "application/json"
    file.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) {
        notify.warning(t("br.no_file"))
        return
      }
      const file = files[0]
      const reader = new FileReader()
      reader.onload = async () => {
        const data: Data = JSON.parse(reader.result as string)
        const encrypted = Boolean(data.encrypted)
        if (encrypted) {
          // A wrong password usually makes the AES output invalid UTF-8, which
          // throws instead of returning a different string.
          let marker = ""
          try {
            marker = decrypt(data.encrypted, password(), true, true)
          } catch (e) {
            console.warn("restore: decrypting the marker failed", e)
          }
          if (marker !== '"encrypted"') {
            appendLog(t("br.wrong_encrypt_password"), "error")
            return
          }
        }
        // 解密 settings + users/storages/metas/shares（备份时这 5 个数组均被加密）。
        // 原实现用 Object.values(data) 从 length-4 开始解密，会漏掉 settings
        // （加密备份恢复后 settings 仍是密文，导致 customize_head/body 等配置失效）。
        for (const name of [
          "settings",
          "users",
          "storages",
          "metas",
          "shares",
        ] as const) {
          const arr = (data as any)[name]
          if (!Array.isArray(arr)) continue
          for (const obj1 of arr) {
            for (const key in obj1) {
              obj1[key] = decrypt(obj1[key], password(), false, encrypted)
            }
          }
        }
        if (override()) {
          await backup()
        }
        data.settings &&
          handleRespWithoutNotify(
            await addSettings(
              data.settings.filter(
                (s) => !["version", "index_progress"].includes(s.key),
              ),
            ),
            () => {
              appendLog(
                t("br.success_restore_item", {
                  item: t("manage.sidemenu.settings"),
                }),
                "success",
              )
            },
            (msg) => {
              appendLog(
                t("br.failed_restore_item", {
                  item: t("manage.sidemenu.settings"),
                }) +
                  ":" +
                  msg,
                "error",
              )
            },
          )
        if (override()) {
          await handleOvrData(
            data.users,
            getUsers,
            addUser,
            updateUser,
            "username",
            "manage.sidemenu.users",
          )
          await handleOvrData(
            data.storages,
            getStorages,
            addStorage,
            updateStorage,
            "mount_path",
            "manage.sidemenu.storages",
          )
          await handleOvrData(
            data.metas,
            getMetas,
            addMeta,
            updateMeta,
            "path",
            "manage.sidemenu.metas",
          )
          await handleOvrData(
            data.shares,
            getShares,
            addShare,
            updateShare,
            "id",
            "manage.sidemenu.shares",
          )
        } else {
          for (const item of [
            {
              name: "users",
              fn: addUser,
              data: data.users,
              key: "username",
              removeId: true,
            },
            {
              name: "storages",
              fn: addStorage,
              data: data.storages,
              key: "mount_path",
              removeId: true,
            },
            {
              name: "metas",
              fn: addMeta,
              data: data.metas,
              key: "path",
              removeId: true,
            },
            {
              name: "shares",
              fn: addShare,
              data: data.shares,
              key: "id",
              removeId: false,
            },
          ] as const) {
            for (const itemData of item.data || []) {
              if (item.removeId) {
                itemData.id = 0
              }
              handleRespWithoutNotify(
                await item.fn(itemData),
                () => {
                  appendLog(
                    t("br.success_restore_item", {
                      item: t(`manage.sidemenu.${item.name}`),
                    }) +
                      "-" +
                      `[${(itemData as any)[item.key]}]`,
                    "success",
                  )
                },
                (msg) => {
                  appendLog(
                    t("br.failed_restore_item", {
                      item: t(`manage.sidemenu.${item.name}`),
                    }) +
                      ` [ ${(itemData as any)[item.key]} ] ` +
                      ":" +
                      msg,
                    "error",
                  )
                },
              )
            }
          }
        }
        appendLog(t("br.finish_restore"), "info")
      }
      reader.readAsText(file)
    }
    file.click()
  }
  return (
    <div class="flex w-full flex-col gap-4">
      <SettingsSection
        id="backup-restore"
        title={t("manage.sidemenu.backup-restore")}
        actions={
          <>
            <Button
              type="button"
              disabled={backupLoading()}
              onClick={() => backup()}
            >
              {t("br.backup")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={restoreLoading()}
              onClick={() => restore()}
            >
              {t("br.restore")}
            </Button>
          </>
        }
      >
        <FieldRenderer
          field={{
            id: "restore-override",
            type: Type.Bool,
            labelKey: "br.override",
          }}
          value={override()}
          onChange={(raw) => setOverride(raw === true)}
        />
        <FieldRenderer
          field={{
            id: "password",
            type: Type.String,
            labelKey: "br.encrypt_password",
            placeholder: t("br.encrypt_password_placeholder"),
            secret: true,
          }}
          value={password()}
          onChange={(raw) => setPassword(String(raw))}
        />
      </SettingsSection>
      <div
        ref={logRef!}
        class="flex h-[50vh] w-full flex-col gap-1 overflow-y-auto rounded-lg border bg-muted/40 p-3"
      >
        <For each={log()}>{(item) => <Log {...item} />}</For>
      </div>
    </div>
  )
}

function download(filename: string, data: any) {
  const file = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default BackupRestore
