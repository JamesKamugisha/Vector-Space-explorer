import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// This intentionally tests a failed model download, not a mocked successful model.
// Real inference and generation require a separate verification with network access.
test("real embedding mode discloses its models and handles failed downloads without fake results", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  let modelRequests = 0;
  const workerErrors: string[] = [];
  page.on("pageerror", (error) => workerErrors.push(error.message));
  // Model fetches originate in a dedicated worker, so intercept at context scope.
  await context.route("https://huggingface.co/**", (route) => {
    modelRequests++;
    return route.abort("failed");
  });
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page.getByRole("button", { name: /^Real embeddings$/i }).click();
  const panel = page.getByRole("region", { name: "Real embedding controls" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("text passages");
  await expect(panel).toContainText("not image embeddings");
  await expect(panel.getByRole("link", { name: /MiniLM/ })).toHaveAttribute(
    "href",
    "https://huggingface.co/Xenova/all-MiniLM-L6-v2",
  );
  await expect(panel.getByRole("link", { name: /flan-t5/ })).toHaveAttribute(
    "href",
    "https://huggingface.co/Xenova/flan-t5-small",
  );
  await panel
    .getByText("First-run download and privacy", { exact: true })
    .click();
  await expect(panel).toContainText("Queries are processed locally");
  await expect(
    panel.getByRole("button", { name: /Search by meaning/ }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: /Generate answer from sources/ }),
  ).toBeDisabled();
  await expect(panel.locator(".real-result")).toHaveCount(0);
  try {
    await expect(panel.getByRole("alert")).toBeVisible({ timeout: 30000 });
  } catch (error) {
    console.log("REAL_WORKER_FAILURE_DIAGNOSTICS", {
      modelRequests,
      status: await panel.locator(".real-status").allTextContents(),
      progress: await panel.locator(".real-progress-label").allTextContents(),
      workerErrors,
    });
    throw error;
  }
  await expect(panel.getByRole("alert")).toContainText("Hugging Face");
  const beforeRetry = modelRequests;
  await panel
    .getByRole("button", { name: "Retry model loading", exact: true })
    .click();
  await expect.poll(() => modelRequests).toBeGreaterThan(beforeRetry);
  await expect(panel.getByRole("alert")).toBeVisible({ timeout: 30000 });
  await expect(panel.locator(".real-result")).toHaveCount(0);
  await expect(
    panel.getByRole("article", { name: "Locally generated answer" }),
  ).toHaveCount(0);

  const count = panel.getByLabel(/number of points/i);
  await count.fill("100");
  await count.press("Enter");
  await expect(count).toHaveValue("100");
  await expect(panel.locator(".real-point-section")).toContainText(
    "100 sample text passages",
  );
  await count.fill("999");
  await count.press("Enter");
  await expect(count).toHaveValue("500");
  await expect(
    panel.getByRole("button", { name: "+25 points", exact: true }),
  ).toBeDisabled();
  await panel.getByRole("button", { name: "Cats", exact: true }).click();
  await expect(panel.getByLabel("Ask about an idea")).toHaveValue(
    "How do cats communicate with their tails?",
  );
  await expect(panel.locator(".real-result")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .include(".real-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
});
