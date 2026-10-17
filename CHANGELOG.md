# Changes

## 1.3.0

Independent package `tide-watch-2`, based on the installed Tide Watch 1.2.1 build.

- Add preferred chart smoothing of 2–6 hours (default 3), with temporary graph override.
- Preserve default smoothing exactly and retain existing measurements, gaps and theme behavior.
- Add Tide Watch 2 icon, npm metadata, attribution and release documentation.
- Prevent stale history request failures from clearing a newer chart; clear unavailable charts and invalidate in-flight history after status failures.
- Correct a presentation typo.
- Preserve all four original engine/storage files unchanged from the installed baseline.
