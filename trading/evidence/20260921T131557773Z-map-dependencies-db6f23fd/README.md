# Map font dependency installation repair

User reported unresolved @fontsource-variable/dm-sans at map/src/main.js:1. Both that font and noto-sans-kr5.3.0 were already declared and locked, but map/node_modules contained only Vite caches. Those caches were copied to local ignored bin/ before installation.

Installed156 packages from the existing lock using pinned npm11.6.0 via the bundled pnpm executable. No install scripts ran. package.json/package-lock.json/src/main.js hashes stayed identical; map has no source diff. First shell npm invocation was unavailable and a pnpm attempt used unsupported flags; subsequent environment configuration succeeded. All attempts/results are preserved.

Existing user-started Park PID19312 serves map5290. Entry module and both font CSS URLs returnedHTTP200 without the import error. Actual CUA browser rendered ATLAS, MapLibre/OpenStreetMap and42 catalog entries; AX and screenshot saved. Temporary browser tab closed. No Park/market service was restarted and no source/application commit was required for this local dependency repair.
