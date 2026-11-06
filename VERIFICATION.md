# Vector Space Explorer Delivery Verification

## Responsive workspace refinement

Reduced the header and introduction spacing and sized the canvas from viewport height, keeping the full scene and its camera controls visible initially. The right instructions sidebar and larger text remain. Detailed results continue below the scene in normal page flow; the page is not locked against scrolling.

At widths up to 900px, controls start collapsed and remain available through the keyboard-accessible **Experiment controls** button. Phone layouts omit duplicate introductory descriptions, use touch-specific camera hints, and retain the five AI stages in a focusable horizontal strip. Inputs and file import remain accessible when controls expand.

New browser checks cover full-scene fit in both labs at 1920×1080, 1440×900, 1366×768, 1280×720, 1024×768, and 1280×600; phone/tablet fit and usable controls at 390×844, 375×812, 320×740, and 768×1024; and actual one-finger orbit plus two-finger zoom in Chrome touch emulation. Small-screen accessibility, horizontal overflow, and preservation of numeric results are checked. Real-mode layout tests deliberately block model downloads and do not claim new model-inference verification.

Lint, formatting, strict TypeScript, production build, and 62 unit tests pass. The expanded browser suite contains 35 cases. Its new mobile accessibility check exposed an empty real-mode color legend during model failure; that legend is now omitted until data exists and has an explicit group role when shown. The three responsive/touch/accessibility checks pass after the fix. Desktop and phone screenshots in the ignored local artifacts folder were visually reviewed; broader physical-device testing remains separate from Chrome emulation.

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
- Cold development-worker dependency discovery could invalidate Vite module URLs on first entry into real mode: model dependencies are explicitly prebundled at startup. The fresh-start failure-handling check passes; CI browser tests run against the built production artifact.

## Observed scene behavior

At a 1440×1100 automated Chrome viewport, the resource test returned to 53 geometries and 0 textures after repeated lesson and scenario changes. The sampled frame rate across local runs was approximately 50–61 FPS. Orbit visibly changed the scene; reset restored the camera exactly, with less than 0.5% screenshot pixel variation after settling. Numeric results stayed unchanged during camera movement.

These measurements describe the local test environment. They do not establish performance on every device or prove that every possible WebGL resource leak is absent.

The separate seeded 500-point profile used automated Chrome 156 on this Windows host, 1440×900 viewport, DPR 1. Three steady samples were 60 FPS; remount samples were 60–61 FPS. Geometry count remained 58, textures remained 0, camera orbit was verified, no page errors occurred, and no canvases remained after cleanup. Reproduce with `npm run profile:scene` against the local test fixture.

## Scope and remaining checks

The delivered deterministic baseline includes 13 mathematical operations, the configurable teaching AI lab, a computed synthetic 4D PCA lesson, vector analogy arithmetic, and a contextual right instructions sidebar. Step highlighting works across lessons; actual geometry playback includes addition, scaling, normalization, linear combination, basis reconstruction, and Gram–Schmidt. Projection onto a plane and PCA education are implemented. Real-model mode has separate successful production checks below. Broad physical-device testing remains. Automated accessibility checks supplement manual keyboard/mobile review and do not constitute a complete accessibility certification.

The app was deployed from GitHub to https://vector-space-explorer-lac.vercel.app/. The initial source commit passed remote Linux CI: https://github.com/JamesKamugisha/Vector-Space-explorer/actions/runs/42125685154. The initial 12 browser checks also passed against the live production URL, including accessibility, mathematical fixtures, AI retrieval, mobile layout, fallback behavior, camera reset, and resource stability.

## Specification completion review

The November 5 follow-up compared the original specification with the live baseline and source. It completed the missing magnitude shells, reference planes, clickable math-vector details, numeric spherical inspector, plane projection, basis/Gram geometry playback, mobile collapse, real-world lesson examples, actual count-vector plotting, selected AI angle/distance readouts, synthetic PCA, and optional contrived analogy. The user-requested point setter renders the selected number of actual scene points; generated documents are labeled synthetic, and rankings/retrieval use those same arrays. The requested right sidebar contains contextual instructions and the single worked-step player. Dense-cloud labels use clamped collision avoidance and selected-point priority.

The local checklist is intentionally excluded from the public repository together with the original specification and plans. It distinguishes the deterministic baseline, verified real-model flow and persistent cache reuse, and remaining physical-device/additional-browser testing.

## Real-model implementation and verification

The pre-upload real-model verification run passed 46 unit tests and 29 browser tests, plus production build, TypeScript, ESLint, Prettier, and the production dependency audit with zero vulnerabilities reported. The historical 40-unit/28-browser baseline above is retained for comparison. The expanded upload release's checks are recorded below.

Real embeddings mode implements a separate browser-worker pipeline: quantized `Xenova/all-MiniLM-L6-v2` mean-pooled normalized 384-dimensional text embeddings, an unsupervised seeded UMAP projection into three display dimensions, original-dimensional cosine retrieval and distance calculations, and lazy `Xenova/flan-t5-small` answer generation. The corpus contains up to 500 authored sample passages composed from facts and practical contexts across Cats, Dogs, Cars, Faces, Chairs, and Birds. Topic labels supply colors only; they do not supply projection positions. These are text embeddings, not image embeddings.

