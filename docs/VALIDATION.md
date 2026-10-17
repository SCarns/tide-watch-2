# Tide Watch 2 1.3.0 validation

Source baseline: the user's installed Tide Watch 1.2.1 folder, copied from TBD
on 2026-10-17. The current webapp files were also read directly from the server.

- All 21 tests pass locally on Node 24.
- OriginalPlugin.js, TideAnalysis.js, DBDepthLog.js and LocationManager.js are
  byte-identical to the installed 1.2.1 source. The original input compatibility
  fix is retained as-is.
- Existing baseline tests compare wrapped and original analyzer state and Signal K
  publications and verify binary recording/replay and source-filter compatibility.
  Publication parity also holds with the new smoothing preference set to 6 hours.
- The three-hour curve exactly matches the installed calculation. Adjustable
  smoothing retains raw observations and never crosses gaps or explicit breaks.
- Preferred smoothing initializes the page once; a temporary graph selection
  survives refresh without changing the saved preference.
- Existing Day/Night/Red and Auto tests pass without changes to theme behavior.
- Request-order tests reproduce an older failed history request after a newer
  successful result, and a status failure while history is in flight.
- Browser checks use synthetic data and verify the smoothing selector and chart.
  They do not establish tidal forecast skill or represent onboard deployment.

Before publication/aboard acceptance, confirm the new icon on Signal K's Webapps
page, existing configuration/history continuity after replacing the old package,
and several hours of normal recording. Preserve the original 1.2.1 folder and a
configuration/data backup for rollback. Tidal field validation remains separate.
