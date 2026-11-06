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

test("scene vector clicks select visible arrows and an orbit drag does not select", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.locator(".scene-webgl");
  await expect(scene).toHaveAttribute("data-scene-vector-targets", /"v"/);
  const targets = JSON.parse(
    (await scene.getAttribute("data-scene-vector-targets"))!,
  );
  const box = (await page.locator(".scene-webgl canvas").boundingBox())!;
  await page.mouse.click(box.x + targets.v[0], box.y + targets.v[1]);
  await expect(scene).toHaveAttribute("data-scene-selected-vector", "v");
  await page.mouse.move(box.x + targets.u[0], box.y + targets.u[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.7, {
    steps: 15,
  });
  await page.mouse.move(box.x + targets.u[0], box.y + targets.u[1], {
    steps: 15,
  });
  await page.mouse.up();
  await expect(scene).toHaveAttribute("data-scene-selected-vector", "v");
});

test("scene norm shells retain magnitude while the unit sphere stays radius one", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.locator(".scene-webgl");
  await page.getByRole("button", { name: "Norm shells", exact: true }).click();
  await page.getByRole("button", { name: "Unit sphere", exact: true }).click();
  await page
    .getByRole("button", { name: "Reference planes", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-scene-norm-shells", "2");
  await expect(scene).toHaveAttribute("data-scene-reference-planes", "2");
  const radii = JSON.parse(
    (await scene.getAttribute("data-scene-norm-radii"))!,
  );
  expect(radii[0]).toBeCloseTo(Math.sqrt(6));
  expect(radii[1]).toBeCloseTo(Math.sqrt(6));
  await page.getByLabel("Vector u x", { exact: true }).fill("3");
  await expect
    .poll(
      async () =>
        JSON.parse((await scene.getAttribute("data-scene-norm-radii"))!)[0],
    )
    .toBeCloseTo(Math.sqrt(14));
  await expect(scene).toHaveAttribute("data-scene-unit-sphere-radius", "1");
});

test("scene basis reconstruction and Gram subtraction animate actual reusable arrows", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.locator(".scene-webgl");
  const values = async () =>
    JSON.parse((await scene.getAttribute("data-scene-vector-values")) || "{}");
  await page.getByLabel("Choose an operation").selectOption("basis");
  await page.getByRole("button", { name: "A new coordinate system" }).click();
  await expect.poll(async () => (await values()).result).toEqual([3, 2, 4]);
  const basisUpdates = await scene.getAttribute("data-scene-static-updates");
  await page.locator(".steps-list > li button").nth(0).click();
  await expect.poll(async () => (await values()).result[0]).toBeCloseTo(0.6);
  expect((await values()).result[1]).toBe(0);
  await expect(scene).toHaveAttribute(
    "data-scene-static-updates",
    basisUpdates!,
  );
  await page.locator(".steps-list > li button").nth(4).click();
  await expect.poll(async () => (await values()).result).toEqual([3, 2, 4]);
  await page.getByLabel("Choose an operation").selectOption("gramSchmidt");
  await page
    .getByRole("button", { name: "Orthogonalize", exact: true })
    .click();
  await expect
    .poll(async () => (await values()).secondary?.[0])
    .toBeCloseTo(1 / Math.sqrt(2));
  const gramUpdates = await scene.getAttribute("data-scene-static-updates");
  await page.locator(".steps-list > li button").nth(2).click();
  await expect
    .poll(async () => (await values()).secondary?.[0])
    .toBeCloseTo(0.8);
  await expect
    .poll(async () => (await values()).secondary?.[1])
    .toBeCloseTo(-0.2);
  await page.locator(".steps-list > li button").nth(4).click();
  await expect
    .poll(async () => Math.hypot(...(await values()).secondary))
    .toBeCloseTo(1);
  await expect(scene).toHaveAttribute(
    "data-scene-static-updates",
    gramUpdates!,
  );
});

