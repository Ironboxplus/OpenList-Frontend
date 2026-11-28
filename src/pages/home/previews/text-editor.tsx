import { createShortcut } from "@solid-primitives/keyboard"
import { useBeforeLeave } from "@solidjs/router"
import type * as monacoType from "monaco-editor"
import { BiRegularRedo, BiRegularUndo } from "solid-icons/bi"
import { FaSolidMinus, FaSolidPlus } from "solid-icons/fa"
import {
  TbBraces,
  TbClipboardText,
  TbCopy,
  TbDeviceFloppy,
  TbMap,
  TbMapOff,
  TbTextWrap,
  TbTextWrapDisabled,
} from "solid-icons/tb"
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { BoxWithFullScreen, EncodingSelect, MaybeLoading } from "~/components"
import { monaco, MonacoEditorLoader } from "~/components/MonacoEditor"
import { useFetchText, useParseText, useRouter, useT, useUtil } from "~/hooks"
import { StreamUpload } from "~/pages/home/uploads/stream"
import { local, objStore, setLocal, userCan, viewerPath } from "~/store"
import { notify } from "~/utils"
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "~/components/overlay"
import { colorMode } from "~/store/color-mode"
import { Button } from "~/components/ui/button"
import { cn } from "~/utils/cn"
import { Input } from "~/components/ui/input"

interface LanguageOption {
  id: string
  aliases?: string[]
}

