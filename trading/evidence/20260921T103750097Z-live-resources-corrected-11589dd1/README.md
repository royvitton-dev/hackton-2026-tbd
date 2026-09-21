# Live CPU and memory reading

Measured 2026-09-21 around 19:37 KST for the existing demo's engine, Vite frontend and 12 bot processes. [resources.json](resources.json) contains raw CPU counters, process IDs, the 5.0148806-second interval and resident/private memory values.

Process CPU is `(after CPU seconds - before CPU seconds) / elapsed seconds / 16 logical processors * 100`. Start-time identity was checked between the two reads. The total was 0.3505% of host CPU capacity; engine 0.1947%, frontend 0.0195%, bots 0.1363%. Resident working-set sum was 1,012,199,424 bytes, including engine 56,119,296, frontend 105,914,368 and bots 850,165,760 bytes. Shared pages can be counted more than once in that sum. Browser and observation/helper processes were not included.

Windows' separately queried recent whole-host CPU counter was 15%; physical RAM was 16,880,881,664 bytes total and 5,089,628,160 bytes free. This host counter is not the same five-second process measurement interval. Private commit values are preserved separately and are not resident RAM.

These are live observations under the ongoing demo workload, not a benchmark, peak-resource guarantee or future usage forecast. The preceding zero-CPU summary is retained but superseded; its cause remains unproven, as explained in its README.
