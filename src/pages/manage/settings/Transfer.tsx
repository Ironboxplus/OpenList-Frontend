import { Button } from "~/components/ui/button"
import { DataState } from "~/components/ui/data-state"
import { ConnectionsPerFile } from "~/features/settings/ConnectionsPerFile"
import {
  createDeleteConfirm,
  createSettingsGroup,
  SettingsCards,
  SettingsForm,
  SettingsSection,
} from "~/features/settings/form"
import { TRANSFER_CARDS } from "~/features/settings/layouts"
import { SyncBandwidthForm } from "~/features/transfers/BandwidthPopover"
import { useManageTitle, useRouter, useT } from "~/hooks"
import { Group } from "~/types"

/**
 * Transfer settings (PLAN_FE_SYSTEM_UX_1127 §0.2 设置归位): the task
 * threads and speed limits (the Traffic group, saved with the page bar), the
 * sync bandwidth (applied at once, not saved) and each storage's connections
 * per file (read-only here, changed in the storage). Every card says what it
 * governs.
 */
const Transfer = () => {
  const t = useT()
  const { searchParams } = useRouter()
  useManageTitle("settings.items.transfers.title")
  const g = createSettingsGroup(Group.TRAFFIC)
  g.load()
  g.readDefaults()
  const removal = createDeleteConfirm<string>({
    name: (key) => t(`settings.${key}`),
    run: g.remove,
  })
  const focus = () => {
    const f = searchParams.focus
    return Array.isArray(f) ? f[0] : f
  }
  return (
    <>
      <SettingsForm
        dirty={g.dirty()}
        saving={g.saving()}
        resetting={g.loading()}
        onSave={g.save}
        onReset={g.load}
        extra={
          <Button
            type="button"
            variant="secondary"
            disabled={g.loading() || g.saving()}
            onClick={g.loadDefaults}
          >
            {t("settings.form.load_default")}
          </Button>
        }
      >
        <DataState
          loading={g.loading()}
          error={g.error()}
          empty={g.settings.length === 0}
          onRetry={g.load}
        >
          <SettingsCards
            group={g}
            cards={TRANSFER_CARDS}
            focus={focus()}
            onDelete={removal.ask}
          />
        </DataState>
        <SettingsSection
          id="card-sync-bandwidth"
          card="sync-bandwidth"
          title={t("settings.layout.sync_bandwidth")}
          description={t("settings.layout.sync_bandwidth_scope")}
        >
          <div class="py-3">
            <SyncBandwidthForm />
          </div>
        </SettingsSection>
        <ConnectionsPerFile />
      </SettingsForm>
      {removal.dialog()}
    </>
  )
}

export default Transfer
