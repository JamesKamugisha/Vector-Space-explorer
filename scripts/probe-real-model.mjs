import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("BROWSER", msg.text().slice(0, 400));
});
page.on("requestfailed", (request) =>
  console.log(
    "FAILED",
    request.url().split("?")[0],
    request.failure()?.errorText,
  ),
);
try {
  await page.goto("http://127.0.0.1:5174/tests/fixtures/real-probe.html");
  await page.waitForFunction(
    () => typeof window.runEmbeddingProbe === "function",
  );
  const result = await page.evaluate(async () => window.runEmbeddingProbe());
  console.log(JSON.stringify(result));
  if (result.dimensions !== 384 || result.related <= result.unrelated)
    throw new Error("Real model embedding check failed");
  const generation = await page.evaluate(async () =>
    window.runGenerationProbe(),
  );
  console.log("GENERATION", JSON.stringify(generation));
} finally {
  await browser.close();
}
