import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const artifactDirectory = resolve("artifacts");
const fixtureDirectory = join(
  artifactDirectory,
  "upload-verification-fixtures",
);
await mkdir(fixtureDirectory, { recursive: true });
const privateMarker = "LUMEN_UPLOAD_PRIVATE_VERIFY_71C9";
const passages = [
  "The Lumen research station is located on Alder Island. Its backup generator uses hydrogen fuel. The emergency assembly point is the North Courtyard.",
  "The botanical laboratory grows basil and mint in a glass greenhouse. Researchers water the plants every morning and record their growth in a field notebook.",
  "The observatory telescope studies bright stars after sunset. A red lamp preserves the astronomers night vision, and the dome closes when rain is detected.",
  "The coastal weather team measures wind speed, air temperature, and rainfall. A blue instrument shelter protects the sensors from direct sunshine.",
  "The library stores expedition maps in a flat wooden cabinet. Visitors may borrow reference books after signing the checkout register at the front desk.",
  "The island ferry arrives at the west pier on Tuesday mornings. Cargo crates are unloaded before passengers leave the vessel, and life jackets remain beside every seat.",
  "The animal care team feeds rescued seabirds in a quiet enclosure. A veterinarian checks each bird before release, and observers record its flight behavior.",
  "The workshop repairs metal tools with a small electric lathe. Protective goggles and closed shoes are required, and sharp tools return to a labeled storage rack.",
  "The freshwater tank collects filtered rainwater from the laboratory roof. A maintenance technician tests the water before it enters the drinking supply.",
  "The kitchen serves lentil soup and fresh bread at noon. Food scraps go to the sealed compost bin, while clean glass jars are reused for dry ingredients.",
  "The geology team samples dark basalt beside the north cliff. Rock fragments receive waterproof labels with location, date, and the collectors initials.",
  "The classroom contains six adjustable chairs and a large whiteboard. Students practice plotting coordinates before entering the field for their mapping exercise.",
  "The communications room receives marine radio messages on a dedicated antenna. Operators write important instructions in the log and repeat coordinates for confirmation.",
  "The solar array faces the southern sky and charges a bank of storage batteries. Technicians remove salt from the panel surfaces during scheduled maintenance.",
  "The wildlife trail crosses a low wooden bridge above the marsh. Visitors remain on the marked path so that nesting animals are not disturbed.",
  "The chemistry cabinet contains sealed bottles arranged by compatibility. Every container has a label, and laboratory waste follows the posted collection procedure.",
  "The cycling shed holds bicycles with bright reflectors and working brakes. Riders check tire pressure and fasten their helmets before leaving the station.",
  "The photography team records tide pools with a waterproof camera. A measuring scale appears beside each specimen, and the images retain their observation dates.",
  "The seed archive keeps labeled packets in a cool dry room. Researchers record the collection site and compare germination results between growing seasons.",
  "The conservation team restores dune vegetation using native grasses. Temporary fencing protects the young plants from foot traffic until their roots are established.",
];

// Minimal, deterministic ASCII PDF fixture. Every page contains one short,
// readable paragraph, so page-aware chunking yields exactly one chunk per page.
function pdfBytes(texts) {
  const objects = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pageIds = [];
  const escaped = (text) =>
    text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  for (const text of texts) {
    const pageId = objects.length;
    const streamId = pageId + 1;
    pageIds.push(pageId);
    const lines = text
      .match(/.{1,76}(?:\s|$)/g)
      ?.map((line) => line.trim()) || [text];
    const commands = `BT /F1 11 Tf 48 742 Td 17 TL ${lines.map((line, index) => `${index ? "T* " : ""}(${escaped(line)}) Tj`).join("\n")} ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`,
    );
  }
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  let result = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets.push(Buffer.byteLength(result));
    result += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(result);
}

const paths = {
  one: join(fixtureDirectory, "lumen-one-private.txt"),
  two: join(fixtureDirectory, "lumen-two-private.pdf"),
  fiveA: join(fixtureDirectory, "lumen-five-a-private.pdf"),
  fiveB: join(fixtureDirectory, "lumen-five-b-private.pdf"),
  twenty: join(fixtureDirectory, "lumen-twenty-private.pdf"),
};
const pageText = (text, index) =>
  `Page ${index + 1}. ${text} Verification reference ${privateMarker}.`;
await writeFile(paths.one, pageText(passages[0], 0));
await writeFile(paths.two, pdfBytes(passages.slice(0, 2).map(pageText)));
await writeFile(paths.fiveA, pdfBytes(passages.slice(0, 2).map(pageText)));
await writeFile(paths.fiveB, pdfBytes(passages.slice(2, 5).map(pageText)));
await writeFile(paths.twenty, pdfBytes(passages.map(pageText)));

