# Acoustic lab: numerical implementation and checkpoints

Run tests without installing dependencies: `node --test tests/lab.test.mjs`.
Serve this repository as static files (ES modules require HTTP). No computational server is used.

## Phase 1 — working numerical foundation

The 180 × 116 grid retains the original interactive Gaussian experiment. The solver, boundary mask, renderer, playback clock, and UI are separate ES modules in `assets/lab/`. Shared `site.js` now only updates the copyright year. Phase 1 adds physical coordinates, numerical time, Step, playback speed, and a labeled fixed/adaptive color scale.

Equation: `p_tt / v² = p_xx + p_zz + s`. Density is constant; velocity is in m/s, grid spacing in m, time in s, and scalar pressure amplitudes are arbitrary units. This is not a variable-density acoustic formulation or production seismic package.

Interior update without damping: `pNext = 2p - pPrev + v² dt² (Dxx p + Dzz p + s)`. Each spatial second derivative uses its own spacing. Array index is `z * nx + x` with z positive downward. Buffers rotate after each step. The outermost cells remain zero (Dirichlet), giving sign-reversed pressure reflection.

The sponge uses `p_tt + 2 sigma p_t = v² (Laplacian(p) + s)` with centered time derivatives:
`pNext = (2p - (1-sigma*dt)pPrev + v²dt²(Laplacian(p)+s)) / (1+sigma*dt)`.
Sigma increases quadratically over the edge zone. This is a damping approximation, not a PML; residual reflections remain. Compared with the old per-step multiplier, this damping has physical time units and remains consistent when dt changes.

A Gaussian pulse adds `g` to p and `g + 0.5 v²dt² Laplacian(g)` to the previous buffer, a second-order Taylor initialization for zero initial velocity. The original `pPrev = p` startup had a half-step timing error; the new startup is explicitly tested. Mid-run pulses are linear superpositions of new initial disturbances, not continuously reinjected forces.

Stability requires `vmax * dt * sqrt(1/dx² + 1/dz²) <= 1`. Invalid settings are rejected before stepping. Default dx=dz=10 m, dt=0.002 s, v=1500 m/s. A safety guard rejects nonfinite or unbounded values.

Physical time is exactly step count × dt. The animation clock accumulates elapsed wall time × playback speed; work is capped at 32 steps/frame. Long stalls are dropped, so playback may slow under load but physics and sample intervals never change. Hidden tabs do not accumulate catch-up work.

Fixed scaling keeps the chosen symmetric amplitude limit. Adaptive scaling uses max absolute wave amplitude with a 1e-12 floor. Both display their actual range in arbitrary units. Adaptive colors cannot be used to infer amplitude decay.

Verification: analytical polynomial Laplacian, unequal spacing, zero/constant-field behavior, buffer rotation, time, CFL rejection, second-order Gaussian startup, direct stencil calculation, radial symmetry, finite evolution, color limits, and frame-rate independence. Existing navigation/themes are untouched.

