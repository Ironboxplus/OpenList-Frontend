// vi.mock factories shared by the manage-page tests (hoisted per test file:
//   vi.mock("~/hooks", async (orig) => (await import("./mocks")).hooksMock(await orig()))
import { vi } from "vitest"

/** What the pages see as `useRouter()`; tests set params / read `to`. */
export const router = {
  params: {} as Record<string, string>,
  searchParams: {} as Record<string, string>,
  pathname: () => "/@manage",
  to: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  pushHref: (s: string) => s,
  isShare: () => false,
  search: "",
  forward: vi.fn(),
  setSearchParams: vi.fn(),
}

export const resetRouter = () => {
  router.params = {}
  router.searchParams = {}
  router.to.mockClear()
  router.back.mockClear()
}

export const clipboard = { copy: vi.fn() }

export const hooksMock = (actual: Record<string, unknown>) => ({
  ...actual,
  useRouter: () => router,
  useUtil: () => ({ copy: clipboard.copy, paste: vi.fn() }),
})

export const notifyMock = () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    render: vi.fn(),
  },
})
