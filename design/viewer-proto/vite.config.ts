// The viewer prototype. It is built from this directory (root below) with the
// repository's own toolchain and src/ through the `~` alias, so the components,
// tokens, API wrappers and the movi player are the real ones. The release build
// (../../vite.config.ts) starts from ../../index.html and never reaches here.
import path from "path"
import { defineConfig } from "vite"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"

const repo = path.resolve(__dirname, "../..")

// The real OpenList (the CI container of .github/workflows/viewer-proto.yml).
// The Host header is kept, so the links the backend builds (raw_url, thumb)
// point back at this server and go through the same proxy.
const backend = {
  target: process.env.PROTO_API || "http://127.0.0.1:5244",
  changeOrigin: false,
}
const proxy = { "/api": backend, "^/d/": backend, "^/p/": backend }
// As the app's dev server: movi streams through SharedArrayBuffer when the
// page is cross-origin isolated.
const headers = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
}

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "~": path.join(repo, "src"),
      "solid-icons": path.join(repo, "node_modules/solid-icons"),
    },
  },
  plugins: [solidPlugin(), tailwindcss()],
  worker: { format: "es" },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: true },
  server: { headers, proxy, fs: { allow: [repo] } },
  preview: { headers, proxy },
})