test("scene AI geometry is retained across query changes and reranking", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  const scene = page.locator(".scene-webgl");
  await expect(scene).toHaveAttribute("data-scene-point-count", "8");
  const generation = await scene.getAttribute(
    "data-scene-embedding-generation",
  );
  await page
    .getByLabel("What would you like to find?", { exact: true })
    .fill("vacation policy");
  await expect(scene).toHaveAttribute(
    "data-scene-embedding-generation",
    generation!,
  );
  await page.getByRole("button", { name: /Euclidean/ }).click();
  await expect(scene).toHaveAttribute(
    "data-scene-embedding-generation",
    generation!,
  );
  await expect(scene).toHaveAttribute("data-scene-point-count", "8");
});

test("scene dense-cloud labels remain separate and inside reserved viewport bounds", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    if (viewport.width === 390)
      await page.getByRole("button", { name: /Experiment controls/ }).click();
    await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
    await page.getByLabel(/number of points/i).fill("500");
    await page.getByLabel("Plot normalized directions").check();
    await expect(page.locator(".scene-webgl")).toHaveAttribute(
      "data-scene-point-count",
      "500",
    );
    await expect(page.locator(".scene-object-label.selected")).toBeVisible();
    const boxes = await page
      .locator(".scene-object-label")
      .evaluateAll((elements) =>
        elements
          .map((element) => {
            const box = element.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          })
          .filter((box) => box.width && box.height),
      );
    const canvas = (await page.locator(".scene-webgl canvas").boundingBox())!;
    expect(boxes.length).toBeGreaterThan(3);
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      expect(a.x).toBeGreaterThanOrEqual(canvas.x + 7);
      expect(a.x + a.width).toBeLessThanOrEqual(canvas.x + canvas.width - 7);
      expect(a.y).toBeGreaterThanOrEqual(canvas.y + 47);
      expect(a.y + a.height).toBeLessThanOrEqual(canvas.y + canvas.height - 77);
      for (const b of boxes.slice(i + 1))
        expect(
          a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y,
        ).toBe(false);
    }
    await page.locator(".scene-card").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/ai500-labels-${viewport.width}.png`,
      fullPage: true,
    });
  }
});

test("scene reset fits only visible lesson data and normalized AI coordinates", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.locator(".scene-webgl");
  const camera = async () =>
    JSON.parse((await scene.getAttribute("data-scene-camera")) || "{}");
  await expect(scene).toHaveAttribute("data-scene-camera", /extent/);
  const initial = await camera();
  await page.getByLabel("Vector u x", { exact: true }).fill("1.1");
  await expect
    .poll(async () => (await camera()).extent)
    .not.toBe(initial.extent);
  expect((await camera()).position).toEqual(initial.position);
  await page.getByLabel("Vector u x", { exact: true }).fill("1000000");
  await page.getByLabel("Choose an operation").selectOption("basis");
  await page
    .getByRole("button", { name: "Reset camera view", exact: true })
    .click();
  await expect.poll(async () => (await camera()).extent).toBeLessThan(20);
  const targets = JSON.parse(
    (await scene.getAttribute("data-scene-vector-targets"))!,
  );
  const canvas = (await page.locator(".scene-webgl canvas").boundingBox())!;
  for (const [x, y] of Object.values(targets) as number[][]) {
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(canvas.width);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(canvas.height);
  }
  await page.getByLabel("b1 x", { exact: true }).fill("1000000");
  await page.getByLabel("Target x x", { exact: true }).fill("1000000");
  await expect
    .poll(async () => (await camera()).extent)
    .toBeGreaterThan(100000);
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page
    .getByRole("button", { name: "Reset camera view", exact: true })
    .click();
  await expect.poll(async () => (await camera()).extent).toBeLessThan(20);
  await page
    .getByLabel("What would you like to find?", { exact: true })
    .fill("password ".repeat(40));
  await page.getByLabel("Plot normalized directions").check();
  await page
    .getByRole("button", { name: "Reset camera view", exact: true })
    .click();
  await expect.poll(async () => (await camera()).extent).toBe(2.6);
});
