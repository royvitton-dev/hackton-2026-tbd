# Protected-process precondition failure

This first wrapper invocation exited 1 before the harness created a run directory, copied/spawned an isolated engine, or sent an HTTP test request. It is not a failed or successful in-flight dedup scenario. The CLI and actual stderr are preserved in `run.json` and `output.log`.

The harness source at this attempt was SHA-256 `c33e74e5e17163f7290aaa0e165d9db850bbe76e8f8e0854488f5be2b0101e9d`. It required all 14 manifest processes and the explicitly supplied observer to be alive. A read-only PowerShell follow-up found the manifest's frontend PID 17556 absent; engine 20540, all 12 bot PIDs and observer 18184 remained present with their original 19:05 start times. The manifest SHA was unchanged (`6128d45f26f574eb1da12ec1b164c2112c4ed3e4e29bb6a5526568563578e69a`). See `protected-process-readonly-check.json`.

No process-control action was taken on the ordinary demo or observer. The parent was notified before any further execution. The absent frontend's cause is not established by this evidence.
