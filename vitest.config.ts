import { defineConfig } from "vitest/config"
import solidPlugin from "vite-plugin-solid"
import path from "path"

export default defineConfig({
  plugins: [solidPlugin() as any],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // node:test suites run via `pnpm test:node`
    exclude: ["**/node_modules/**", "**/*.test.js"],
    setupFiles: ["./src/test-setup.ts"],
    server: { deps: { inline: [/@hope-ui/] } },
    deps: {
      optimizer: {
        web: {
          include: ["solid-js", "@solidjs/router"],
        },
      },
    },
  },
})