The generator receives context from the top three retrieved passages. Source buttons identify the supplied context IDs. They do not establish that the model correctly grounded each claim or generated its own faithful citations. Small-model factual accuracy, answer completeness, and semantic quality require inspection beyond successful execution.

Both models run locally through browser WebAssembly after public model downloads. Browser model caching and a versioned IndexedDB cache for public sample embeddings support reuse when available. Imported private text and embeddings instead remain in memory and are not automatically persisted in that cache. No paid API key or server inference service is required. First downloads and available browser memory can affect loading, encoding, projection, and generation; the earlier 500-point rendering profile does not measure these stages.

Completed verification for the real-mode interface:

- Strict TypeScript check and targeted ESLint pass for the controls and failure-handling test.
- `tests/e2e/real-mode.spec.ts` passes in installed Chrome. It deliberately aborts Hugging Face downloads to verify visible model errors, actionable retry that issues another model request, no fabricated rankings/answers, public model metadata, local-processing disclosures, numeric point-count limits, topic-query presets, and disabled search/generation before readiness.
- Automated WCAG A/AA checks of the real-mode error/interface state report zero violations. No accessibility rule was disabled.

Completed production real-network execution in Chrome 156 against https://vector-space-explorer-lac.vercel.app/, application source commit `649be8d`:

- Actual MiniLM downloads and browser inference produced the 384-dimensional query representation and displayed real UMAP point sets for 120 and 500 sample passages. The 500-point scene reported 60 FPS in the captured sample; this is an observation on the test host, not a universal performance guarantee.
- The question “What parts of a bird help it fly?” ranked bird wing-shape passages first. With 500 passages, the leading result was “Wing shape · Habitat restoration,” cosine 0.532, followed by other wing-shape contexts. The query representation had 384 dimensions. No mocked embedding output was supplied, and the run recorded no page errors or failed requests.
- FLAN-T5 generated “A bird’s wing shape” using context IDs `birds-060`, `birds-018`, and `birds-074`. The phrase is grounded in the retrieved passages, but it is brief rather than a complete explanation of all flight-related anatomy. The earlier local migration question also produced a relevant but incomplete answer. These observations verify actual generation and source-context wiring, not general answer accuracy or faithful generated citations.
- Automated WCAG A/AA checks in the populated production results/generated-answer state reported zero violations. Clicking a real-cloud point changed the inspected source from `birds-060` to `cats-057`.
- IndexedDB contained 500 cached embedding records. Returning to 120 and then 500 points in the same session skipped document inference and recomputed the projection. A separate Chrome process reusing the same persistent profile also completed the 120/500-point flow with no document-encoding phase reported anywhere in the warm run. This verifies persisted cache reuse for that profile and model/corpus version; it does not promise survival after cache eviction or across unrelated profiles.
- The retrieval-link toggle changed scene geometry counts from 12 to 7 and back to 12, confirming that the five query links were removed and restored. Warm production verification again recorded zero page errors and zero automated accessibility violations, and real-cloud point selection passed.

The ignored local `artifacts/real-verification-production-first.json` preserves the first successful production run. `artifacts/real-verification.json` records the later successful warm run in a separate process, including model progress, rankings, scene diagnostics, generated text, context IDs, accessibility, point selection, retrieval links, and cache observations. The verification script records native worker intervals rather than earlier harness waits.

Intervals extracted from native worker-message timestamps, excluding the harness waits, were:

| Stage | Observed interval |
| --- | --- |
| Initial 120-passage model loading, embedding, and projection | 9.132 seconds |
| Expansion to 500 passages using the already loaded sentence model and first 120 embeddings | 16.190 seconds |
| Two measured query embedding/projection/retrieval requests | 12 and 10 milliseconds |
| Lazy FLAN-T5 loading and answer generation | 5.088 seconds |
| Warm same-session return to 120 passages | 2.051 seconds |
| Warm same-session return to 500 passages | 3.049 seconds |

The subsequent warm run in a separate Chrome process sharing the persistent profile completed initial 120-passage setup in 3.061 seconds, expansion to 500 in 3.042 seconds, and local answer generation in 2.041 seconds. Its same-session returns to 120 and 500 took 2.048 and 3.078 seconds. All 500 embedding records were present, and worker messages reported no document-encoding phase during this warm run.

These are observations from Chrome 156 runs on this Windows host and its connection. They are not guaranteed completion times or a cold 500-passage benchmark. Cache reuse was verified for the same persistent profile, not across cache eviction or arbitrary browsers. Use `npm run verify:real` against a running local server on port 5174 to reproduce actual inference; set `REAL_TEST_BASE_URL` for a deployment. This downloads real weights and is separate from the regular CI suite.

Remote CI results are available in the repository's [GitHub Actions](https://github.com/JamesKamugisha/Vector-Space-explorer/actions). The local 46-unit/29-browser checks and successful production inference above are separate verification evidence.

