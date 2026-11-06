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

- Thirteen math lessons: addition, scalar multiplication, linear combination, norm/normalization, span, independence, line and plane projection, basis coordinates, dot/angle, cross product, Gram–Schmidt, and homogeneous systems.
- Editable Cartesian vectors, basis and matrix inputs, worked steps, cancellable playback, manual stepping, and presets.
- Orbit, zoom, pan, camera reset, full-screen workspace, axes, orientation gizmo, grid, upright labels, hover readouts, optional unit sphere, magnitude shells, and XZ/YZ reference planes.
- Rank-dependent line/plane/origin geometry, projection residuals, and nullspace visualization.
- AI lab with an 8–500 point setter, quick presets and +25 control; deterministic synthetic expansion, computed cosine/Euclidean scores, normalized display, actual count-vector plotting, a count matrix, and source-based RAG simulation.
- Computed synthetic 4D-to-3D PCA with original-space versus projected scores, explained variance, and a deliberately constructed vector analogy experiment.
- Real-model mode: 384-dimensional MiniLM sentence embeddings, a seeded 3D UMAP view of up to 500 authored sample passages across six topics, full-dimensional semantic retrieval, and on-demand local FLAN-T5 generation from retrieved context.
- Contextual right-hand instructions sidebar, collapsible mobile controls, keyboard vector inspection, focus-visible states, reduced-motion playback, and WebGL fallback.

## Mathematical and teaching conventions

Cartesian coordinates map directly to world XYZ with Z up. R³ is unbounded; the optional sphere has radius 1 and does not constrain vectors. Numeric inputs accept finite values within ±1,000,000. Invalid edits retain the last valid calculation and restore it on blur. Calculations retain floating-point precision internally; displayed values are rounded.

Rank decisions use a documented relative tolerance in `src/math/vector.ts`; nearly dependent inputs can produce a warning. Basis vectors are matrix columns. Homogeneous systems accept three-column matrices and visualize nullity zero through three.

Teaching vectors mode uses handcrafted examples, not model embeddings. Query tokens map into three disclosed feature counts; unsupported queries are not ranked. Normalizing that plot changes positions only: ranking continues to use original vectors. Count vectors mode plots the count matrix's actual document keyword counts. Its RAG simulation extracts retrieved source sentences without calling a language model. These deterministic modes remain separate from Real embeddings mode.

Playback animates addition, scaling, normalization, linear combinations, basis reconstruction, and Gram–Schmidt subtraction/normalization. Other lessons support highlighted worked steps with their computed geometry. The PCA lesson fits principal components to eight synthetic 4D points and keeps original-dimensional scores separate from projected values.

## Real embeddings and local generation

