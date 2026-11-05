# Vector Space Explorer Delivery Verification

Verified November 5, 2026, on Windows with Node.js 24, npm 11, and installed Google Chrome through Playwright.

## Passing checks

- Production build and strict TypeScript check.
- ESLint, Prettier formatting check, and production dependency audit (zero vulnerabilities reported).
- 28 numerical and AI unit tests: vector identities, magnitude-independent rank, basis reconstruction and singular handling, Gram–Schmidt orthonormality, nullspace equations, angles, metric ordering, unknown queries, and RAG provenance.
- 12 browser tests: automated accessibility for Math and AI, all math lessons, live inputs, overlays, source fixtures, playback cancellation, manual steps, AI metric switching and RAG, scenario lifecycle, mobile overflow/help, reduced motion/WebGL fallback, camera orbit/reset, resource stability, and mobile canvas sizing.
- Desktop and 390px mobile screenshots reviewed; text contrast improved, input/results typography increased, duplicate scene UI removed, and hidden skip-link positioning corrected.

## Defects caught during implementation

- Stale animation frame could restore old playback progress after editing inputs: fixed with generation-based cancellation.
- OrbitControls damping could move the camera after Reset View: fixed by clearing accumulated deltas before restoring the canonical pose.
- Nearly parallel Gram–Schmidt inputs could lose orthogonality: fixed and covered by numerical regression.
- Unsupported AI queries could look like ranked results: ranking/retrieval now disabled until recognized features exist.
- Mobile help icon lost its accessible name: explicit label added.
- Low contrast helper text and mismatched accessible names: corrected; no accessibility rules disabled.

## Observed scene behavior

At a 1440×1100 automated Chrome viewport, the resource test returned to 53 geometries and 0 textures after repeated lesson and scenario changes. The sampled frame rate across local runs was approximately 50–61 FPS. Orbit visibly changed the scene; reset restored the camera exactly, with approximately 0.184% screenshot pixel variation after settling. Numeric results stayed unchanged during camera movement.

These measurements describe the local test environment. They do not establish performance on every device or prove that every possible WebGL resource leak is absent.

The separate seeded 500-point profile used automated Chrome 156 on this Windows host, 1440×900 viewport, DPR 1. Three steady samples were 60 FPS; remount samples were 60–61 FPS. Geometry count remained 58, textures remained 0, camera orbit was verified, no page errors occurred, and no canvases remained after cleanup. Reproduce with `npm run profile:scene` against the local test fixture.

## Scope and remaining checks

The delivered demo includes 12 mathematical operations and the deterministic AI lab. Step highlighting works across lessons; animated geometry is implemented for addition, scaling, normalization, and linear combination. Projection onto a plane, PCA education, real embeddings, and live LLM generation are deferred. Broad physical-device testing remains. Automated accessibility checks supplement manual keyboard/mobile review and do not constitute a complete accessibility certification.

The app was deployed from GitHub to https://vector-space-explorer-lac.vercel.app/. The initial source commit passed remote Linux CI: https://github.com/JamesKamugisha/Vector-Space-explorer/actions/runs/42125685154. All 12 browser checks also passed against the live production URL, including accessibility, mathematical fixtures, AI retrieval, mobile layout, fallback behavior, camera reset, and resource stability.