Remaining broader checks:

- Additional physical devices, browser engines, network conditions, and cache-eviction behavior have not been tested; the native worker intervals above cover this Chrome host and persistent profile.

The deliberate download-failure test remains separate from this successful real-network execution. Broader semantic accuracy, complete answers, cross-browser behavior, and physical-device performance remain unproven by a single successful question.

## Private document import addition

The upload extension implements local PDF/TXT/Markdown parsing, bounded overlapping chunks, per-file colors, filename/PDF-page/chunk provenance, and atomic replacement of the sample corpus. Uploaded text and vectors are kept in browser memory rather than the public-sample IndexedDB cache. Returning to samples or reloading discards the active imported corpus. There is no server upload of the document content.

Limits are 10 files, 10 MB each, 30 MB total, 200 pages per PDF, and 500 chunks total. Empty/image-only PDFs report the absence of extractable text and the lack of OCR support; malformed or password-protected PDFs produce actionable errors. Extracted page references provide provenance, not preserved PDF layout, table fidelity, or guaranteed reading order.

Imported point counts run from one to the actual chunk count. The selected prefix is both the plotted corpus and the retrieval/generation scope; no sample padding or fabricated duplicate points are added. Fewer than eight included chunks use centered PCA, while eight or more use UMAP. Scores remain original-dimensional in both cases. Small or rank-deficient corpora can occupy fewer than three display dimensions.

Completed checks for this addition:

- Eight parser unit tests pass in `tests/import-documents.test.ts`, covering normalization/chunking bounds and source handling, invalid/limited imports, cancellation, and warnings without silently invented chunks.
- Three Chrome tests pass in `tests/e2e/document-upload.spec.ts`. They run actual PDF.js text extraction on a minimal PDF, plus TXT/Markdown parsing; confirm two real files produce two chunks; verify source filename/page summaries, sample restoration, blank/malformed PDF and oversized-file errors, and retention of the prior corpus after a failed replacement.
- Automated WCAG A/AA checks of the uploader's successful-import and error states report zero violations. These upload tests deliberately block Hugging Face downloads: parsing is real, but successful model inference is not asserted by these tests.

The separate network-enabled uploaded-document flow passed locally and then on the production URL at application source commit `afe56b3`. The latest ignored `artifacts/upload-verification.json` records the successful production check:

- A TXT file produced one real chunk, a PDF produced two, two PDFs produced five, and a longer PDF produced twenty. Point counts and finite scene positions matched exactly; requesting 500 points clipped to each corpus's actual size instead of adding sample or duplicate points. Small-corpus PCA and the twenty-point UMAP path both ran against actual MiniLM vectors.
- A 384-dimensional hydrogen-fuel query retrieved the imported research-station passage. The twenty-chunk result scored approximately 0.6846. Actual FLAN-T5 generation answered “hydrogen” for the one- and twenty-chunk corpora, with the imported filename/page/chunk references identifying the supplied context.
- Clicking another cloud point selected page 2 of the imported PDF with correct source attribution. The 390px mobile view had no horizontal overflow, and returning to samples restored 120 sample points.
- Public-sample IndexedDB keys remained unchanged, with 500 cached public vectors before and after private-document work. No request containing the imported content was observed, no page errors occurred, and automated WCAG A/AA checks in the actual successful upload/model state reported zero violations.

The expanded local unit suite passes 62 tests, and the clean full browser run passes all 32 cases after the final typography and two-column experiment-tab refinements. Production build, strict TypeScript, ESLint, and formatting checks pass; the production dependency audit reports zero vulnerabilities. The deployed flow and remote production-build CI also pass.

The final typography pass uses 15px body text, 14px helper copy, labels of at least 12px, darker slate interface text, and brighter canvas labels. Desktop and 390px mobile screenshots were reviewed for readability. The compact imported state keeps the chunk/file summary and sample-restoration action visible while file replacement, provenance summaries, and privacy details remain under Manage imported files. Its three parser/accessibility browser tests pass after the layout/font changes; the mobile screenshot has no horizontal overflow. Legibility takes priority over keeping every control above the fold, and desktop controls remain scrollable.

The production run completed in approximately 15.2 seconds on this test host/profile, including the actual 1/2/5/20-chunk scenarios and generation. It confirmed distinct source-file colors, exact count clipping, filename/page/chunk context, real point selection on PDF page 2, unchanged 500 public-cache keys, no observed request carrying imported content, zero page errors, zero automated accessibility violations, no mobile horizontal overflow, and restoration of 120 sample points. Final typography was visually reviewed on the deployed interface. This observed run time is not a cold-download or general device-performance guarantee.

Reproduce the actual imported-model flow with `npm run verify:upload` against the running local server on port 5174; set `UPLOAD_TEST_BASE_URL` for a deployment. Uploaded-document production verification is complete. [GitHub Actions run 42138257607](https://github.com/JamesKamugisha/Vector-Space-explorer/actions/runs/42138257607) passed the production build, source checks, all 62 unit tests, and all 32 browser tests for application commit `afe56b3`. Successful execution does not establish general document-answer accuracy.
