# argtrail

Next.js app with a standalone Windows build (WebView2, no Electron).

## Dev

```bash
pnpm install
pnpm dev
```

## Build (web)

```bash
pnpm build
```

Static export outputs to `out/`.

## Standalone (Windows)

Build the launcher:

```bash
cd appwin
cargo build --release
```

Run `argtrail.exe` next to the `out/` folder.

Requires WebView2 runtime.
