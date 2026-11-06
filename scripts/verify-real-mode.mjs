import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

await mkdir("artifacts", { recursive: true });
const context = await chromium.launchPersistentContext(
  process.env.REAL_PROFILE_DIR ||
    join(tmpdir(), "vector-space-explorer-real-verify-profile"),
  {
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1100 },
  },
);
const browser = context.browser();
const page = await context.newPage();
const pageErrors = [];
const requestFailures = [];
const report = {
  browser: browser.version(),
  started: new Date().toISOString(),
  stages: [],
  pageErrors,
  requestFailures,
};
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("requestfailed", (request) =>
  requestFailures.push({
    url: request.url(),
    error: request.failure()?.errorText,
  }),
);

// Observe native worker messages without changing requests, inference, or responses.
await page.addInitScript(() => {
  window.realVerificationMessages = [];
  const NativeWorker = window.Worker;
  window.Worker = new Proxy(NativeWorker, {
    construct(target, args) {
      const worker = Reflect.construct(target, args);
      worker.addEventListener("message", (event) => {
        const patch = event.data?.patch;
        if (!patch) return;
        window.realVerificationMessages.push({
          at: Date.now(),
          id: event.data.id,
          status: patch.status,
          dimensions: patch.dimensions,
          message: patch.message,
          pointCount: patch.points?.length,
          queryVectorLength: patch.queryVector?.length,
          queryNorm: patch.queryVector
            ? Math.hypot(...patch.queryVector)
            : undefined,
          queryPosition: patch.queryPosition,
          searchedQuery: patch.searchedQuery,
          points: patch.points
            ?.slice(0, 48)
            .map((point) => ({ id: point.id, position: point.position })),
          documentIds: patch.documents?.map((document) => document.id),
          results: patch.results?.slice(0, 5).map((result) => ({
            id: result.document.id,
            title: result.document.title,
            topic: result.document.topic,
            score: result.score,
            distance: result.distance,
          })),
          answer: patch.answer,
          contextIds: patch.contextIds,
        });
      });
      return worker;
    },
  });
});

