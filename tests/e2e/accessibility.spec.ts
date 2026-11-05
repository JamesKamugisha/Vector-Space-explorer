import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Math and AI workspaces satisfy automated WCAG AA checks", async ({
  page,
}) => {
  await page.goto("/");
  for (const scenario of ["math", "ai"]) {
    if (scenario === "ai")
      await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
