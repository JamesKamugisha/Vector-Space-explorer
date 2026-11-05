import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const baseUrl = process.env.PROFILE_BASE_URL || "http://127.0.0.1:5174";
const readMetrics = () =>
  page.locator(".scene-webgl").evaluate((element) => ({
    fps: Number(element.dataset.sceneFps),
    geometries: Number(element.dataset.sceneGeometries),
    textures: Number(element.dataset.sceneTextures),
  }));
try {
  await page.goto(`${baseUrl}/tests/fixtures/scene-performance.html`);
  await page.locator(".scene-webgl[data-scene-fps]").waitFor();
  assert.equal(await page.evaluate(() => window.sceneProfile.pointCount), 500);
  const environment = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    devicePixelRatio: window.devicePixelRatio,
    viewport: [window.innerWidth, window.innerHeight],
  }));
  const samples = [];
  for (let index = 0; index < 3; index++) {
    await page.waitForTimeout(1100);
    samples.push(await readMetrics());
  }
  const canvas = page.locator("canvas");
  const cameraBeforeOrbit = JSON.parse(
    await page.locator(".scene-webgl").getAttribute("data-scene-camera"),
  );
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65, {
    steps: 20,
  });
  await page.mouse.up();
  await page.waitForTimeout(1300);
  const afterOrbit = await readMetrics();
  const cameraAfterOrbit = JSON.parse(
    await page.locator(".scene-webgl").getAttribute("data-scene-camera"),
  );
  const cameraTravel = Math.hypot(
    ...cameraAfterOrbit.position.map(
      (value, index) => value - cameraBeforeOrbit.position[index],
    ),
  );
  assert(cameraTravel > 0.1, "Orbit interaction must move the camera.");
  const baselineGeometries = samples[0].geometries;
  assert(
    baselineGeometries > 0 && baselineGeometries < 120,
    "Instanced point workload should have bounded geometry count.",
  );
  const remounts = [];
  for (let index = 0; index < 3; index++) {
    await page.evaluate(() => window.sceneProfile.unmount());
    await page.waitForFunction(
      () => document.querySelectorAll("canvas").length === 0,
    );
    await page.evaluate(() => window.sceneProfile.mount());
    await page.locator(".scene-webgl[data-scene-fps]").waitFor();
    assert.equal(await page.locator("canvas").count(), 1);
    const metrics = await readMetrics();
    assert.equal(
      metrics.geometries,
      baselineGeometries,
      "Remount must restore the same resource count.",
    );
    remounts.push(metrics);
  }
  assert.deepEqual(pageErrors, []);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/performance-500-dots.png",
    fullPage: true,
  });
  await page.evaluate(() => window.sceneProfile.unmount());
  await page.waitForFunction(
    () => document.querySelectorAll("canvas").length === 0,
  );
  const report = {
    pointCount: 500,
    browserVersion: browser.version(),
    environment,
    samples,
    afterOrbit,
    cameraTravel,
    remounts,
    canvasCountAfterCleanup: await page.locator("canvas").count(),
    pageErrors,
    note: "Synthetic seeded local workload in automated installed Chrome. FPS is a sample from this host, not a universal performance guarantee.",
  };
  await writeFile(
    "artifacts/scene-performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