const context = await chromium.launchPersistentContext(
  process.env.UPLOAD_PROFILE_DIR ||
    process.env.REAL_PROFILE_DIR ||
    join(tmpdir(), "vector-space-explorer-real-verify-profile"),
  {
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1100 },
  },
);
const page = await context.newPage();
const report = {
  started: new Date().toISOString(),
  browser: context.browser().version(),
  stages: [],
  privacyLeaks: [],
  pageErrors: [],
};
page.on("pageerror", (error) => report.pageErrors.push(error.message));
const privateProbes = [
  privateMarker,
  "Lumen research station",
  "hydrogen fuel",
  ...Object.values(paths).map((path) => path.split(/[\\/]/).pop()),
];
await context.route("**/*", async (route) => {
  const request = route.request();
  const payload = `${request.url()}\n${request.postData() || ""}`;
  if (
    privateProbes.some(
      (probe) =>
        payload.includes(probe) || payload.includes(encodeURIComponent(probe)),
    )
  ) {
    report.privacyLeaks.push({ url: request.url(), method: request.method() });
    await route.abort("blockedbyclient");
  } else await route.continue();
});
await page.addInitScript(() => {
  window.uploadVerificationMessages = [];
  const NativeWorker = window.Worker;
  window.Worker = new Proxy(NativeWorker, {
    construct(target, args) {
      const worker = Reflect.construct(target, args);
      worker.addEventListener("message", (event) => {
        const patch = event.data?.patch;
        if (!patch) return;
        window.uploadVerificationMessages.push({
          at: Date.now(),
          id: event.data.id,
          ...patch,
          queryVector: undefined,
          queryVectorLength: patch.queryVector?.length,
        });
      });
      return worker;
    },
  });
});

