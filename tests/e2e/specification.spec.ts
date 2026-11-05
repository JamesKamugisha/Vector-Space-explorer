import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("plane projection, residual inspection and real-world explanation match the calculations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Choose an operation").selectOption("planeProject");
  await page
    .getByRole("button", { name: "Project onto XY", exact: true })
    .click();
  await expect(page.getByTestId("result-value")).toHaveText("(2, 1, 0)");
  await expect(
    page.getByRole("heading", { name: "Where you might use this" }),
  ).toBeVisible();
  await page
    .getByLabel("Inspect vector", { exact: true })
    .selectOption("secondary");
  await expect(
    page.getByRole("region", { name: "Vector details" }),
  ).toContainText("(0, 0, 3)");
  await page
    .getByRole("button", { name: "Collapse to a line", exact: true })
    .click();
  await expect(page.getByTestId("result-value")).toHaveText("(2, 2, 0)");
  await expect(page.getByRole("status")).toContainText("line");
  for (const vector of ["Vector u", "Vector v"])
    for (const axis of ["x", "y", "z"])
      await page.getByLabel(`${vector} ${axis}`, { exact: true }).fill("0");
  await expect(page.getByTestId("result-value")).toHaveText("(0, 0, 0)");
  await expect(page.getByRole("status")).toContainText("origin");
});

test("keyboard vector inspector exposes norms and undefined zero directions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Vector u x", { exact: true }).fill("3");
  await page.getByLabel("Vector u y", { exact: true }).fill("4");
  await page.getByLabel("Vector u z", { exact: true }).fill("0");
  const details = page.getByRole("region", { name: "Vector details" });
  await expect(details).toContainText("(3, 4, 0)");
  await expect(details.locator("dd").nth(1)).toHaveText("5");
  await expect(details.locator("dd").nth(3)).toHaveText("90°");
  for (const axis of ["x", "y", "z"])
    await page.getByLabel(`Vector u ${axis}`, { exact: true }).fill("0");
  await expect(details.getByText("Undefined", { exact: true })).toHaveCount(2);
  await expect(details).toContainText("has no direction");
});

test("optional norm shells and reference planes do not change mathematical results", async ({
  page,
}) => {
  await page.goto("/");
  const before = await page.getByTestId("result-value").innerText();
  await page.getByRole("button", { name: "Unit sphere", exact: true }).click();
  await page.getByRole("button", { name: "Norm shells", exact: true }).click();
  await page
    .getByRole("button", { name: "Reference planes", exact: true })
    .click();
  const scene = page.locator(".scene-webgl");
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-scene-norm-shells")),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-scene-reference-planes")),
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("result-value")).toHaveText(before);
  await page.getByRole("button", { name: "Norm shells", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await scene.getAttribute("data-scene-norm-shells")),
    )
    .toBe(0);
});

test("mobile controls collapse above the scene and remain keyboard accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /Experiment controls/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(page.getByLabel("Choose an operation")).not.toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.press("Enter");
  await expect(page.getByLabel("Choose an operation")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("constructed word analogy shows actual vector arithmetic and its limitations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page
    .getByRole("button", { name: "Vector analogy", exact: true })
    .click();
  await expect(page.locator(".analogy-equation")).toContainText(
    "(3, 1, 0) = Rome",
  );
  await page.getByLabel("Analogy preset").selectOption("reverse");
  await expect(page.locator(".analogy-equation")).toContainText(
    "(3, 0, 0) = Paris",
  );
  await expect(page.locator(".analogy-lesson")).toContainText(
    "not trained embeddings",
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("instructions occupy a right sidebar and follow the selected experiment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const instructions = page.getByRole("complementary", {
    name: "Experiment instructions",
  });
  await expect(
    instructions.getByRole("heading", { name: "Instructions", exact: true }),
  ).toBeVisible();
  const scene = await page.locator(".scene-card").boundingBox();
  const rail = await instructions.boundingBox();
  expect(rail!.x).toBeGreaterThan(scene!.x + scene!.width);
  await page.getByLabel("Choose an operation").selectOption("planeProject");
  await expect(instructions).toContainText("closest point");
  await expect(page.getByRole("region", { name: "Worked steps" })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await expect(instructions).toContainText("Set the number of points");
  await page
    .getByRole("button", { name: "PCA projection", exact: true })
    .click();
  await expect(instructions).toContainText("original 4D");
});
