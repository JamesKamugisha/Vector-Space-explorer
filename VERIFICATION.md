# Vector Space Explorer Delivery Verification

Verified November 5, 2026, on Windows with Node.js 24, npm 11, and installed Google Chrome through Playwright.

## Passing checks

The baseline checks below cover the delivered deterministic math/AI workflows. Real-model verification is recorded separately below; baseline counts and rendering measurements do not establish successful model inference.

- Production build and strict TypeScript check.
- ESLint, Prettier formatting check, and production dependency audit (zero vulnerabilities reported).
- 40 numerical and AI unit tests: vector identities, magnitude-independent rank, basis reconstruction and singular handling, Gram–Schmidt orthonormality, nullspace equations, angles, metric ordering, unknown queries, and RAG provenance.
- 28 browser tests: automated accessibility for Math and AI, all math lessons, live inputs, overlays, source fixtures, playback cancellation, manual steps, AI metric switching and RAG, scenario lifecycle, mobile overflow/help, reduced motion/WebGL fallback, camera orbit/reset, resource stability, mobile canvas sizing, 8–500 point controls, actual count-vector ranking, PCA values, expanded accessibility, mobile collapse, right instructions, raycast selection, norm shells/reference planes, basis/Gram geometry phases, point-buffer reuse, and dense-label collision handling.
- Desktop and 390px mobile screenshots reviewed; text contrast improved, input/results typography increased, duplicate scene UI removed, and hidden skip-link positioning corrected.

## Defects caught during implementation

- Stale animation frame could restore old playback progress after editing inputs: fixed with generation-based cancellation.
- OrbitControls damping could move the camera after Reset View: fixed by clearing accumulated deltas before restoring the canonical pose.
- Nearly parallel Gram–Schmidt inputs could lose orthogonality: fixed and covered by numerical regression.
- Unsupported AI queries could look like ranked results: ranking/retrieval now disabled until recognized features exist.
- Mobile help icon lost its accessible name: explicit label added.
- Low contrast helper text and mismatched accessible names: corrected; no accessibility rules disabled.

## Observed scene behavior

At a 1440×1100 automated Chrome viewport, the resource test returned to 53 geometries and 0 textures after repeated lesson and scenario changes. The sampled frame rate across local runs was approximately 50–61 FPS. Orbit visibly changed the scene; reset restored the camera exactly, with less than 0.5% screenshot pixel variation after settling. Numeric results stayed unchanged during camera movement.

These measurements describe the local test environment. They do not establish performance on every device or prove that every possible WebGL resource leak is absent.

The separate seeded 500-point profile used automated Chrome 156 on this Windows host, 1440×900 viewport, DPR 1. Three steady samples were 60 FPS; remount samples were 60–61 FPS. Geometry count remained 58, textures remained 0, camera orbit was verified, no page errors occurred, and no canvases remained after cleanup. Reproduce with `npm run profile:scene` against the local test fixture.

## Scope and remaining checks

The delivered deterministic baseline includes 13 mathematical operations, the configurable teaching AI lab, a computed synthetic 4D PCA lesson, vector analogy arithmetic, and a contextual right instructions sidebar. Step highlighting works across lessons; actual geometry playback includes addition, scaling, normalization, linear combination, basis reconstruction, and Gram–Schmidt. Projection onto a plane and PCA education are implemented. Real-model mode is an additional implementation with its own pending success checks below. Broad physical-device testing remains. Automated accessibility checks supplement manual keyboard/mobile review and do not constitute a complete accessibility certification.

The app was deployed from GitHub to https://vector-space-explorer-lac.vercel.app/. The initial source commit passed remote Linux CI: https://github.com/JamesKamugisha/Vector-Space-explorer/actions/runs/42125685154. The initial 12 browser checks also passed against the live production URL, including accessibility, mathematical fixtures, AI retrieval, mobile layout, fallback behavior, camera reset, and resource stability.

## Specification completion review

The November 5 follow-up compared the original specification with the live baseline and source. It completed the missing magnitude shells, reference planes, clickable math-vector details, numeric spherical inspector, plane projection, basis/Gram geometry playback, mobile collapse, real-world lesson examples, actual count-vector plotting, selected AI angle/distance readouts, synthetic PCA, and optional contrived analogy. The user-requested point setter renders the selected number of actual scene points; generated documents are labeled synthetic, and rankings/retrieval use those same arrays. The requested right sidebar contains contextual instructions and the single worked-step player. Dense-cloud labels use clamped collision avoidance and selected-point priority.

