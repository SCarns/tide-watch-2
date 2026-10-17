# Tide Watch 1.2.1 — original analysis, updated display

This independent test build restores Joel Kozikowski's original Tide Watch
analysis and processing from upstream commit `3436d24189441a484a3c9dbbab137ef657860f39`.
It is not an upstream publication. ISC license; original authorship retained.

## Original behavior restored

The original `OriginalPlugin.js`, `TideAnalysis.js`, `DBDepthLog.js` and
`LocationManager.js` are retained from upstream, with one input compatibility
patch: depth events without source metadata are accepted when Type/Talker filters
are blank, and safely rejected when they cannot satisfy an explicit filter.
Any configured depth path can supply readings; the original tide calculations
remain unchanged. This restores:

- The original moving average of soundings, five-minute default recording,
  approximately 30-minute depth comparison, and directional-count confirmation.
- The original 12-hour-25-minute repeating prediction and cosine height estimate.
- Original phase/time/height Signal K publications, in their original SI conventions.
- Original engine gating, position handling, `.dat` binary recording and replay.

Display unit selection never changes measurements, analysis or publications.
Original height outputs are restored, including the original estimated offset;
this does not establish a chart datum or calibrated forecast accuracy.

The previous experimental builds and their JSON-line histories remain intact.
1.2.1 reads original binary histories, not the experimental JSON-line records.
It may initially need to collect fresh observations. Existing configured sampling
intervals remain in effect; the restored five-minute default applies to new settings.
Old custom trend-window/minimum-change settings are unused by this original engine.
History separation and input/pause guards introduced by the custom engine are not
part of the restored baseline. This is a comparison build, not a validated forecast.

## Updated interface

- Preferred Metres/Feet setting, with a temporary page dropdown.
- More contrast between background and cards.
- Automatic appearance from `environment.mode`: night plus navigation.state anchored/moored uses dark; night with any other
  nonempty navigation state uses red. Missing navigation state stays dark at night.
  Day, absent or unrecognized environment.mode uses light. The appearance button
  cycles Day/Night/Red with a page-local override; Auto resumes automatic.
- Offline 24-hour, 3-day, 7-day and 30-day history views.
- Main curve: 15-minute median followed by a centered 3-hour Gaussian window
  (45-minute standard deviation, truncated at 90 minutes on either side).
- Show measurements reveals original aggregated records, isolated samples and
  original detected high/low markers. Smoothed view omits isolated sample dots.
- Gaps and analysis resets interrupt the curve; smoothing never crosses them.
  Edge estimates use available records and may change as new records arrive.
- Original next-turn timing is displayed without claiming a calibrated uncertainty
  band. Future depth is not drawn. Times use the viewing device's local timezone.
- Optional depth source ID filter complements original Type/Talker selection.

`index.js` is a UI adapter around the original plugin. It copies samples and turns
for the display during live recording and replay; it never feeds smoothed data into
analysis. Original publications are untouched. All five dependencies are bundled
for installation without npm fetching them.

## Validation

`npm test` compares wrapped and original analyzer status and phase events on a
72-hour synthetic tidal signal; checks original Signal K output parity, binary
recording/replay, API responses, display preferences and themes, and graph behavior.
It also verifies smoothing suppresses short oscillations without rewriting samples.
Live testing on the boat and Graham's Cerbo GX is still needed.