Choose **AI & LLM Lab → Real embeddings**. The app loads [MiniLM](https://huggingface.co/Xenova/all-MiniLM-L6-v2) in a browser worker and computes actual 384-dimensional, mean-pooled, normalized sentence embeddings. Its corpus contains 500 authored sample text passages built from subject facts and practical contexts across Cats, Dogs, Cars, Faces, Chairs, and Birds. These are text passages, not image embeddings or an imported training dataset. Topic colors are supplied labels, not model predictions.

Set **Number of points** from 8 to 500, apply the numeric field with Enter or blur, or use a preset or **+25 points**. The count controls the corpus prefix encoded and projected. A seeded, unsupervised UMAP calculation creates the 3D map from the original embeddings; topic labels do not determine positions. Recomputing a different corpus size can move existing points. The projection is approximate: visible distances, angles, and apparent cluster separation need not match the original space.

Enter a natural-language query, choose a topic preset if useful, then press **Search by meaning** or Enter. The query uses the same sentence model, and retrieval ranks cosine similarity in all 384 dimensions. Displayed source distances also come from the original embeddings. Editing the query does not run inference on every keystroke; search again to refresh results. Click a result or point to inspect the actual passage.

**Generate answer from sources** lazily downloads [FLAN-T5 small](https://huggingface.co/Xenova/flan-t5-small) and runs actual text generation on the device. The prompt supplies context from the top three retrieved passages. The source buttons identify the context supplied to the model; they are not proof that the model faithfully used or cited every passage. This compact model can omit information or produce an incorrect answer. Inspect the original snippets before relying on its response. The deterministic teaching-mode RAG simulation remains explicitly labeled as a simulation.

Both trained models use quantized browser WebAssembly inference through Transformers.js. No paid API key, server inference endpoint, or hosted database is needed. First use requires network access to download model files from Hugging Face and its file hosts; downloads can be tens to hundreds of megabytes. Model files are cached by the browser when supported, and versioned document embeddings are cached locally in IndexedDB when available. Subsequent runs can reuse cached work. Cache eviction, private browsing, a changed corpus/model, or a different browser may require downloading or encoding again.

Allow model downloads and give the browser enough memory and time, particularly for larger point counts or first-time generation. Loading, encoding, projection, and generation have visible status/progress; failures show an error and **Retry model loading**. Failed inference does not silently substitute handcrafted vectors or a prewritten answer. Queries are processed locally rather than sent to an external inference API. Actual 120- and 500-passage embedding/projection, semantic retrieval, FLAN-T5 generation, point selection, retrieval-link toggling, and cache reuse across separate Chrome processes sharing one persistent profile were verified on the production URL. Its flight question produced a brief grounded answer; compact-model completeness remains a limitation. Recorded timings and verification scope are in `VERIFICATION.md`.

## Verification

```sh
npm test
npm run typecheck
npm run test:e2e
```

Browser tests use installed Google Chrome through Playwright. If Chrome is unavailable, install its official Playwright-managed distribution with `npx playwright install chrome`. Browser tests start a local Vite server on port 5174 automatically when needed. CI runs against the built production artifact with Vite preview after the build step. To test a deployment, set `TEST_BASE_URL` to its URL before running the suite.

Tests verify numerical identities and edge cases, all lesson interactions, scenario changes, input/playback synchronization, AI ranking and source provenance, mobile overflow, reduced motion, and WebGL fallback. The real-mode failure-handling browser test deliberately aborts model downloads and checks errors/retry without mocking successful inference. Passing that test does not verify actual model loading, semantic quality, or generation. See `VERIFICATION.md` for the recorded delivery checks and practical limits.

To reproduce the actual model flow, start the local server in one terminal:

```sh
npm run dev -- --port 5174
```

Then run `npm run verify:real` in another terminal. This opt-in verification downloads actual model weights, encodes sample passages, performs semantic retrieval, and generates a real local answer. It is separate from the regular CI/browser suite and needs network access, sufficient memory, and installed Chrome. Set `REAL_TEST_BASE_URL` to a deployment URL to test that release instead of the default `http://127.0.0.1:5174`. The script writes ignored local verification artifacts; inspect answer quality as well as successful execution.

For the synthetic 500-point scene profile, start the local development server on port 5174 and run `npm run profile:scene`. The test-only fixture is excluded from the production entry point. It records FPS/resource samples, checks orbit interaction and remount cleanup, and writes ignored artifacts locally. `PROFILE_BASE_URL` can override the local server address. This rendering profile does not benchmark model download, sentence encoding, UMAP fitting, or local answer generation.

## Deploy through GitHub to Vercel

Repository: https://github.com/JamesKamugisha/Vector-Space-explorer

Import this repository in Vercel and select the Vite preset. The root `vercel.json` supplies the build command (`npm run build`) and output directory (`dist`). Use `npm ci` to install dependencies and Node.js 24. No environment variables or API keys are required. Set `main` as the production branch so subsequent pushes redeploy automatically.

`dist/`, installed packages, browser artifacts, credentials, and Vercel's local state are ignored by Git. Google Fonts is an optional external font request; system fallbacks keep the interface usable if that request fails. Real-model mode additionally needs browser access to its public model files and WebAssembly assets; model weights and cached embeddings are not committed to the repository.

## Structure

```text
src/App.tsx                app shell, controls, results, playback
src/styles.css             layout and visual design
src/math/vector.ts         pure numerical operations and solvers
src/lessons/operations.ts   lesson results and worked steps
src/scene/VectorScene.tsx   shared renderer and geometry lifecycle
src/ai/                    corpus, search, simulation and AI controls
src/real/                  authored text corpus, model worker, embedding cache,
                           full-dimensional retrieval, local generation and UI
tests/                     numerical and browser regression tests
docs/source/               local supplied specification and illustrations
```

The original PDF and developer ZIP are preserved in the local project folder. The extracted specification and three illustrations are kept locally in `docs/source/`. Source documents, planning files, and the checklist are excluded from the public repository.
