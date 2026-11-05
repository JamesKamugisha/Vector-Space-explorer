import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { buildCorpus, encodeQuery, rankDocuments } from "../../src/ai/model";
import { getPcaView } from "../../src/ai/pca";

test("point counts, count-vector plotting, and RAG use the same actual documents", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await page.getByLabel(/number of points/i).fill("500");
  await expect(page.locator(".ai-count-section .ai-helper")).toContainText(
    "492 deterministic synthetic points",
  );
  await expect(page.locator(".ai-ranking-section .ai-count")).toHaveText(
    "500 in corpus",
  );
  await expect(page.locator(".ai-document-row")).toHaveCount(4);
  for (const metric of ["cosine", "euclidean"] as const) {
    await page
      .getByRole("button", {
        name: metric === "cosine" ? /Cosine similarity/ : /Euclidean distance/,
      })
      .click();
    const expected = rankDocuments([2, 0, 0], metric, buildCorpus(500))[0];
    await expect(
      page.locator(".ai-document-row").first().locator("strong"),
    ).toHaveText(expected.document.title);
    await expect(
      page.locator(".ai-document-row").first().locator(".ai-score"),
    ).toContainText(expected.score!.toFixed(3));
  }
  await page.screenshot({ path: "artifacts/ai500.png", fullPage: true });
  await page.getByLabel("Plot normalized directions").check();
  await expect(page.locator(".ai-plot-note")).toContainText(
    "Rankings still use the original vectors",
  );
  await page.locator(".ai-rag-details summary").click();
  for (let index = 0; index < 3; index++)
    await page.locator(".ai-pipeline button").nth(index).click();
  await expect(page.locator(".ai-rag-result")).toContainText(
    "Simulated answer",
  );
  const firstSource = await page
    .locator(".ai-inline-source")
    .first()
    .innerText();
  await page.locator(".ai-inline-source").first().click();
  const sourceId = firstSource.slice(1, -1);
  const source = buildCorpus(500).find((document) => document.id === sourceId)!;
  await expect(page.locator(".ai-preview-heading strong")).toHaveText(
    source.title,
  );

  await page
    .getByRole("button", { name: "Count vectors", exact: true })
    .click();
  await expect(page.locator(".ai-preview-tag")).toHaveText("Count vector");
  const countDocuments = buildCorpus(500).map((document) => ({
    ...document,
    vector: encodeQuery(`${document.title} ${document.text}`),
  }));
  const countTop = rankDocuments([2, 0, 0], "euclidean", countDocuments)[0];
  await expect(
    page.locator(".ai-document-row").first().locator("strong"),
  ).toHaveText(countTop.document.title);
  await page.getByLabel(/number of points/i).fill("8");
  await page.locator(".ai-method-details summary").click();
  await page
    .getByRole("button", { name: /Explore term\/document counts/ })
    .click();
  await expect(page.locator(".ai-matrix tbody tr")).toHaveCount(8);
  await page.locator(".ai-matrix tbody tr").nth(4).getByRole("button").click();
  await expect(page.locator(".ai-preview-heading strong")).toHaveText(
    "Vacation and annual leave",
  );
  await expect(page.locator(".ai-preview-tag")).toHaveText("Count vector");
  await page
    .getByLabel("What would you like to find?")
    .fill("unrecognized question");
  await expect(page.locator(".ai-document-row")).toHaveCount(0);
  await expect(page.locator(".ai-pipeline button").first()).toBeDisabled();
  expect(errors).toEqual([]);
});

test("PCA displays original-dimensional scores and actual computed projections", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page
    .getByRole("button", { name: "PCA projection", exact: true })
    .click();
  await expect(page.getByLabel("Choose a 4D query")).toHaveValue("hidden");
  await expect(page.locator(".pca-panel")).toContainText(
    "PCA projection (approximate visualization)",
  );
  await expect(
    page.getByRole("button", { name: "Unit sphere", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Plot normalized directions")).toHaveCount(0);
  await expect(page.locator(".pca-score-row")).toHaveCount(8);
  for (const query of ["hidden", "opposite", "visible"]) {
    await page.getByLabel("Choose a 4D query").selectOption(query);
    const expected = getPcaView(query).rows[0];
    await expect(page.locator(".pca-score-row").first()).toContainText(
      expected.label,
    );
    await expect(page.locator(".pca-score-row").first()).toContainText(
      expected.originalCosine!.toFixed(3),
    );
    await expect(page.locator(".pca-score-row").first()).toContainText(
      expected.projectedCosine!.toFixed(3),
    );
  }
  await page.getByLabel("Choose a 4D query").selectOption("hidden");
  await page.locator(".pca-panel .ai-method-details summary").click();
  await expect(page.locator(".pca-panel")).toContainText(
    "query uses the fitted dataset mean",
  );
  await page.screenshot({ path: "artifacts/pca.png", fullPage: true });
});

test("extended AI controls, matrix, RAG, and PCA pass automated WCAG AA", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  const audit = async () => {
    const report = await new AxeBuilder({ page })
      .include(".ai-panel")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      report.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          failure: node.failureSummary,
        })),
      })),
    ).toEqual([]);
  };
  await audit();
  await page
    .getByRole("button", { name: "Count vectors", exact: true })
    .click();
  await page.locator(".ai-rag-details summary").click();
  for (let index = 0; index < 3; index++)
    await page.locator(".ai-pipeline button").nth(index).click();
  await page.locator(".ai-method-details summary").click();
  await page
    .getByRole("button", { name: /Explore term\/document counts/ })
    .click();
  await audit();
  await page
    .getByRole("button", { name: "PCA projection", exact: true })
    .click();
  await page.locator(".pca-panel .ai-method-details summary").click();
  await audit();
});

test("AI instructions and point controls remain usable across desktop and mobile widths", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [1440, 1920, 390]) {
    const suffix = width === 390 ? "mobile" : String(width);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    await page.goto("/");
    await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
    const count = page.getByLabel(/number of points/i);
    await count.fill("500");
    await expect(count).toHaveValue("500");
    await expect(page.locator(".scene-webgl")).toHaveAttribute(
      "data-scene-point-count",
      "500",
    );
    const guide = page.getByRole("complementary", {
      name: "Experiment instructions",
    });
    await expect(guide).toContainText("Set the number of points");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width > 1180) {
      const panel = await guide.boundingBox();
      const scene = await page.locator(".scene-card").boundingBox();
      expect(panel!.x).toBeGreaterThan(scene!.x + scene!.width - 1);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/ai500-${suffix}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Count vectors", exact: true })
      .click();
    await expect(guide).toContainText(
      "Its displayed counts are the plotted document coordinates",
    );
    await page
      .getByRole("button", { name: "PCA projection", exact: true })
      .click();
    await expect(guide).toContainText("Select points G and H");
    await expect(guide).toContainText("original 4D vector");
    await expect(page.locator(".scene-webgl")).toHaveAttribute(
      "data-scene-point-count",
      "8",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/pca-${suffix}.png`,
      fullPage: true,
    });
  }
});
