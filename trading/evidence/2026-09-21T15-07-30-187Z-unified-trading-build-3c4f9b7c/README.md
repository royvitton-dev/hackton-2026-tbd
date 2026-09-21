# Trading step of the unified production build

**One production Vite build completed with exit 0.** This runs only the trading-app step used by the current `scripts/build-unified.mjs`, with the requested fresh evidence output directory and without `--emptyOutDir`. It does **not** establish that the whole integrated Park build or runtime works.

Actual execution: **2026-09-21T15:08:08.974Z–15:08:13.331Z** (2026-09-22 00:08:08.974–00:08:13.331 KST). Node **24.19.0**, root Vite **7.3.6**; frontend-installed Vite is also 7.3.6. The build child PID was **8088**, and its `close` event recorded code 0, signal null, no spawn error. Vite reported **built in 3.24s**.

## Exact scope and command

Working directory: `C:\project\hackton-2026-tbd\trading\frontend`.

```text
C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
  C:\project\hackton-2026-tbd\node_modules\vite\bin\vite.js
  build
  --config C:\project\hackton-2026-tbd\trading\frontend\vite.config.ts
  --base /trading/
  --outDir C:\project\hackton-2026-tbd\trading\evidence\2026-09-21T15-07-30-187Z-unified-trading-build-3c4f9b7c\dist
```

The executable and arguments were passed as a structured spawn argument array, recorded in [command.json](command.json). Environment inheritance matches the unified script; no values were overridden. The output path was required not to exist before execution. The run's exclusive `one-build-attempt.json` guard prevents a second invocation of [build-once.mjs](build-once.mjs) in this same run.

No dependency installation, TypeScript `tsc`, tests, other-app/Next build, browser, HTTP request, service start/restart, deployment, or Git action was performed. No engine process or pinned market data was touched. The release engine file was only hashed as part of the input guard.

## Original results and outputs

- [result.json](result.json), [build-tool-result.json](build-tool-result.json).
- [Raw stdout](build.stdout.log), [raw stderr](build.stderr.log), [combined log](build.combined.log).
- [Full 130-file artifact manifest](artifacts.sha256.json), including byte sizes, absolute output paths and SHA-256 values.
- [Input hashes before](inputs.before.sha256.json) and [after](inputs.after.sha256.json): **all 40 tracked input/absence records match**, including frontend sources/configuration, root package/lock, frontend package/pnpm lock, unified recipe, and engine source/config/release binary. An absent frontend `package-lock.json` remains absent. Existing dotenv paths are recorded only by existence/hash, without exposing their contents.

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| [dist/index.html](dist/index.html) | 736 | `21827fda36a5e2249c1c801d80efb7cff1f4d6bc13726a965527f99c8785849b` |
| [dist/assets/index-Dv25fCt5.js](dist/assets/index-Dv25fCt5.js) | 262342 | `3d7dbc7aeb06c9156a69d5d39ab8a1dd4e3f5e50d224c4584460f427c14b5899` |
| [dist/assets/index-Bg9Ea7Dj.css](dist/assets/index-Bg9Ea7Dj.css) | 120979 | `9ebe52b02b299a94825fa1f773778524185cf96261ebd9406372f842bf107dfc` |

The HTML was read and contains `/trading/favicon.svg`, `/trading/assets/index-Dv25fCt5.js`, and `/trading/assets/index-Bg9Ea7Dj.css`. Broader asset-reference and bundled-endpoint validation is delegated to the parent's separate static check; it is not claimed here.

The only stderr text is Vite's expected notice that the evidence outDir is outside its frontend project root and **will not be emptied**. The output is still inside `trading/evidence`; this is not a build failure and `--emptyOutDir` was intentionally not added.

Key unchanged inputs:

| Input | SHA-256 before = after |
| --- | --- |
| Root `package-lock.json` | `fde62f344e4c8e721e69994dfdc45c88a7780a7cea6dd775849c195d7e79138a` |
| Frontend `pnpm-lock.yaml` | `69df213806b73d0fe57d0a7a6cb548e1d02e4b12f86509a5ab9f52f3d4aa7d49` |
| Frontend `vite.config.ts` | `9c7b4c743dd190086c60a321df044477aca19600465e0c75213823d04537cf48` |
| Frontend `src/api.ts` | `a72116e8ddcc3ef1d3fe019217d3915d3c0ac73202802be8f74e6245a44d6147` |
| `scripts/build-unified.mjs` | `e6837b605c5e323184894d2e84c9bd6964ced0fcf1e0b8fffc65ddf602aae071` |
