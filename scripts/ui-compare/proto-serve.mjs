// Serves the built viewer prototype (design/viewer-proto/dist) and passes the
// API and file links through to the real OpenList, as its vite config does in
// development. No dependencies: a cached build runs without node_modules.
// usage: node proto-serve.mjs <dist> <port> [backend]
import fs from "node:fs"
import http from "node:http"
import path from "node:path"

const [dist, port = "4173", backend = "http://127.0.0.1:5244"] = process.argv.slice(2)
const root = path.resolve(dist)
const up = new URL(backend)

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json",
}
// as the app's dev server: movi streams through SharedArrayBuffer when the
// page is cross-origin isolated
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
}

// The prototype reaches the backend only through these: the API, and the file
// links it builds or gets back (raw_url and thumbnails are /d or /p links).
// Every other path is the page, so any folder can be typed into the address
// bar, except one under a top-level folder named "api", "d" or "p".
const proxied = (url) => /^\/(api|d|p)\//.test(url)

http
  .createServer((req, res) => {
    if (proxied(req.url)) {
      // the Host header is kept: the links the backend builds come back here
      const p = http.request(
        {
          host: up.hostname,
          port: up.port,
          method: req.method,
          path: req.url,
          headers: req.headers,
        },
        (r) => {
          res.writeHead(r.statusCode ?? 502, r.headers)
          r.pipe(res)
        },
      )
      p.on("error", () => {
        res.writeHead(502)
        res.end()
      })
      req.pipe(p)
      return
    }
    const clean = decodeURIComponent(req.url.split("?")[0])
    let file = path.join(root, clean)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(root, "index.html") // the app's routes are paths
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
      ...isolation,
    })
    fs.createReadStream(file).pipe(res)
  })
  .listen(Number(port), "127.0.0.1", () =>
    console.log(`[proto] http://127.0.0.1:${port} -> ${dist}, backend ${backend}`),
  )
