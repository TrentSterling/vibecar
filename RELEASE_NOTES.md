# Release notes

## 2026-10-26: Wheels follow their travel

Wheels now retain their rolling phase instead of returning to a one-frame angle.
Forward and reverse rotation follow signed travel along each steered wheel's
direction and the current wheel radius. Phase wraps each tick and clears on car
reset. Suspension placement, steering axes, driving physics and the fixed 60 Hz
cadence are unchanged.

Simple six-spoke wheel faces make rotation readable. Their geometry stays in the
existing four tire meshes: 480 extra triangles, with no extra draw calls,
materials, geometry objects, textures or random draws.

## 2026-10-26: Consistent driving speed

Physics, steering, suspension, collision response and camera follow now advance
at the original 60 Hz cadence independently of display refresh. Higher-refresh
screens no longer accelerate the entire car simulation. Rendering presents the
latest resolved pose without adding an interpolation frame of latency.

Short frame gaps catch up by at most six ticks. Gaps over 250 ms and visibility
transitions discard elapsed-time debt, so returning to the game does not replay
a hidden backlog. Existing tuning, reset/flip behavior, force order, controls,
art and About content are preserved.
