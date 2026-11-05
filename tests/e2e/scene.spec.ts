import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function pixelDifference(page: Page, first: Buffer, second: Buffer) {
  return page.evaluate(
    async ([a, b]) => {
      const read = async (base64: string) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const [left, right] = await Promise.all([read(a), read(b)]);
      if (left.length !== right.length) return 1;
      let different = 0;
      for (let i = 0; i < left.length; i += 4) {
        if (
          Math.abs(left[i] - right[i]) +
            Math.abs(left[i + 1] - right[i + 1]) +
            Math.abs(left[i + 2] - right[i + 2]) >
          24
        )
          different++;
      }
      return different / (left.length / 4);
    },
    [first.toString("base64"), second.toString("base64")],
  );
}

test("camera orbit changes the view, reset reproduces it, and calculations stay unchanged", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".scene-webgl")).toHaveAttribute(
    "data-scene-fps",
    /\d+/,
  );
  const canvas = page.locator(".scene-webgl canvas");
  const answer = await page.getByTestId("result-value").innerText();
  const first = await canvas.screenshot();
  console.log(
    "FIRST_CAMERA",
    await page.locator(".scene-webgl").getAttribute("data-scene-camera"),
  );
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.67, {
    steps: 15,
  });
  await page.mouse.up();
  await page.waitForTimeout(900); // OrbitControls damping must settle before pixel comparison.
  const orbited = await canvas.screenshot();
  expect(await pixelDifference(page, first, orbited)).toBeGreaterThan(0.003);
  await expect(page.getByTestId("result-value")).toHaveText(answer);
  await page
    .getByRole("button", { name: "Reset camera view", exact: true })
    .click();
  await page.waitForTimeout(1500);
  const reset = await canvas.screenshot();
  console.log(
    "RESET_CAMERA",
    await page.locator(".scene-webgl").getAttribute("data-scene-camera"),
  );
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/desktop-polished.png",
    fullPage: true,
  });
  await test
    .info()
    .attach("initial-camera", { body: first, contentType: "image/png" });
  await test
    .info()
    .attach("reset-camera", { body: reset, contentType: "image/png" });
  console.log(
    `CAMERA_DIFF ${JSON.stringify({ orbit: await pixelDifference(page, first, orbited), reset: await pixelDifference(page, first, reset) })}`,
  );
  expect(await pixelDifference(page, first, reset)).toBeLessThan(0.005);
  await expect(page.getByTestId("result-value")).toHaveText(answer);
  expect(errors).toEqual([]);
});

test("camera scene resources remain stable after repeated lesson edits and lab switches", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const scene = page.locator(".scene-webgl");
  await expect(scene).toHaveAttribute("data-scene-geometries", /\d+/);
  const baseline = Number(await scene.getAttribute("data-scene-geometries"));
  for (let round = 0; round < 4; round++) {
    for (const operation of ["span", "basis", "project", "nullspace", "add"]) {
      await page.getByLabel("Choose an operation").selectOption(operation);
    }
    await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
    await page
      .getByRole("button", { name: "Vector Math Lab", exact: true })
      .click();
    await page
      .getByLabel("Vector u x", { exact: true })
      .fill(String(round + 2));
  }
  await page.getByLabel("Vector u x", { exact: true }).fill("1");
  await expect
    .poll(
      async () => Number(await scene.getAttribute("data-scene-geometries")),
      { timeout: 6000 },
    )
    .toBe(baseline);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByTestId("result-value")).toHaveText("(3, 1, 2)");
  const metrics = await scene.evaluate((element) => ({
    fps: (element as HTMLElement).dataset.sceneFps,
    geometries: (element as HTMLElement).dataset.sceneGeometries,
    textures: (element as HTMLElement).dataset.sceneTextures,
  }));
  console.log(
    `SCENE_METRICS ${JSON.stringify({ browser: "installed Google Chrome, automated desktop 1440x1100", baselineGeometries: baseline, ...metrics })}`,
  );
  expect(errors).toEqual([]);
});

test("camera mobile view fits its container and has visible geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".scene-webgl")).toHaveAttribute(
    "data-scene-fps",
    /\d+/,
  );
  const canvas = (await page.locator(".scene-webgl canvas").boundingBox())!;
  const viewport = (await page.locator(".scene-viewport").boundingBox())!;
  expect(Math.abs(canvas.height - viewport.height)).toBeLessThan(1);
  expect(canvas.width).toBeLessThanOrEqual(390);
  await page.locator(".scene-card").scrollIntoViewIfNeeded();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/mobile-polished.png",
    fullPage: true,
  });
  await expect(page.getByTestId("result-value")).toHaveText("(3, 1, 2)");
});
