import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

async function expectSceneFit(page: Page, height: number) {
  const scene = (await page.locator(".scene-card").boundingBox())!;
  const canvas = (await page.locator(".scene-webgl canvas").boundingBox())!;
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(scene.y).toBeGreaterThan(0);
  expect(scene.y + scene.height).toBeLessThanOrEqual(height - 6);
  expect(canvas.height).toBeGreaterThanOrEqual(220);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("full scene fits short laptops and desktops without page scrolling in both labs", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await context.route("https://huggingface.co/**", (route) => route.abort());
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
    [1280, 720],
    [1024, 768],
    [1280, 600],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expectSceneFit(page, height);
    await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
    await expectSceneFit(page, height);
    await page
      .getByRole("button", { name: "Real embeddings", exact: true })
      .click();
    await expectSceneFit(page, height);
  }
});

test("phone and portrait tablet start with a visible scene and expandable usable controls", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await context.route("https://huggingface.co/**", (route) => route.abort());
  await mkdir("artifacts", { recursive: true });
  for (const [width, height] of [
    [390, 844],
    [375, 812],
    [320, 740],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Experiment controls/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expectSceneFit(page, height);
    await page.screenshot({ path: `artifacts/responsive-math-${width}.png` });
    await toggle.click();
    await page.getByLabel("Choose an operation").selectOption("scale");
    await expect(
      page.getByRole("heading", { name: "Scalar multiplication", exact: true }),
    ).toBeVisible();
    await toggle.click();
    await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
    await expectSceneFit(page, height);
    await toggle.click();
    await page
      .getByRole("button", { name: "Real embeddings", exact: true })
      .click();
    await expect(page.getByLabel("Choose PDF or text files")).toBeAttached();
    await toggle.click();
    await expectSceneFit(page, height);
    await page.screenshot({ path: `artifacts/responsive-ai-${width}.png` });
    if (width === 390) {
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
    }
  }
});

test("phone touch gestures orbit and zoom the actual 3D scene", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    const host = page.locator(".scene-webgl");
    await expect(host).toHaveAttribute("data-scene-camera", /position/);
    const camera = async () =>
      JSON.parse((await host.getAttribute("data-scene-camera"))!) as {
        position: number[];
        target: number[];
      };
    const start = await camera();
    const box = (await page.locator(".scene-webgl canvas").boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let step = 1; step <= 8; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + step * 8, y: y + step * 2, id: 1 }],
      });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () =>
        Math.hypot(
          ...(await camera()).position.map(
            (value, i) => value - start.position[i],
          ),
        ),
      )
      .toBeGreaterThan(0.5);
    const radius = async () => {
      const value = await camera();
      return Math.hypot(
        ...value.position.map((axis, i) => axis - value.target[i]),
      );
    };
    const beforeZoom = await radius();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 25, y, id: 1 },
        { x: x + 25, y, id: 2 },
      ],
    });
    for (let step = 1; step <= 8; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x - 25 - step * 4, y, id: 1 },
          { x: x + 25 + step * 4, y, id: 2 },
        ],
      });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(radius).toBeLessThan(beforeZoom * 0.9);
    await expectSceneFit(page, 844);
    await expect(page.getByTestId("result-value")).toHaveText("(3, 1, 2)");
  } finally {
    await context.close();
  }
});
