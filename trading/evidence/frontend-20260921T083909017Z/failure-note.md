# Verification harness failure

The first run after adding formatting validation stopped before checking the process exit code because Windows PowerShell treated pnpm's ordinary script-banner stderr as a terminating `NativeCommandError` under `ErrorActionPreference=Stop`. This was a harness problem, not a reported formatting failure. The error output is preserved in the task tool history; the environment file shows this attempt's run ID.

The harness now captures stdout/stderr, checks each native process exit code explicitly, and converts stderr ErrorRecord wrappers to text before logging. Subsequent full verification `frontend-20260921T083928261Z` passed formatting, all six protocol tests, TypeScript, and Vite. Final log-format-only harness verification `frontend-20260921T083951463Z` used `-SkipBuild` and passed formatting plus all six protocol tests. No earlier failure evidence was deleted or overwritten.
