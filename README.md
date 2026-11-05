# argtrail

Next.js app. Standalone Windows build uses WebView2 (no Electron).

## Run (web, any OS)

Requires Node.js + pnpm.

```bash
git clone https://github.com/JovianOps/argtrail
cd argtrail
pnpm install
pnpm dev
```

## Build (web)

```bash
pnpm build
```

Static export: `out/`

## Windows standalone

1. Build web: `pnpm build`
2. Build launcher:
   ```bash
   cd appwin
   cargo build --release
   ```
3. Place `appwin/target/release/argtrail-win.exe` next to `out/` and run it.

Requires WebView2 (usually preinstalled on Windows 10/11).
