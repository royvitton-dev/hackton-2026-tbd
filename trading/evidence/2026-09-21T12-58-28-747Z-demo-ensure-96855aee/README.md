# Final ensure test extension

`node --test scripts/demo-ensure.test.mjs` passed 6/6, exit 0. This adds an actual copied-entrypoint test in an isolated unprepared tree: `ensure` returns `SETUP_REQUIRED`, gives manual Cargo/pnpm setup commands, and creates no market manifest, engine/UI/bot service or evidence run. The launcher lock is released. `unprepared-ensure.stderr.log` contains the exact JSON error.

The five earlier decision/lock cases remain included. `concurrency.json` records two actual Node workers exercising one lock with a simulated start callback; it is not a new 12-bot market start. `test-output.txt` preserves the executed tool output (exec chunk826b27, exit0); no rerun was needed to save the output.

Full restoration/limits and actual concurrent healthy-demo reuse are in `../2026-09-21T12-55-42-685Z-demo-ensure-0b592a61/README.md`. Existing lifecycle regression output is in `../2026-09-21T12-56-14-728Z-demo-lifecycle-147a1d3c/test-output.txt`. Source files were frozen after this test; source hashes accompany this report. No Git or shared documentation changes were made.