The local checklist is intentionally excluded from the public repository together with the original specification and plans. It distinguishes the deterministic baseline, real-model implementation, pending inference verification, and physical-device testing.

## Real-model implementation and verification

The current local verification run passes 46 unit tests and 29 browser tests, plus production build, TypeScript, ESLint, Prettier, and the production dependency audit with zero vulnerabilities reported. The historical 40-unit/28-browser baseline above is retained for comparison.

Real embeddings mode implements a separate browser-worker pipeline: quantized `Xenova/all-MiniLM-L6-v2` mean-pooled normalized 384-dimensional text embeddings, an unsupervised seeded UMAP projection into three display dimensions, original-dimensional cosine retrieval and distance calculations, and lazy `Xenova/flan-t5-small` answer generation. The corpus contains up to 500 authored sample passages composed from facts and practical contexts across Cats, Dogs, Cars, Faces, Chairs, and Birds. Topic labels supply colors only; they do not supply projection positions. These are text embeddings, not image embeddings.

The generator receives context from the top three retrieved passages. Source buttons identify the supplied context IDs. They do not establish that the model correctly grounded each claim or generated its own faithful citations. Small-model factual accuracy, answer completeness, and semantic quality require inspection beyond successful execution.

Both models run locally through browser WebAssembly after public model downloads. Browser model caching and a versioned IndexedDB document-embedding cache support reuse when available. No paid API key or server inference service is required. First downloads and available browser memory can affect loading, encoding, UMAP projection, and generation; the earlier 500-point rendering profile does not measure these stages.

Completed verification for the real-mode interface:

- Strict TypeScript check and targeted ESLint pass for the controls and failure-handling test.
- `tests/e2e/real-mode.spec.ts` passes in installed Chrome. It deliberately aborts Hugging Face downloads to verify visible model errors, actionable retry that issues another model request, no fabricated rankings/answers, public model metadata, local-processing disclosures, numeric point-count limits, topic-query presets, and disabled search/generation before readiness.
- Automated WCAG A/AA checks of the real-mode error/interface state report zero violations. No accessibility rule was disabled.

Completed separate real-network execution in Chrome 156:

- Actual MiniLM downloads and browser inference produced the 384-dimensional query representation and displayed real UMAP point sets for 120 and 500 sample passages. The 500-point scene reported 60 FPS in the captured sample; this is an observation on the test host, not a universal performance guarantee.
- The question “Why do birds migrate to warmer places during winter?” ranked bird-migration passages first. With 500 passages, the leading result was “Bird migration · Seasonal survey,” cosine 0.649; subsequent leading results were other migration contexts. No mocked embedding output was supplied, and the run recorded no page errors or failed requests.
- FLAN-T5 generated “Species differ in their routes, timing, and the distances they travel.” The supplied context IDs were `birds-043`, `birds-015`, and `birds-071`. The output is relevant to migration but incomplete: it does not explain the seasonal-resource reason asked by the question. This verifies actual generation and source-context wiring, not reliable answer quality or faithful generated citations.

The ignored local `artifacts/real-verification.json` records model progress, rankings, scene diagnostics, generated text, and context IDs for this execution. Its initial UI stopwatch fields include test-harness waiting and are not used as trustworthy performance measurements.

Intervals extracted from native worker-message timestamps, excluding the harness waits, were:

| Stage | Observed interval |
| --- | --- |
| Initial 120-passage model loading, embedding, and projection | 9.101 seconds |
| Expansion to 500 passages using the already loaded sentence model and first 120 embeddings | 15.494 seconds |
| Two measured query embedding/projection/retrieval requests | 30 and 37 milliseconds |
| Lazy FLAN-T5 loading and answer generation | 4.842 seconds |

These are observations from one Chrome 156 run on this Windows host and its connection. They are not guaranteed completion times, a cold 500-passage benchmark, or evidence of cache behavior across browser restarts. Use `npm run verify:real` against a running local server on port 5174 to reproduce actual inference; set `REAL_TEST_BASE_URL` for a deployment. This downloads real weights and is separate from the regular CI suite.

Remaining real-mode checks:

- Confirm warm cache reuse across a new browser session and additional first-run, device, and browser behavior; native worker intervals above are only one local sample.
- Verify the real-model release on the deployed Vercel URL after its source is published.

The deliberate download-failure test remains separate from this successful real-network execution. Broader semantic accuracy, complete answers, cross-browser behavior, and physical-device performance remain unproven by a single successful question.
