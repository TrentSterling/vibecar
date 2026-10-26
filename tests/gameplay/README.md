# Driving cadence regression gate

Run `node tests/gameplay/browser.cjs` with the pinned Playwright/Chrome tooling
installed by the existing workflow. It compares 30, 60, 90, 120 and 144 Hz callback
timelines in fresh browser contexts. Set `VIBECAR_LIVE_URL` for the deployed page.

The original module is loaded unchanged. A debugger breakpoint at its unique
initialization line exposes existing scene references only in the owned test
browser. Tests invoke scene controls and functions directly, without pointer or
keyboard events, focus changes or audio actions. The exact declared GA4 script
URL is excluded from these seeded fixtures because analytics consumes random
draws asynchronously. The original full-page About gate remains unchanged.

The real pinned Three.js, Cannon.js and OrbitControls run throughout. GPU draws
are sampled at checkpoints while scene/camera matrices update on each callback;
final native renders, finite bodies and actual dynamic contacts are required.
This is controlled-clock scene qualification, not native display/input testing.

Twelve driving segments cover settling, throttle, left/right steering, braking
and reverse, handbrake, coasting, reset, tuning/reset defaults, manual flip and
collision with a movable object. Full bodies including queued forces/torques,
wheel poses, camera/target, clouds, controls, tuning, timers and RNG must match
the 60 Hz reference. Additional checks cover moderate/long gaps, hidden/resume,
render purity and a reset with partial accumulated time. There are 100 checks
across the five cadences. The release was also independently compared against
public baseline `4edbb5afe2d90e31785ee01d64c678adedf7710e` at every simulation tick.

The runtime preserves the original integration-before-force order, reset
behavior, cold zero-delta update and 60 Hz camera response. It draws the latest
resolved pose without interpolation latency. A callback catches up at most six
ticks; gaps over 250 ms and visibility transitions discard elapsed debt.
