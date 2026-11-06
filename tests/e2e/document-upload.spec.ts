import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Actual minimal PDF with a font, text stream, byte offsets, and xref table. */
function pdfFixture(text?: string): Buffer {
  const escaped = (text ?? "").replace(/([\\()])/g, "\\$1");
  const stream = text ? `BT /F1 12 Tf 40 730 Td (${escaped}) Tj ET` : "q Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test.beforeEach(async ({ context, page }) => {
  // Real PDF/text parsing still runs. Only remote model download is blocked.
  await context.route("https://huggingface.co/**", (route) =>
    route.abort("failed"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /AI & LLM Lab/ }).click();
  await page.getByRole("button", { name: /^Real embeddings$/i }).click();
});

test("actual PDF and text files replace samples with their real parsed chunks", async ({
  page,
}) => {
  const upload = page.getByRole("region", { name: "Document import" });
  await expect(upload).toBeVisible();
  await upload.getByLabel("Choose PDF or text files").setInputFiles([
    {
      name: "station-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "The Lumen research station is located on Alder Island. Its backup generator uses hydrogen fuel. The emergency assembly point is the North Courtyard.",
      ),
    },
    {
      name: "workshop-guide.pdf",
      mimeType: "application/pdf",
      buffer: pdfFixture(
        "The Aurora workshop opens on Tuesday. Its front door is painted green. Visitors meet in the west lobby.",
      ),
    },
  ]);
  await expect(upload.locator(".upload-imported-summary")).toContainText(
    "2 imported chunks",
    { timeout: 20000 },
  );
  await upload.getByText("Manage imported files", { exact: true }).click();
  await expect(upload.locator(".upload-file-summary")).toContainText(
    "station-notes.txt",
  );
  await expect(upload.locator(".upload-file-summary")).toContainText(
    "workshop-guide.pdf",
  );
  await expect(upload.locator(".upload-file-summary")).toContainText("1 page");
  await expect(upload).toContainText("Imported passages replace the samples");
  await upload
    .getByText("Privacy and PDF limitations", { exact: true })
    .click();
  await expect(upload).toContainText("not saved automatically");
  await expect(upload).toContainText("does not perform OCR");
  // Failure to load the remote model must not fabricate successful inference.
  await expect(page.locator(".real-result")).toHaveCount(0);
  await upload
    .getByRole("button", { name: "Use sample documents", exact: false })
    .click();
  await expect(upload.locator(".upload-imported-summary")).toHaveCount(0);
  await expect(
    upload.getByRole("button", { name: "Choose files", exact: true }),
  ).toBeVisible();
});

test("blank and malformed PDFs produce honest parser errors without replacing the current corpus", async ({
  page,
}) => {
  const upload = page.getByRole("region", { name: "Document import" });
  const picker = upload.getByLabel("Choose PDF or text files");
  await picker.setInputFiles({
    name: "image-only.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await expect(upload.getByRole("alert")).toBeVisible({ timeout: 20000 });
  await expect(upload.getByRole("alert")).toContainText(/text|OCR|scanned/i);
  await expect(upload.locator(".upload-imported-summary")).toHaveCount(0);
  await picker.setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nThis is not a valid PDF document."),
  });
  await expect(upload.getByRole("alert")).toBeVisible({ timeout: 20000 });
  await expect(upload.getByRole("alert")).toContainText(
    "current corpus is unchanged",
  );
  await expect(upload.locator(".upload-imported-summary")).toHaveCount(0);
  await picker.setInputFiles({
    name: "too-large.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 65),
  });
  await expect(upload.getByRole("alert")).toContainText(
    /10\s?MB|10\s?MiB|too large|size/i,
  );
  await expect(upload.locator(".upload-imported-summary")).toHaveCount(0);
});

test("document import controls and success/error summaries pass automated accessibility checks", async ({
  page,
}) => {
  const upload = page.getByRole("region", { name: "Document import" });
  await upload.getByLabel("Choose PDF or text files").setInputFiles({
    name: "meeting.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Meeting notes\n\nThe workshop begins at nine. Participants should bring a notebook and meet in the east room.",
    ),
  });
  await expect(upload.locator(".upload-imported-summary")).toContainText(
    "1 imported chunk",
  );
  const audit = async () => {
    const report = await new AxeBuilder({ page })
      .include(".document-upload")
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
  await upload.getByLabel("Choose PDF or text files").setInputFiles({
    name: "empty.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(" \n\t "),
  });
  await expect(upload.getByRole("alert")).toBeVisible();
  await expect(upload.locator(".upload-file-summary")).toContainText(
    "meeting.md",
  );
  await audit();
});