async function waitReady(stage, count, timeout = 360000, answerAfter) {
  const start = Date.now();
  let previous = "";
  while (Date.now() - start < timeout) {
    const status = (
      await page
        .locator(".real-status")
        .textContent()
        .catch(() => "")
    )?.trim();
    const message = await page
      .locator(".real-progress-label")
      .allTextContents()
      .then((texts) => texts.join(" "));
    const visibleCount = await page
      .locator(".scene-webgl")
      .getAttribute("data-scene-point-count")
      .catch(() => "");
    const summary = `${status} ${message || ""} points=${visibleCount}`;
    if (summary !== previous) {
      console.log(`${stage}: ${summary}`);
      previous = summary;
    }
    if (status === "Error")
      throw new Error(await page.locator(".real-error").innerText());
    const answerObserved =
      answerAfter === undefined ||
      (await page.evaluate(
        (after) =>
          window.realVerificationMessages
            .slice(after)
            .some(
              (message) =>
                typeof message.answer === "string" && message.answer.length,
            ),
        answerAfter,
      ));
    if (
      status === "Ready" &&
      answerObserved &&
      (count === undefined || Number(visibleCount) === count)
    ) {
      const elapsedMs = Date.now() - start;
      report.stages.push({ stage, elapsedMs, pointCount: visibleCount });
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`${stage} timed out after ${timeout}ms`);
}

async function waitQuery(afterIndex) {
  await page.waitForFunction(
    (after) =>
      window.realVerificationMessages
        .slice(after)
        .some(
          (message) =>
            message.queryVectorLength === 384 &&
            message.results?.some(
              (result) => result.topic.toLowerCase() === "birds",
            ),
        ),
    afterIndex,
    { timeout: 120000 },
  );
  await waitReady("query complete");
  const firstTopic = await page
    .locator(".real-result")
    .first()
    .locator(".real-result-text small")
    .innerText();
  assert.match(firstTopic, /birds/i);
}

try {
  await page.goto(
    process.env.REAL_TEST_BASE_URL ||
      process.env.REAL_BASE_URL ||
      "http://127.0.0.1:5174",
  );
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page
    .getByRole("button", { name: "Real embeddings", exact: true })
    .click();
  await waitReady("initial 120-document model and projection", 120);
  await page
    .getByLabel("Ask about an idea", { exact: true })
    .fill("Why do birds migrate to warmer places during winter?");
  const firstSearchIndex = await page.evaluate(
    () => window.realVerificationMessages.length,
  );
  await page.getByRole("button", { name: /Search by meaning/ }).click();
  await waitQuery(firstSearchIndex);
  report.results120 = await page.locator(".real-result").allInnerTexts();
  await page.getByRole("button", { name: "500", exact: true }).click();
  await waitReady("500-document embeddings and projection", 500);
  await page
    .getByLabel("Ask about an idea", { exact: true })
    .fill("What parts of a bird help it fly?");
  const secondSearchIndex = await page.evaluate(
    () => window.realVerificationMessages.length,
  );
  await page.getByRole("button", { name: /Search by meaning/ }).click();
  await waitQuery(secondSearchIndex);
  await page.waitForTimeout(1200);
  report.results500 = await page.locator(".real-result").allInnerTexts();
  report.scene500 = await page
    .locator(".scene-webgl")
    .evaluate((element) => ({ ...element.dataset }));
  await page.locator(".control-panel").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page
    .getByRole("complementary", {
      name: "Experiment instructions",
      exact: true,
    })
    .evaluate((element) => {
      element.scrollTop = 0;
    })
    .catch(() => {});
  await page.screenshot({
    path: "artifacts/real-500-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".scene-card")
    .screenshot({ path: "artifacts/real-production-clusters.png" });
  assert(
    await page
      .getByRole("complementary", {
        name: "Experiment instructions",
        exact: true,
      })
      .isVisible(),
  );
  const linksBefore = Number(
    await page.locator(".scene-webgl").getAttribute("data-scene-geometries"),
  );
  await page
    .getByRole("button", { name: "Retrieval links", exact: true })
    .click();
  await page.waitForFunction(
    (before) =>
      Number(document.querySelector(".scene-webgl").dataset.sceneGeometries) <
      before,
    linksBefore,
    { timeout: 5000 },
  );
  const linksOff = Number(
    await page.locator(".scene-webgl").getAttribute("data-scene-geometries"),
  );
  await page
    .getByRole("button", { name: "Retrieval links", exact: true })
    .click();
  await page.waitForFunction(
    (before) =>
      Number(document.querySelector(".scene-webgl").dataset.sceneGeometries) ===
      before,
    linksBefore,
    { timeout: 5000 },
  );
  report.retrievalLinks = {
    geometriesOn: linksBefore,
    geometriesOff: linksOff,
    queryLinkCount: linksBefore - linksOff,
  };
  assert.equal(report.retrievalLinks.queryLinkCount, 5);
  const generationIndex = await page.evaluate(
    () => window.realVerificationMessages.length,
  );
  await page
    .getByRole("button", { name: /Generate answer from sources/ })
    .click();
  await waitReady(
    "actual local language-model generation",
    500,
    600000,
    generationIndex,
  );
  await page.locator(".real-answer").waitFor({ timeout: 120000 });
  report.answer = await page.locator(".real-answer").innerText();
  assert(report.answer.length > 50);
  report.sources = await page
    .locator(".real-source-links button")
    .allInnerTexts();
  assert(report.sources.length > 0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  report.accessibility = accessibility.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target),
  }));
  console.log(`SUCCESS_STATE_AXE ${JSON.stringify(report.accessibility)}`);
  assert.deepEqual(report.accessibility, []);
  await page.screenshot({
    path: "artifacts/real-generated-answer-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".scene-card").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "artifacts/real-500-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator(".scene-card").scrollIntoViewIfNeeded();
  const beforePick = await page
    .locator(".real-source-metadata code")
    .innerText();
  const observedPoints = await page.evaluate(
    () =>
      [...window.realVerificationMessages]
        .reverse()
        .find((message) => message.pointCount === 500 && message.points?.length)
        ?.points || [],
  );
  const cameraData = JSON.parse(
    await page.locator(".scene-webgl").getAttribute("data-scene-camera"),
  );
  const canvasBox = await page.locator(".scene-webgl canvas").boundingBox();
  const targets = await page.evaluate(
    ({ points, camera }) => {
      const subtract = (a, b) => a.map((x, i) => x - b[i]);
      const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
      const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const normalize = (a) => {
        const length = Math.hypot(...a);
        return a.map((x) => x / length);
      };
      const forward = normalize(subtract(camera.target, camera.position));
      const right = normalize(cross(forward, [0, 0, 1]));
      const up = cross(right, forward);
      const tangent = Math.tan((20 * Math.PI) / 180);
      return points
        .map((point) => {
          const delta = subtract(point.position, camera.position),
            depth = dot(delta, forward);
          return {
            id: point.id,
            x:
              ((dot(delta, right) /
                (depth * tangent * (camera.width / camera.height))) *
                0.5 +
                0.5) *
              camera.width,
            y:
              ((-0.5 * dot(delta, up)) / (depth * tangent) + 0.5) *
              camera.height,
          };
        })
        .filter(
          (point) =>
            point.x > 40 &&
            point.x < camera.width - 40 &&
            point.y > 60 &&
            point.y < camera.height - 90,
        );
    },
    { points: observedPoints, camera: cameraData },
  );
  for (const target of targets.slice(0, 12)) {
    await page.mouse.click(canvasBox.x + target.x, canvasBox.y + target.y);
    await page.waitForTimeout(100);
    const afterPick = await page
      .locator(".real-source-metadata code")
      .innerText();
    if (afterPick !== beforePick) {
      report.pointSelection = { before: beforePick, after: afterPick };
      break;
    }
  }
  assert(
    report.pointSelection,
    "Clicking a cloud point must change the selected-source inspector.",
  );
  report.idb = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("vector-space-real-embeddings", 1);
        request.onsuccess = () => {
          const db = request.result;
          const count = db
            .transaction("vectors", "readonly")
            .objectStore("vectors")
            .count();
          count.onsuccess = () => {
            resolve(count.result);
            db.close();
          };
          count.onerror = () => reject(count.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  assert(report.idb >= 500);
  const cacheStart = await page.evaluate(
    () => window.realVerificationMessages.length,
  );
  await page.getByLabel("NUMBER OF POINTS", { exact: true }).fill("120");
  await page.getByLabel("NUMBER OF POINTS", { exact: true }).press("Enter");
  await waitReady("cached 120-document reentry", 120);
  await page.getByRole("button", { name: "500", exact: true }).click();
  await waitReady("cached 500-document reentry", 500);
  report.cacheMessages = await page.evaluate(
    (after) => window.realVerificationMessages.slice(after),
    cacheStart,
  );
  assert(
    !report.cacheMessages.some((message) =>
      message.message?.includes("Computing actual 384-dimensional embeddings:"),
    ),
    "Cached reentry must not recompute document inference.",
  );
  console.log(
    `CACHE_AND_PICKING ${JSON.stringify({ idb: report.idb, pointSelection: report.pointSelection })}`,
  );
  report.workerMessages = await page.evaluate(
    () => window.realVerificationMessages,
  );
  if (process.env.REAL_REQUIRE_WARM_CACHE === "1")
    assert(
      !report.workerMessages.some((message) =>
        message.message?.includes(
          "Computing actual 384-dimensional embeddings:",
        ),
      ),
      "Cross-process warm cache should skip all document encoding.",
    );
  assert(
    report.workerMessages.some((message) => message.queryVectorLength === 384),
  );
  assert(
    report.workerMessages.some(
      (message) => typeof message.answer === "string" && message.answer.length,
    ),
  );
  assert.deepEqual(pageErrors, []);
  report.completed = new Date().toISOString();
  report.success = true;
  console.log(
    JSON.stringify(
      {
        success: true,
        stages: report.stages,
        results500: report.results500,
        answer: report.answer,
        sources: report.sources,
        scene500: report.scene500,
      },
      null,
      2,
    ),
  );
} catch (error) {
  report.error = error.message;
  report.workerMessages = await page
    .evaluate(() => window.realVerificationMessages)
    .catch(() => []);
  await page
    .screenshot({
      path: "artifacts/real-verification-error.png",
      fullPage: true,
    })
    .catch(() => {});
  throw error;
} finally {
  await writeFile(
    "artifacts/real-verification.json",
    JSON.stringify(report, null, 2),
  );
  await context.close();
}
