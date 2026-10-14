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

## Upcoming checkpoints

2. Velocity models, time-dependent sources, receivers and recordings.
3. Stencil inspector, sampling diagnostics, boundary comparisons and eight guided experiments.
4. Accessibility, performance measurements, regression and deployment verification.