function Editor(props: { data?: string | ArrayBuffer; contentType?: string }) {
  const theme = createMemo(() => (colorMode() === "light" ? "vs" : "vs-dark"))
  const { pathname } = useRouter()
  const { isString, text } = useParseText(props.data)
  const [encoding, setEncoding] = createSignal("utf-8")
  const [value, setValue] = createSignal(text(encoding()))
  const t = useT()
  const { copy, paste } = useUtil()

  // Editor instance reference
  const [editor, setEditor] =
    createSignal<monacoType.editor.IStandaloneCodeEditor>()
  let savedVersionId = 0

  // Track modified state
  const [modified, setModified] = createSignal(false)
  const [cursorLine, setCursorLine] = createSignal(1)
  const [cursorColumn, setCursorColumn] = createSignal(1)
  const [wordCount, setWordCount] = createSignal(0)
  const [language, setLanguage] = createSignal("")
  const [languageOptions, setLanguageOptions] = createSignal<LanguageOption[]>(
    [],
  )

  const wordWrap = () => local.editor_word_wrap === "true"
  const minimap = () => local.editor_minimap !== "false"
  const [saving, setSaving] = createSignal(false)
  const [langSearch, setLangSearch] = createSignal("")

  const filteredLanguages = createMemo(() => {
    const s = langSearch().toLowerCase()
    if (!s) return languageOptions()
    return languageOptions().filter(
      (l) =>
        l.id.toLowerCase().includes(s) ||
        l.aliases?.some((a) => a.toLowerCase().includes(s)),
    )
  })

  const languageDisplayName = createMemo(() => {
    const lang = languageOptions().find((l) => l.id === language())
    return lang?.aliases?.[0] || language()
  })

  const canWrite = createMemo(
    () =>
      // objStore.write is only set from folder listing (FsListResp),
      // not from file detail (FsGetResp). When directly entering a file,
      // write is undefined, so fall back to permission check only.
      (userCan("write_content") || objStore.write_content_bypass) &&
      objStore.write !== false,
  )

  // Warn on in-app navigation when there are unsaved changes
  useBeforeLeave((e) => {
    if (canWrite() && modified()) {
      if (!window.confirm(t("global.unsaved_changes_confirm"))) {
        e.preventDefault()
      }
    }
  })

  onMount(() => {
    if (canWrite()) {
      // Save on Ctrl+S / Cmd+S
      createShortcut(["Control", "S"], (e: KeyboardEvent | null) => {
        e?.preventDefault()
        onSave()
      })
      createShortcut(["Meta", "S"], (e: KeyboardEvent | null) => {
        e?.preventDefault()
        onSave()
      })

      // Warn on browser close/refresh when there are unsaved changes
      const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        if (modified()) {
          e.preventDefault()
        }
      }
      window.addEventListener("beforeunload", beforeUnloadHandler)

      onCleanup(() => {
        window.removeEventListener("beforeunload", beforeUnloadHandler)
      })
    }
  })

  createEffect(
    on(encoding, (v) => {
      setValue(text(v))
      setModified(false)
    }),
  )

  async function onSave() {
    const ed = editor()
    if (saving() || !ed) return

    const savedVersion = ed.getModel()?.getAlternativeVersionId() ?? 0
    setSaving(true)
    try {
      const file = new File([value()], objStore.obj.name, {
        type: props.contentType || "text/plain",
      })
      await StreamUpload(
        viewerPath() ?? pathname(),
        file,
        () => {},
        false,
        true,
        false,
      )
      savedVersionId = savedVersion
      setModified(
        (ed.getModel()?.getAlternativeVersionId() ?? 0) !== savedVersionId,
      )
      notify.success(t("global.save_success"))
    } catch (e: any) {
      notify.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  function onEditorReady(ed: monacoType.editor.IStandaloneCodeEditor) {
    setEditor(ed)

    // Track cursor position
    ed.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber)
      setCursorColumn(e.position.column)
    })

    // Track content changes for modified state
    savedVersionId = ed.getModel()?.getAlternativeVersionId() ?? 0
    ed.onDidChangeModelContent(() => {
      const currentVersionId = ed.getModel()?.getAlternativeVersionId() ?? 0
      setModified(currentVersionId !== savedVersionId)
      updateWordCount(ed)
    })

    // Initial word count
    updateWordCount(ed)

    // Detect language from model
    const lang = ed.getModel()?.getLanguageId() ?? ""
    setLanguage(lang)

    // Populate language options from Monaco
    if (monaco?.languages?.getLanguages) {
      const langs = monaco.languages.getLanguages() as LanguageOption[]
      setLanguageOptions(langs.sort((a, b) => a.id.localeCompare(b.id)))
    }
  }

  function updateWordCount(ed: monacoType.editor.IStandaloneCodeEditor) {
    const content = ed.getValue()
    if (!content) {
      setWordCount(0)
      return
    }
    const trimmed = content.trim()
    setWordCount(trimmed ? trimmed.split(/\s+/).length : 0)
  }

  function undo() {
    editor()?.trigger("toolbar", "undo", null)
  }

  function redo() {
    editor()?.trigger("toolbar", "redo", null)
  }

  async function copyToClipboard() {
    const ed = editor()
    if (!ed) return
    const sel = ed.getSelection()
    const selection = sel ? (ed.getModel()?.getValueInRange(sel) ?? "") : ""
    const text = selection || ed.getValue()
    await copy(text)
  }

  async function pasteFromClipboard() {
    const ed = editor()
    if (!ed) return

    const text = await paste()
    if (!text) return
    const selection = ed.getSelection()
    if (selection) {
      ed.executeEdits("paste", [
        { range: selection, text, forceMoveMarkers: true },
      ])
    } else {
      ed.trigger("keyboard", "paste", { text })
    }
    ed.focus()
  }

  function toggleWordWrap() {
    setLocal("editor_word_wrap", String(!wordWrap()))
  }

  function changeFontSize(delta: number) {
    const current = parseInt(local.editor_font_size) || 14
    const next = Math.max(8, Math.min(40, current + delta))
    setLocal("editor_font_size", String(next))
  }

  return (
    <div class="flex h-full w-full flex-col items-stretch bg-card dark:bg-muted">
      {/* Toolbar */}
      <div class="flex shrink-0 items-center gap-x-1 overflow-x-auto border-b border-border bg-muted px-3 py-1.5 dark:bg-card">
        <Show when={canWrite()}>
          <Tooltip label={`${t("global.save")} (Ctrl+S)`} withArrow>
            <Button
              variant="subtle"
              size="sm"
              class="gap-1.5"
              aria-label={t("global.save")}
              disabled={!modified() || saving()}
              loading={saving()}
              onClick={onSave}
            >
              {<TbDeviceFloppy />}
              {t("global.save")}
            </Button>
          </Tooltip>

          <Tooltip label={`${t("global.undo")} (Ctrl+Z)`} withArrow>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("global.undo")}
              onClick={undo}
            >
              <BiRegularUndo />
            </Button>
          </Tooltip>
          <Tooltip label={`${t("global.redo")} (Ctrl+Y)`} withArrow>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("global.redo")}
              onClick={redo}
            >
              <BiRegularRedo />
            </Button>
          </Tooltip>

          <div class="w-[1px] h-5 bg-accent mx-1" />
        </Show>

        <Tooltip label={`${t("global.copy")} (Ctrl+C)`} withArrow>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("global.copy")}
            onClick={copyToClipboard}
          >
            <TbCopy />
          </Button>
        </Tooltip>
        <Show when={canWrite()}>
          <Tooltip label={`${t("global.paste")} (Ctrl+V)`} withArrow>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("global.paste")}
              onClick={pasteFromClipboard}
            >
              <TbClipboardText />
            </Button>
          </Tooltip>
        </Show>

        <div class="w-[1px] h-5 bg-accent mx-1" />

        <Tooltip label={t("home.local_settings.editor_word_wrap")} withArrow>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("home.local_settings.editor_word_wrap")}
            onClick={toggleWordWrap}
            class={wordWrap() ? "text-primary" : undefined}
          >
            wordWrap() ? <TbTextWrap /> : <TbTextWrapDisabled />
          </Button>
        </Tooltip>

        <Tooltip label={t("home.local_settings.editor_minimap")} withArrow>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("home.local_settings.editor_minimap")}
            onClick={() => {
              setLocal("editor_minimap", String(!minimap()))
            }}
            class={minimap() ? "text-primary" : undefined}
          >
            minimap() ? <TbMap /> : <TbMapOff />
          </Button>
        </Tooltip>

        <div class="w-[1px] h-5 bg-accent mx-1" />

        <div class="hidden items-center sm:flex">
          <Tooltip
            label={`${t("global.decrease")} ${t("home.local_settings.editor_font_size")}`}
            withArrow
          >
            <Button
              aria-label={`${t("global.decrease")} ${t("home.local_settings.editor_font_size")}`}
              size="icon-sm"
              variant="ghost"
              class="rounded-r-none"
              onClick={() => changeFontSize(-1)}
            >
              <FaSolidMinus />
            </Button>
          </Tooltip>
          <Button
            size="sm"
            variant="ghost"
            class="rounded-none text-xs text-muted-foreground"
          >
            {local.editor_font_size}
          </Button>
          <Tooltip
            label={`${t("global.increase")} ${t("home.local_settings.editor_font_size")}`}
            withArrow
          >
            <Button
              aria-label={`${t("global.increase")} ${t("home.local_settings.editor_font_size")}`}
              size="icon-sm"
              variant="ghost"
              class="rounded-l-none"
              onClick={() => changeFontSize(1)}
            >
              <FaSolidPlus />
            </Button>
          </Tooltip>
        </div>

        <Show when={!isString}>
          <div class="w-28">
            <EncodingSelect
              encoding={encoding()}
              setEncoding={setEncoding}
              referenceText={props.data}
            />
          </div>
        </Show>
      </div>

      {/* Editor */}
      <MonacoEditorLoader
        value={text(encoding())}
        language={language()}
        path={objStore.obj.name}
        options={{
          theme: theme(),
          wordWrap: wordWrap() ? "on" : "off",
          minimap: { enabled: minimap() },
          readOnly: !canWrite(),
        }}
        onChange={(val) => setValue(val)}
        onEditorReady={onEditorReady}
      />

      {/* Status Bar */}
      <div class="flex shrink-0 items-center gap-x-3 border-t border-border bg-muted px-3 py-1 text-xs text-muted-foreground dark:bg-card">
        <Show when={language()}>
          <Popover placement="top-end" onClose={() => setLangSearch("")}>
            <PopoverTrigger
              as="div"
              class="cursor-pointer rounded-sm px-1 whitespace-nowrap hover:bg-accent"
            >
              <div class="flex flex-row items-center gap-x-1">
                <TbBraces size={13} />
                <div>{languageDisplayName()}</div>
              </div>
            </PopoverTrigger>
            <PopoverContent class="max-h-[350px] w-[280px] rounded-lg">
              <PopoverBody p="$2">
                <Input
                  class="mb-2 h-7 text-xs"
                  placeholder="Search language..."
                  value={langSearch()}
                  onInput={(e) => setLangSearch(e.currentTarget.value)}
                  autofocus
                />
                <div class="flex flex-col max-h-[280px] overflow-y-auto items-stretch gap-y-0">
                  <For each={filteredLanguages()}>
                    {(lang) => (
                      <div
                        class={cn(
                          "cursor-pointer rounded-sm px-2 py-1.5 text-xs",
                          language() === lang.id
                            ? "bg-primary/10"
                            : "bg-transparent hover:bg-accent",
                        )}
                        onClick={() => {
                          setLanguage(lang.id)
                          setLangSearch("")
                        }}
                      >
                        {lang.aliases?.[0] || lang.id}
                        <Show when={lang.aliases?.[0]}>
                          <span class="ml-1 text-[0.625rem] text-muted-foreground">
                            ({lang.id})
                          </span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </Show>
        <div class="flex-1" />
        <div style={{ "white-space": "nowrap" }}>
          Ln {cursorLine()}, Col {cursorColumn()}
        </div>
        <div style={{ "white-space": "nowrap" }}>{wordCount()} words</div>
        <Show when={modified()}>
          <div class="text-warning" style={{ "white-space": "nowrap" }}>
            ●
          </div>
        </Show>
      </div>
    </div>
  )
}

const TextEditor = () => {
  const [content] = useFetchText()
  return (
    <BoxWithFullScreen h="70vh">
      <MaybeLoading loading={content.loading}>
        <Editor
          data={content()?.content}
          contentType={content()?.contentType}
        />
      </MaybeLoading>
    </BoxWithFullScreen>
  )
}

export default TextEditor
