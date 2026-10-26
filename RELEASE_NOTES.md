# Release notes

## 2026-10-26: Consistent driving speed

Physics, steering, suspension, collision response and camera follow now advance
at the original 60 Hz cadence independently of display refresh. Higher-refresh
screens no longer accelerate the entire car simulation. Rendering presents the
latest resolved pose without adding an interpolation frame of latency.

Short frame gaps catch up by at most six ticks. Gaps over 250 ms and visibility
transitions discard elapsed-time debt, so returning to the game does not replay
a hidden backlog. Existing tuning, reset/flip behavior, force order, controls,
art and About content are preserved.
