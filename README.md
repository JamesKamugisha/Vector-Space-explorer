# Vector Space Explorer

An interactive linear algebra learning app with a shared Z-up Three.js workspace and two scenarios: Vector Math Lab and AI & LLM Lab.

Live app: https://vector-space-explorer-lac.vercel.app/

## Run locally

Requires Node.js 22.12 or newer (Node.js 24 recommended), npm, and a modern browser. WebGL powers the visualization; numeric results and worked steps remain available without it.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. Production commands:

```sh
npm run build
npm run preview
```

## Features

- Twelve math lessons: addition, scalar multiplication, linear combination, norm/normalization, span, independence, orthogonal projection, basis coordinates, dot/angle, cross product, Gram–Schmidt, and homogeneous systems.
- Editable Cartesian vectors, basis and matrix inputs, worked steps, cancellable playback, manual stepping, and presets.
- Orbit, zoom, pan, camera reset, full-screen workspace, axes, orientation gizmo, grid, upright labels, hover readouts, and optional unit sphere.
- Rank-dependent line/plane/origin geometry, projection residuals, and nullspace visualization.
- AI lab with eight local documents, documented keyword features, actual cosine/Euclidean scores, normalized display, count matrix, and source-based RAG simulation.
- Responsive layout, keyboard controls, focus-visible states, reduced-motion playback, and WebGL fallback.

## Mathematical and teaching conventions

Cartesian coordinates map directly to world XYZ with Z up. R³ is unbounded; the optional sphere has radius 1 and does not constrain vectors. Numeric inputs accept finite values within ±1,000,000. Invalid edits retain the last valid calculation and restore it on blur. Calculations retain floating-point precision internally; displayed values are rounded.

Rank decisions use a documented relative tolerance in `src/math/vector.ts`; nearly dependent inputs can produce a warning. Basis vectors are matrix columns. Homogeneous systems accept three-column matrices and visualize nullity zero through three.

AI coordinates are handcrafted teaching examples, not model embeddings. Query tokens are mapped into three disclosed feature counts; unsupported queries are not ranked. Normalizing the plot changes positions only: ranking continues to use original vectors. The count matrix is a separate representation of corpus text, explicitly distinguished from handcrafted coordinates. RAG answers extract retrieved source sentences without calling a language model.

Playback animates addition, scaling, normalization, and linear-combination geometry. Other lessons support highlighted worked steps with their computed geometry. PCA and real embedding integration are deferred.

## Verification

```sh
npm test
npm run typecheck
npm run test:e2e
```

Browser tests use installed Google Chrome through Playwright. If Chrome is unavailable, install its official Playwright-managed distribution with `npx playwright install chrome`. Browser tests start a local Vite server on port 5174 automatically when needed. To test a deployment, set `TEST_BASE_URL` to its URL before running the suite.

Tests verify numerical identities and edge cases, all lesson interactions, scenario changes, input/playback synchronization, AI ranking and source provenance, mobile overflow, reduced motion, and WebGL fallback. See `VERIFICATION.md` for the recorded delivery checks and practical limits.

For the synthetic 500-point scene profile, start the local development server on port 5174 and run `npm run profile:scene`. The test-only fixture is excluded from the production entry point. It records FPS/resource samples, checks orbit interaction and remount cleanup, and writes ignored artifacts locally. `PROFILE_BASE_URL` can override the local server address.

## Deploy through GitHub to Vercel

Repository: https://github.com/JamesKamugisha/Vector-Space-explorer

Import this repository in Vercel and select the Vite preset. The root `vercel.json` supplies the build command (`npm run build`) and output directory (`dist`). Use `npm ci` to install dependencies and Node.js 24. No environment variables or API keys are required. Set `main` as the production branch so subsequent pushes redeploy automatically.

`dist/`, installed packages, browser artifacts, credentials, and Vercel's local state are ignored by Git. Google Fonts is an optional external font request; system fallbacks keep the interface usable if that request fails.

## Structure

```text
src/App.tsx                app shell, controls, results, playback
src/styles.css             layout and visual design
src/math/vector.ts         pure numerical operations and solvers
src/lessons/operations.ts   lesson results and worked steps
src/scene/VectorScene.tsx   shared renderer and geometry lifecycle
src/ai/                    corpus, search, simulation and AI controls
tests/                     numerical and browser regression tests
docs/source/               local supplied specification and illustrations
```

The original PDF and developer ZIP are preserved in the local project folder. The extracted specification and three illustrations are kept locally in `docs/source/`. Source documents, planning files, and the checklist are excluded from the public repository.
