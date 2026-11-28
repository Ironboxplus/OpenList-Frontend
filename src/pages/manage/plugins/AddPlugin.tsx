import { createSignal, Show } from "solid-js"
import { FiUploadCloud } from "solid-icons/fi"
import { FaSolidPuzzlePiece } from "solid-icons/fa"
import { useManageTitle, useRouter, useT } from "~/hooks"
import { PluginItem, Resp } from "~/types"
import { handleResp, notify, parsePluginZip, pluginEngine, r } from "~/utils"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { SimpleSelect } from "~/components/ui/simple-select"
import { SwitchField } from "~/components/ui/toggle-field"

const AddPlugin = () => {
  const t = useT()
  const { back, to } = useRouter()
  useManageTitle("plugins.actions.install")

  const [loading, setLoading] = createSignal(false)
  const [installMethod, setInstallMethod] = createSignal<"zip" | "url">("zip")

  // ZIP upload state
  const [zipFile, setZipFile] = createSignal<File | null>(null)
  const [zipParsedManifest, setZipParsedManifest] =
    createSignal<Partial<PluginItem> | null>(null)
  const [isDragging, setIsDragging] = createSignal(false)

  // URL state
  const [manifestUrl, setManifestUrl] = createSignal("")

  // High privilege state
  const [highPrivilege, setHighPrivilege] = createSignal(false)

  const handleFileChange = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      notify.error("Please select a .zip plugin archive")
      return
    }
    setZipFile(file)
    setLoading(true)
    try {
      const extracted = await parsePluginZip(file)
      setZipParsedManifest(extracted.manifest)
      if (extracted.manifest.high_privilege) {
        setHighPrivilege(true)
      }
      notify.success("ZIP plugin package parsed successfully")
    } catch (err: any) {
      notify.error("ZIP parse failed: " + err.message)
      setZipFile(null)
      setZipParsedManifest(null)
    } finally {
      setLoading(false)
    }
  }

  const handleInstall = async () => {
    setLoading(true)
    try {
      if (installMethod() === "zip") {
        const manifest = zipParsedManifest()
        if (!manifest || !manifest.id) {
          notify.warning("Please upload a valid plugin ZIP file first")
          return
        }
        const resp: Resp<PluginItem> = await r.post("/admin/plugin/install", {
          ...manifest,
          high_privilege: highPrivilege(),
          enabled: true,
        })
        handleResp(resp, (installed) => {
          if (installed.enabled) {
            pluginEngine.loadPlugin(installed)
          }
          notify.success(t("global.add") + " " + t("global.success"))
          to("/@manage/plugins")
        })
      } else {
        const url = manifestUrl().trim()
        if (!url) {
          notify.warning("Please enter the plugin manifest URL")
          return
        }
        const resp: Resp<PluginItem> = await r.post("/admin/plugin/install", {
          manifest_url: url,
          high_privilege: highPrivilege(),
        })
        handleResp(resp, (installed) => {
          if (installed.enabled) {
            pluginEngine.loadPlugin(installed)
          }
          notify.success(t("global.add") + " " + t("global.success"))
          to("/@manage/plugins")
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="flex flex-col items-start w-full max-w-3xl gap-y-5">
      <h2 class="font-semibold mb-1">{t("plugins.actions.install")}</h2>

      {/* 1. Install Method Select */}
      <div class="relative w-full flex flex-col items-start gap-1.5">
        <label
          class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
          for="install_method"
        >
          {t("plugins.install_modal.install_type")}
        </label>
        <SimpleSelect
          class="w-full max-w-sm"
          options={[
            { value: "zip", label: t("plugins.install_modal.zip_tab") },
            { value: "url", label: t("plugins.install_modal.url_tab") },
          ]}
          value={installMethod()}
          onChange={(v) => setInstallMethod(v as "zip" | "url")}
        />
      </div>

      {/* 2. ZIP Mode */}
      <Show
        when={installMethod() === "zip"}
        fallback={
          <div class="relative w-full flex flex-col items-start gap-1.5">
            <label
              class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
              for="manifest_url"
            >
              {t("plugins.install_modal.url_label")}
            </label>
            <Input
              class="w-full max-w-2xl"
              id="manifest_url"
              placeholder={t("plugins.install_modal.url_placeholder")}
              value={manifestUrl()}
              onInput={(e: any) => setManifestUrl(e.target.value)}
            />
            <p class="mt-0.5 inline-block text-xs leading-5 text-muted-foreground">
              {t("plugins.install_modal.url_help")}
            </p>
          </div>
        }
      >
        <div class="relative w-full flex flex-col items-start gap-1.5">
          <label class="inline-block mb-1 text-sm leading-5 font-medium text-foreground">
            {t("plugins.install_modal.zip_file_label")}
          </label>
          <div
            class="w-full max-w-2xl cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-all hover:border-primary"
            classList={{
              "border-primary bg-primary/10": isDragging(),
              "border-border bg-muted": !isDragging(),
            }}
            onDragOver={(e: DragEvent) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault()
              setIsDragging(false)
              if (e.dataTransfer?.files?.[0]) {
                handleFileChange(e.dataTransfer.files[0])
              }
            }}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = ".zip"
              input.onchange = (e: any) => {
                if (e.target.files?.[0]) {
                  handleFileChange(e.target.files[0])
                }
              }
              input.click()
            }}
          >
            <div class="flex flex-col items-center gap-y-2">
              <FiUploadCloud class="size-8 text-primary" />
              <p class="font-medium text-sm">
                {zipFile()
                  ? zipFile()?.name
                  : t("plugins.install_modal.zip_drop_title")}
              </p>
              <p class="text-xs text-muted-foreground">
                {t("plugins.install_modal.zip_drop_help")}
              </p>
            </div>
          </div>
        </div>

        {/* Extracted Preview */}
        <Show when={zipParsedManifest()}>
          <div class="w-full max-w-2xl p-3 rounded-md border border-primary bg-primary/10">
            <div class="flex flex-row items-center gap-x-3">
              <div class="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
                <Show
                  when={zipParsedManifest()?.icon}
                  fallback={<FaSolidPuzzlePiece class="size-5" />}
                >
                  <img
                    src={zipParsedManifest()?.icon}
                    alt="plugin icon"
                    style={{
                      width: "22px",
                      height: "22px",
                      "object-fit": "contain",
                    }}
                  />
                </Show>
              </div>
              <div class="flex flex-1 flex-col items-start gap-y-0.5">
                <div class="flex flex-row items-center flex-wrap gap-x-2">
                  <p class="font-bold text-sm">{zipParsedManifest()?.name}</p>
                  <Badge variant="info">v{zipParsedManifest()?.version}</Badge>
                  <Badge variant="outline">{zipParsedManifest()?.id}</Badge>
                </div>
                <p class="text-xs text-muted-foreground line-clamp-1">
                  {zipParsedManifest()?.description ||
                    "ZIP plugin package parsed successfully"}
                </p>
              </div>
            </div>
          </div>
        </Show>
      </Show>

      {/* 3. High Privilege Option */}
      <div class="relative w-full flex flex-col items-start gap-1.5">
        <label
          class="inline-block mb-1 text-sm leading-5 font-medium text-foreground"
          for="high_privilege"
        >
          {t("plugins.install_modal.high_privilege_label")}
        </label>
        <div class="flex flex-row items-center gap-x-2">
          <SwitchField
            id="high_privilege"
            checked={highPrivilege()}
            onChange={setHighPrivilege}
          />
          <Show when={highPrivilege()}>
            <Badge variant="danger">Root Access</Badge>
          </Show>
        </div>
        <p class="mt-0.5 inline-block text-xs leading-5 text-muted-foreground">
          {t("plugins.install_modal.high_privilege_help")}
        </p>
      </div>

      {/* 4. Operations */}
      <div class="flex flex-row items-center mt-2 gap-x-2">
        <Button variant="subtle" loading={loading()} onClick={handleInstall}>
          {t("global.add")}
        </Button>
        <Button variant="secondary" onClick={() => back()}>
          {t("global.back")}
        </Button>
      </div>
    </div>
  )
}

export default AddPlugin