References: [Devito acoustic modeling tutorial](https://www.devitoproject.org/examples/seismic/tutorials/01_modelling.html) for the scalar acoustic equation, forcing and absorbing layers; [Stanford SEP Ricker discussion](https://sepwww.stanford.edu/data/media/public/docs/sep147/jon1/paper_html/node4.html).

## Verified checkpoints

1. `b472fa0` — modular foundation (9 tests).
2. `d1153c2` — physical models and recordings (15 tests).
3. `2ede845` — numerical education (19 tests).
4. Final polish and regression checkpoint (22 tests).

## Phase 2 — physical models and recordings

Five model generators implement homogeneous, horizontal two-layer, inclined-interface, and elliptical slow/fast anomaly cases. Anomalies use 0.65× and 1.5× background velocity. Interfaces change the local v² coefficient in the stated constant-density equation; they do not introduce density contrasts. Every model change constructs a fresh, validated solver and resets recording time.

Ricker forcing is `A (1-2q²) exp(-q²)` with `q=pi f0(t-tPeak)`, `tPeak=tStart+1.5/f0`. It begins at tStart (a negligible tail is truncated). A is source density in a.u./m² at a single grid cell, and injection is v²dt²s inside the update. This is a cell force, not a grid-independent continuum delta source; absolute amplitudes must not be compared across grid sizes as if the integrated source strength were fixed. Add Source schedules exactly one event. Gaussian amplitude and Ricker source density have different units, shown beside the input. Source locations snap to interior nodes.

Receivers sample the current field at t=0, then once after each numerical update. Drawing never samples. Configuring a receiver array or individual receiver restarts the run to maintain common sampling. Recordings are preallocated, capped at 5001 samples and 24 UI receivers (the reusable component accepts up to 32). The simulation pauses at the recording cap. CSV includes receiver ID, physical coordinates, dt and time for each amplitude. A shot gather uses receiver index horizontally and time downward; single-channel traces use time horizontally. Recording gain is adaptive and is explicitly labeled.

Tests added: model-cell assignment, true maximum-velocity CFL, normalized Ricker injection, source activation/reset, receiver counts/CSV, analytic standing-mode propagation at two velocities (absolute amplitude error <0.002), and measurable reflection/transmission at a two-layer interface. All 15 tests passed at this checkpoint. Browser check: changing to a layered Ricker source, adding 12 receivers, then Step yields exactly 0.002 s and two samples per channel, with no console errors.

## Phase 3 — guided learning and numerical inspection

Explore keeps numerical controls out of the initial view. Understand exposes the
five-point stencil and bandwidth diagnostics. Experiment also exposes spacing,
time step and boundary parameters. Eight presets reset all numerical/source
settings deterministically; each includes prediction, observation, explanation
and a further challenge. Playback is paused when loading a preset.

The inspector reproduces the actual damped update and Float32 source accumulation,
then compares its prediction with a real engine step. The Ricker bandwidth cutoff
is the upper frequency at 1% of peak spectral amplitude, not the dominant frequency.
Gaussian bandwidth is a conservative spatial-spectrum equivalent. Dispersion
estimates use the discrete stencil relation at three directions and minimum velocity;
they are sampling guidance, not a full heterogeneous error bound.

Validation: 19 automated numerical/regression tests pass. All eight presets load
and step in the browser; the inspector reports an exact Float32 match. No browser
console errors were observed.


## Phase 4 — validation, accessibility and performance

Configuration changes build a complete candidate solver, source and recorder before
replacing the current run. Rejected configurations preserve the previous simulation.
Receiver coordinates are validated and snap to grid nodes. Individual placement and
removal have keyboard alternatives. Native form controls, visible focus, reduced-motion
startup, labeled canvases and status messages supplement the visual experiment.
Canvas aspect ratio follows physical domain dimensions, including unequal spacing.
Source and receiver markers can be toggled independently. Velocity-only view hides
the pressure colorbar. Regular receiver arrays display physical x extents and spacing;
irregular arrays retain honest index spacing with explicit receiver coordinates.

Wavefield drawing is capped at 30 Hz, recording/UI refresh at 10 Hz. All numerical
steps still sample receivers exactly once. The source preview and sampling diagnostics
are cached for the applied setup. Animation stops on pagehide and resumes once on
back/forward restoration; hidden tabs do no computational work. The default grid
measured about 0.116 ms per solver step over 1000 steps after warmup in local Node.
This is an engine benchmark on the development machine, not a mobile/browser FPS
claim. No worker is needed for this bounded default workload; slower devices may
reduce playback speed without changing physical dt.

### Verification record

`node --test tests/lab.test.mjs`: **22 passed**. In addition to earlier tests:

- Invalid candidate runs preserve the original wavefield and samples.
- A 1200 m homogeneous path at 1500 m/s peaks at 0.796 s, within the specified
  ±0.03 s finite-pulse tolerance around 0.8 s. Identical paths through slow and fast
  ellipses peak at 1.045 s and 0.682 s, respectively.
- Every preset evolves finite fields and reproduces identical buffers on replay.

Browser checks: all eight presets load and step; play/pause/reset; three modes;
layered Ricker forcing; arrays and individual receiver addition/removal; individual
traces and gathers; exact inspector prediction; unstable time-step rejection;
unequal spacing; both site themes; desktop and 390 px mobile layout without horizontal
overflow. No console errors observed. Local integration check resolved 189 page/asset
links. Shared theme/navigation code and non-Lab page contents are unchanged.
Reduced-motion startup is implemented using the existing system preference; a real
assistive-technology audit and a physical mobile-device performance sweep remain
outside these checks.

### Architecture and extension

- `solver.js`, `boundaries.js`: standalone numerical state and spatial operator.
- `models.js`, `sources.js`: velocity construction and physical source definitions.
- `receivers.js`: preallocated sampled data and CSV export.
- `run.js`: validates and constructs complete replacement runs.
- `diagnostics.js`, `inspector.js`: sampling analysis and exact pointwise prediction.
- `renderer.js`, `clock.js`: display and wall-time scheduling, separate from physics.
- `controls.js`, `lab.js`, `lab.css`: accessible inputs, orchestration and local styles.
- `experiments.js`: deterministic guided setups and educational copy.

To add an experiment, add a unique ID, title, mode, setup overrides, objective,
prediction, observation, explanation and challenge to `experiments`. Set `receivers`
when the standard array is wanted. The dropdown and reset mechanism discover it
automatically; the preset regression test exercises it. Add focused physical tests
for any new model, source or numerical operator. Keep defaults explicit in `baseSetup`.

### Deliberate limits

This is a 2-D, constant-density, second-order educational simulator. It omits elasticity,
variable density, attenuation other than the edge sponge, PML, and inversion. The UI
uses a fixed 180 × 116 grid, at most 16 sources and 24 receivers, and a 5000-step run
limit. The damping zone has residual reflections. Ricker forcing is cell-normalized,
so changing spacing changes integrated source strength. Discontinuous interfaces
are represented on grid nodes. Dispersion diagnostics are local homogeneous-stencil
estimates, not heterogeneous error guarantees. No custom model editor, GPU backend
or unstable-mode demonstration is included; these were optional extensions.


## UX revision — October 2026

The current interface starts paused and follows Choose → Configure → Play/observe.
Mode buttons explain their purpose: Explore hides receivers, recordings and numerical
analysis; Understand reveals receivers, the shot gather and stencil; Experiment also
opens configuration and reveals numerical controls. Mode changes preserve the current
run. Loading a preset or applying configuration resets and pauses it.

Recording view selection was removed: the UI always shows a shot gather. Individual
receivers are removed by coordinate. Receivers now support one unique sensor per grid
node (20,880 on the default grid); a horizontal array supports all 180 columns, with
minimum spacing Δx. Edge nodes are permitted but record the fixed zero-pressure boundary.
Spacing controls follow the applied grid. Recording buffers hold at most two million
samples overall and at most 5001 per receiver; larger receiver sets shorten the run,
with the resulting capacity displayed in configuration. CSV retains all channels;
gathers wider than the canvas sample columns for display. These limits supersede the
original 24/32-receiver cap documented in the historical checkpoints above.

23 automated tests pass, including full-width arrays, sub-cell spacing rejection,
duplicate-cell rejection, and all-node recording allocation. Browser verification
covers mode visibility, the 180-receiver array, stepping and the removed selector.


## Simplicity pass

Experiment selection now loads immediately. Restart run repeats the applied setup;
Restore experiment defaults (inside Simulation setup) restores the selected preset.
The main transport contains only Play/Pause, Step once and Restart run. Repeating a
source remains an advanced action. Plot clicks move the source and restart, rather
than silently accumulating pulses. The inspector is collapsed until requested.

Form edits pause the run and show an unapplied-changes notice; run and receiver
mutation controls stay disabled until applying or restarting with saved settings.
Unused layer, source and sponge fields are hidden and excluded from validation.
Plot headings follow the selected quantity, amplitude controls disappear in velocity
view, and depth ticks are aligned at top/middle/bottom. Blank recordings show a
start instruction instead of an empty plot. Receiver row inputs reflect applied rows,
and their maximum count follows spacing. Inspector editing pauses playback and no
longer overwrites typed coordinates during redraw.

Validation: the 23 numerical tests remain green. Browser checks cover automatic
preset loading, pending/applied settings, velocity labels and colorbars, receiver
empty states, and exact stencil prediction (zero difference from stored Float32).

## Unified interface

The Lab now has one interface, with no Explore/Understand/Experiment classifications
or numerical-step inspector. The only guided presets are Propagation, Reflection &
Refraction, and Velocity Anomalies. Each starts with 12 receivers and exposes the
same recording panel and CSV export.

Configuration contains Physical setup, Source, Receivers, and Numerical settings,
in that order. Receiver row settings are part of the same pending configuration as
model and source settings; one Apply changes & restart button validates and applies
them together. Apply and Restore experiment defaults sit at the bottom. Individual
receiver placement and coordinate controls were removed. Plot clicks only relocate
the source and restart. The standalone inspector calculation remains covered by its
numerical regression test, but is no longer loaded or exposed by the interface.

Validation: 24 tests pass. Browser checks confirm recordings for all three presets,
the four configuration sections in order, and applying a 16-receiver row through the
combined form. No browser console errors were observed.
