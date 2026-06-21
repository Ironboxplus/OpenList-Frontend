import {
  HStack,
  Icon,
  Progress,
  ProgressIndicator,
  Skeleton,
  Text,
  Tooltip,
} from "@hope-ui/solid"
import { Show } from "solid-js"
import { BsHddFill } from "solid-icons/bs"
import { objStore, State } from "~/store"
import {
  nearlyFull,
  showDiskUsage,
  toReadableUsage,
  usedPercentage,
} from "~/utils"
import type { Plugin } from "../registry"

/**
 * Compact storage-usage indicator for the current directory's mount. Reads the
 * reactive `objStore.mountDetails`, which usePath keeps in sync on every
 * navigation (both the fs/get and fs/list paths) — so it updates live when you
 * enter/leave a storage and clears (hides) at the virtual storages-root instead
 * of showing the previous folder's data. The backend piggybacks the usage on the
 * list response (cache-backed + singleflight), so navigation costs no extra
 * request and cannot cause provider 429s under concurrent users.
 */
const DiskUsageWidget = () => {
  const details = () => objStore.mountDetails
  // The current mount's storage type, e.g. "BaiduNetdisk". driver_name is the
  // reliable source; the list endpoint's provider can be "unknown" — treat that
  // as no type.
  const storageType = () => {
    const t = details()?.driver_name ?? ""
    return t.toLowerCase() === "unknown" ? "" : t
  }
  const loading = () =>
    objStore.state === State.FetchingObj ||
    objStore.state === State.FetchingObjs
  const accent = () => (nearlyFull(details()!) ? "$danger9" : "$info9")

  return (
    <>
      {/* First load (no data yet): show a skeleton placeholder. Subsequent
          navigations keep the existing bar (dimmed) so it never flashes. */}
      <Show when={loading() && !showDiskUsage(details())}>
        <Skeleton
          height="26px"
          width="150px"
          css={{ borderRadius: "9999px" }}
          display={{ "@initial": "none", "@sm": "block" }}
        />
      </Show>
      <Show when={showDiskUsage(details())}>
        <Tooltip
          label={`${storageType() ? storageType() + " · " : ""}${toReadableUsage(
            details()!,
          )}`}
          placement="bottom"
          withArrow
        >
          <HStack
            class="header-disk-usage"
            spacing="$2"
            px="$2_5"
            py="$1"
            rounded="$full"
            bg="$neutral3"
            opacity={loading() ? 0.55 : 1}
            css={{
              transition: "opacity 0.2s ease, background-color 0.2s ease",
            }}
            _hover={{ bg: "$neutral4" }}
            display={{ "@initial": "none", "@sm": "flex" }}
          >
            <Icon as={BsHddFill} boxSize="14px" color={accent()} />
            <Show when={storageType()}>
              <Text
                fontSize="$xs"
                fontWeight="$semibold"
                color="$neutral12"
                css={{ whiteSpace: "nowrap" }}
                display={{ "@initial": "none", "@md": "block" }}
              >
                {storageType()}
              </Text>
            </Show>
            <Progress
              w="$20"
              trackColor="$neutral6"
              rounded="$full"
              size="sm"
              value={usedPercentage(details()!)}
            >
              <ProgressIndicator
                color={accent()}
                rounded="$full"
                css={{ transition: "width 0.5s ease" }}
              />
            </Progress>
            <Text
              fontSize="$xs"
              color="$neutral11"
              css={{ whiteSpace: "nowrap" }}
            >
              {toReadableUsage(details()!)}
            </Text>
          </HStack>
        </Tooltip>
      </Show>
    </>
  )
}

export const diskUsagePlugin: Plugin = {
  id: "builtin.disk-usage",
  name: "Disk Usage",
  contributions: [
    { slot: "header-right", component: DiskUsageWidget, order: -10 },
  ],
}