async function snapshotCache() {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (
      !databases.some(
        (database) => database.name === "vector-space-real-embeddings",
      )
    )
      return [];
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("vector-space-real-embeddings", 1);
      request.onsuccess = () => {
        const db = request.result;
        const keys = db
          .transaction("vectors", "readonly")
          .objectStore("vectors")
          .getAllKeys();
        keys.onsuccess = () => {
          resolve(keys.result.map(String).sort());
          db.close();
        };
        keys.onerror = () => reject(keys.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

async function waitReady(stage, count, afterIndex = 0, answer = false) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < 360000) {
    const status = (await page.locator(".real-status").allTextContents())
      .join("")
      .trim();
    const message = (
      await page.locator(".real-progress-label").allTextContents()
    ).join(" ");
    const sceneCount = Number(
      await page.locator(".scene-webgl").getAttribute("data-scene-point-count"),
    );
    const summary = `${status} ${message} points=${sceneCount}`;
    if (summary !== last) {
      console.log(`${stage}: ${summary}`);
      last = summary;
    }
    if (status === "Error")
      throw Error(await page.locator(".real-error").innerText());
    const observed = await page.evaluate(
      ({ afterIndex, answer }) =>
        window.uploadVerificationMessages
          .slice(afterIndex)
          .some(
            (patch) =>
              patch.status === "ready" &&
              (!answer ||
                (typeof patch.answer === "string" && patch.answer.length)),
          ),
      { afterIndex, answer },
    );
    if (status === "Ready" && sceneCount === count && observed) {
      report.stages.push({ stage, count, elapsedMs: Date.now() - start });
      return;
    }
    await page.waitForTimeout(500);
  }
  throw Error(`${stage} timed out`);
}

async function latestDocuments(afterIndex = 0) {
  return page.evaluate(
    (after) =>
      [...window.uploadVerificationMessages.slice(after)]
        .reverse()
        .find((patch) => patch.documents?.length)?.documents || [],
    afterIndex,
  );
}

async function searchOwnCorpus(count) {
  await page
    .getByLabel("Ask about an idea", { exact: true })
    .fill("What fuel does the Lumen research station backup generator use?");
  const after = await page.evaluate(
    () => window.uploadVerificationMessages.length,
  );
  await page.getByRole("button", { name: /Search by meaning/ }).click();
  await page.waitForFunction(
    (index) =>
      window.uploadVerificationMessages
        .slice(index)
        .some(
          (patch) => patch.queryVectorLength === 384 && patch.results?.length,
        ),
    after,
    { timeout: 120000 },
  );
  await waitReady("uploaded semantic query", count, after);
  const result = await page.evaluate(
    (index) =>
      [...window.uploadVerificationMessages.slice(index)]
        .reverse()
        .find((patch) => patch.results?.length)?.results[0],
    after,
  );
  assert(
    result.document.source?.fileName,
    "Retrieved source must belong to an imported file.",
  );
  assert.match(result.document.text, /hydrogen fuel/i);
  assert(Number.isFinite(result.score));
  report.stages.push({
    stage: "retrieved own source",
    count,
    title: result.document.title,
    score: result.score,
    source: result.document.source,
  });
  return result;
}

async function generateOwnAnswer(count) {
  const after = await page.evaluate(
    () => window.uploadVerificationMessages.length,
  );
  await page
    .getByRole("button", { name: /Generate answer from sources/ })
    .click();
  await waitReady("actual uploaded-document RAG", count, after, true);
  const generated = await page.evaluate(
    (index) =>
      [...window.uploadVerificationMessages.slice(index)]
        .reverse()
        .find(
          (patch) => typeof patch.answer === "string" && patch.answer.length,
        ),
    after,
  );
  assert.match(generated.answer, /hydrogen/i);
  const documents = await latestDocuments();
  const sources = generated.contextIds.map((id) =>
    documents.find((document) => document.id === id),
  );
  assert(
    sources.length > 0 &&
      sources.every((document) => document?.source?.fileName),
    "Every generated context ID must identify an imported source.",
  );
  const visibleSources = await page
    .locator(".real-source-links button")
    .allInnerTexts();
  assert(
    visibleSources.every(
      (source) => source.includes("lumen-") && source.includes("chunk"),
    ),
  );
  if (count === 20)
    assert(
      visibleSources.every((source) => source.includes("p. ")),
      "PDF answer links must retain page references.",
    );
  report.stages.push({
    stage: "generated own answer",
    count,
    answer: generated.answer,
    sources: sources.map((document) => document.source),
    visibleSources,
  });
}

async function pickAnotherUploadPoint() {
  const before = await page.locator(".real-source-metadata code").innerText();
  const points = await page.evaluate(
    () =>
      [...window.uploadVerificationMessages]
        .reverse()
        .find((patch) => patch.points?.length === 20)?.points || [],
  );
  const camera = JSON.parse(
    await page.locator(".scene-webgl").getAttribute("data-scene-camera"),
  );
  const box = await page.locator(".scene-webgl canvas").boundingBox();
  const targets = await page.evaluate(
    ({ points, camera }) => {
      const dot = (a, b) =>
        a.reduce((sum, value, index) => sum + value * b[index], 0);
      const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const normalized = (a) => {
        const length = Math.hypot(...a);
        return a.map((value) => value / length);
      };
      const forward = normalized(
        camera.target.map((value, index) => value - camera.position[index]),
      );
      const right = normalized(cross(forward, [0, 0, 1])),
        up = cross(right, forward),
        tangent = Math.tan((20 * Math.PI) / 180);
      return points
        .map((point) => {
          const delta = point.position.map(
              (value, index) => value - camera.position[index],
            ),
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
            point.x > 35 &&
            point.x < camera.width - 35 &&
            point.y > 60 &&
            point.y < camera.height - 90,
        );
    },
    { points, camera },
  );
  for (const target of targets) {
    await page.mouse.click(box.x + target.x, box.y + target.y);
    await page.waitForTimeout(100);
    const after = await page.locator(".real-source-metadata code").innerText();
    if (after !== before) {
      const documents = await latestDocuments();
      const selected = documents.find(
        (document) => `[${document.id}]` === after,
      );
      assert(selected?.source?.fileName);
      const visible = await page.locator(".real-selected-document").innerText();
      assert(
        visible.includes(selected.source.fileName) &&
          visible.includes(`page ${selected.source.page}`) &&
          visible.includes(`chunk ${selected.source.chunk}`),
      );
      report.pointSelection = { before, after, source: selected.source };
      return;
    }
  }
  throw Error(
    "Clicking an uploaded cloud point did not update the source inspector.",
  );
}

try {
  await page.goto(
    process.env.UPLOAD_TEST_BASE_URL ||
      process.env.REAL_TEST_BASE_URL ||
      "http://127.0.0.1:5174",
  );
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page
    .getByRole("button", { name: "Real embeddings", exact: true })
    .click();
  report.fixtureFiles = Object.values(paths).map((path) =>
    path.split(/[\\/]/).pop(),
  );
  await waitReady("sample model warmup", 120);
  const cacheBefore = await snapshotCache();
  const cases = [
    { count: 1, files: [paths.one] },
    { count: 2, files: [paths.two] },
    { count: 5, files: [paths.fiveA, paths.fiveB] },
    { count: 20, files: [paths.twenty] },
  ];
  for (const fixture of cases) {
    const after = await page.evaluate(
      () => window.uploadVerificationMessages.length,
    );
    await page
      .getByLabel("Choose PDF or text files", { exact: true })
      .setInputFiles(fixture.files);
    await waitReady(
      `import ${fixture.count} real chunks`,
      fixture.count,
      after,
    );
    const documents = await latestDocuments(after);
    assert.equal(documents.length, fixture.count);
    const expectedNames = fixture.files.map((path) =>
      path.split(/[\\/]/).pop(),
    );
    assert(
      documents.every((document) =>
        expectedNames.includes(document.source?.fileName),
      ),
      "Imported corpora must never include sample documents.",
    );
    assert(documents.every((document) => document.source.chunk === 1));
    for (const document of documents)
      if (document.source.fileName.endsWith(".pdf"))
        assert(
          Number.isInteger(document.source.page) && document.source.page >= 1,
        );
    const lastPoints = await page.evaluate(
      (index) =>
        [...window.uploadVerificationMessages.slice(index)]
          .reverse()
          .find((patch) => patch.points?.length)?.points || [],
      after,
    );
    assert.equal(lastPoints.length, fixture.count);
    assert(
      lastPoints.every(
        (point) =>
          point.position.length === 3 && point.position.every(Number.isFinite),
      ),
    );
    const fileColors = new Map(
      documents.map((document) => [document.source.fileName, document.color]),
    );
    assert.equal(
      new Set(fileColors.values()).size,
      fixture.files.length,
      "Each source file must have its own color.",
    );
    await page.getByLabel("NUMBER OF POINTS", { exact: true }).fill("500");
    await page.getByLabel("NUMBER OF POINTS", { exact: true }).press("Enter");
    await waitReady(
      `point limit clips to ${fixture.count} chunks`,
      fixture.count,
    );
    assert.equal(
      await page.getByLabel("NUMBER OF POINTS", { exact: true }).inputValue(),
      String(fixture.count),
    );
    await searchOwnCorpus(fixture.count);
    if (fixture.count === 1 || fixture.count === 20)
      await generateOwnAnswer(fixture.count);
    report.stages.push({
      stage: "verified imported corpus",
      count: fixture.count,
      sources: documents.map((document) => document.source),
      colors: Object.fromEntries(fileColors),
    });
  }
  const cacheAfter = await snapshotCache();
  assert.deepEqual(
    cacheAfter,
    cacheBefore,
    "Uploaded vectors and content must not be saved into the sample IndexedDB cache.",
  );
  report.cacheKeysUnchanged = true;
  report.cachedVectorCount = cacheBefore.length;
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
    });
  await page.screenshot({
    path: join(artifactDirectory, "upload-20-desktop.png"),
    fullPage: true,
  });
  await page
    .locator(".scene-card")
    .screenshot({ path: join(artifactDirectory, "upload-20-scene.png") });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  report.accessibility = accessibility.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target),
  }));
  assert.deepEqual(report.accessibility, []);
  await pickAnotherUploadPoint();
  await page.locator(".real-answer").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(artifactDirectory, "upload-20-rag-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".scene-card").scrollIntoViewIfNeeded();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({
    path: join(artifactDirectory, "upload-20-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /Use sample documents/ }).click();
  await waitReady("return to 120 sample documents", 120);
  const samples = await latestDocuments();
  assert.equal(samples.length, 120);
  assert(samples.every((document) => !document.source));
  report.messages = await page.evaluate(
    () => window.uploadVerificationMessages,
  );
  assert.deepEqual(report.privacyLeaks, []);
  assert.deepEqual(report.pageErrors, []);
  report.success = true;
  report.completed = new Date().toISOString();
  console.log(
    JSON.stringify(
      {
        success: true,
        stages: report.stages,
        cacheKeysUnchanged: true,
        privacyLeaks: report.privacyLeaks,
        accessibility: report.accessibility,
      },
      null,
      2,
    ),
  );
} catch (error) {
  report.error = error.message;
  await page
    .screenshot({
      path: join(artifactDirectory, "upload-verification-error.png"),
      fullPage: true,
    })
    .catch(() => {});
  throw error;
} finally {
  await writeFile(
    join(artifactDirectory, "upload-verification.json"),
    JSON.stringify(report, null, 2),
  );
  await context.close();
}
