import { test, expect } from "@playwright/test";

test("live math, overlays, and every lesson remain synchronized", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("result-value")).toHaveText("(3, 1, 2)");
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByLabel("Vector u y", { exact: true }).fill("3");
  await expect(page.getByTestId("result-value")).toHaveText("(3, 2, 2)");
  await page.getByRole("button", { name: "Unit sphere", exact: true }).click();
  await expect(page.getByTestId("result-value")).toHaveText("(3, 2, 2)");
  for (const operation of [
    "scale",
    "combination",
    "normalize",
    "span",
    "independence",
    "project",
    "basis",
    "dot",
    "cross",
    "gramSchmidt",
    "nullspace",
  ]) {
    await page.getByLabel("Choose an operation").selectOption(operation);
    await expect(page.getByTestId("result-value")).not.toBeEmpty();
    await expect(page.getByTestId("result-value")).not.toContainText("NaN");
    await expect(page.locator("canvas")).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test("normalization and zero vector have correct outcomes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Choose an operation").selectOption("normalize");
  await page.getByRole("button", { name: "3–4–5 triangle" }).click();
  await expect(page.getByTestId("result-value")).toContainText("(0.6, 0.8, 0)");
  await page.getByRole("button", { name: "Zero vector", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/zero|undefined/i);
  await expect(page.getByTestId("result-value")).not.toContainText("NaN");
});

test("span, projection, basis and nullspace fixtures match source specification", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Choose an operation").selectOption("span");
  await page.getByRole("button", { name: "A plane", exact: true }).click();
  await expect(page.getByTestId("result-value")).toContainText(/plane|2/i);
  await page.getByRole("button", { name: "A line", exact: true }).click();
  await expect(page.getByTestId("result-value")).toContainText(/line|1/i);
  await page.getByLabel("Choose an operation").selectOption("project");
  await page.getByRole("button", { name: "See the perpendicular" }).click();
  await expect(page.getByTestId("result-value")).toHaveText("(2, 2, 0)");
  await page.getByLabel("Choose an operation").selectOption("basis");
  await page.getByRole("button", { name: "A new coordinate system" }).click();
  await expect(page.getByTestId("result-value")).toHaveText("c = (1, 2, 4)");
  await page.getByLabel("Choose an operation").selectOption("nullspace");
  await page
    .getByRole("button", { name: "A solution line", exact: true })
    .click();
  await expect(page.getByTestId("result-value")).toContainText("(1, 1, 1)");
});

test("step player cancels on edits and handles manual stepping", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play steps", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Vector u x", { exact: true }).fill("4");
  await expect(
    page.getByRole("button", { name: "Play steps", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Explore at your own pace", { exact: true }),
  ).toBeVisible();
  await page.getByTestId("step-3").click();
  await expect(page.getByText("Step 3 of 4", { exact: true })).toBeVisible();
});

test("AI metric switch changes computed ranking and RAG keeps source provenance", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page
    .getByLabel("What would you like to find?", { exact: true })
    .fill("reset password");
  await expect(page.locator(".ai-document-row").first()).toContainText(
    /password/i,
  );
  await page.getByRole("button", { name: /Euclidean/ }).click();
  await expect(page.locator(".ai-document-row").first()).toContainText(/sign/i);
  await page.getByRole("button", { name: /Cosine/ }).click();
  await page.locator(".ai-rag-details summary").click();
  await page.getByRole("button", { name: /Retrieve/ }).click();
  await page.getByRole("button", { name: /Context/ }).click();
  await page.getByRole("button", { name: /Answer/ }).click();
  await expect(page.locator(".ai-rag-result")).toContainText(/password/i);
  await expect(page.locator(".ai-rag-result")).toContainText(
    /source|password/i,
  );
  await page
    .getByLabel("What would you like to find?", { exact: true })
    .fill("unrecognizedzzzz");
  await expect(page.locator(".ai-document-row")).toHaveCount(0);
  await expect(page.locator(".ai-notice")).toBeVisible();
});

test("scenario switches preserve a single scene and produce no page errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
    await expect(page.locator("canvas")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Vector Math Lab", exact: true })
      .click();
    await expect(page.locator("canvas")).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test("mobile layout has no horizontal overflow and help restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const help = page.getByRole("button", { name: "Quick guide", exact: true });
  await help.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("reduced motion skips animation and numeric output survives disabled WebGL", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.includes("webgl")) return null;
      return original.apply(this, [kind, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.getByText("3D preview is unavailable")).toBeVisible();
  await expect(page.getByTestId("result-value")).toHaveText("(3, 1, 2)");
  await page.getByRole("button", { name: "Play steps", exact: true }).click();
  await expect(page.getByText("Step 4 of 4", { exact: true })).toBeVisible();
  await context.close();
});
