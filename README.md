# Tide Watch 2

An offline Signal K tide instrument with depth history, display smoothing, and Day/Night/Red appearance. Published package name: **`tide-watch-2`**. Version **1.3.0** follows the installed Tide Watch 1.2.1 build.

Derived from **Joel Kozikowski’s [signalk-tide-watch](https://github.com/joelkoz/signalk-tide-watch)**, upstream commit `3436d24189441a484a3c9dbbab137ef657860f39`. Original tide calculations are unchanged. This release preserves the installed 1.2.1 `OriginalPlugin.js`, `TideAnalysis.js`, `DBDepthLog.js` and `LocationManager.js` byte for byte, including the existing compatibility fix for depth events without source metadata. See [NOTICE](NOTICE) and the historical [baseline notes](BASELINE-README.md).

## What changes in 1.3.0

- Select 2, 3, 4, 5 or 6 hours of **display smoothing**. The default remains 3 hours and exactly matches the installed curve calculation.
- Save **Preferred chart smoothing (hours)** in Plugin Config; the selector on the graph temporarily overrides it until the page reloads.
- A new Tide Watch 2 icon and Webapps display name.
- Fix history request handling: an older failed request cannot clear a newer successful chart. A status failure clears the chart and invalidates pending history results.
- Correct a display typo. Existing metre/feet controls, Day/Night/Red + Auto rules, raw measurement toggle, gap handling and future H/L labels stay as in the installed build.

The curve uses the existing 15-minute median, followed by a centered Gaussian window of the selected duration. Smoothing affects only the chart. It never changes recorded depths, turn detection, predictions, or Signal K values. Recent curve values may adjust as observations arrive. No external database or internet service is required at runtime.

## Install and preserve your history

This is a replacement for `signalk-tide-watch`, not a second running tide engine. The runtime plugin ID remains **`signalk-tide-watch`** so the configuration, data directory and API routes can remain compatible. Do not enable both packages together.

1. Back up your Signal K configuration and Tide Watch plugin data directory. Preserve the installed 1.2.1 plugin folder or tarball for rollback.
2. Stop Signal K. In its installation directory (usually `~/.signalk`), remove the old package and install this release:

   ```sh
   npm uninstall signalk-tide-watch
   npm install /absolute/path/tide-watch-2-1.3.0.tgz
   ```

   After publication, the second command can be `npm install tide-watch-2@1.3.0`.
3. Start Signal K. Confirm the existing depth path/source filters and sampling settings, then open **Tide Watch 2** from Webapps. Confirm existing binary history replays before leaving the new build running.
4. Choose your preferred chart smoothing in Plugin Config. The graph selector is a temporary override.

For containers, run package commands inside the Signal K container’s installation directory and preserve its persistent data volume. This release has been locally tested; installation aboard TBD is not claimed.

To roll back, stop Signal K, uninstall `tide-watch-2`, and reinstall your saved 1.2.1 build. Restore the configuration/data backup if needed, then restart. Neither installation should delete your backups.

## Original behavior

Original moving-average sampling, directional-count confirmation, engine/position gating, binary history and replay, 12-hour-25-minute repeating prediction, cosine height estimate, and phase/time/height publications remain intact. The wrapper copies observations for presentation only. Depth reference and original estimated height offsets do not establish chart datum. The original prediction has no calibrated timing allowance.

## Development

Node 18 or later. Run `npm ci` and `npm test`. The suite checks original analyzer/publication parity, binary recording/replay, source handling, API behavior, preferred and temporary display settings, themes, default-curve equivalence, adjustable smoothing, gaps, and history request races. See [validation notes](docs/VALIDATION.md).

ISC license. Original author: Joel Kozikowski. Display and packaging changes: SCarns.
