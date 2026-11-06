import { describe, expect, it } from "vitest";
import {
  IMPORT_LIMITS,
  chunkText,
  importDocumentFiles,
  importedDocumentId,
  validateImportFiles,
} from "../src/real/importDocuments";

describe("bounded document chunks", () => {
  it("normalizes whitespace without adding padding or inventing passages", () => {
    expect(chunkText("  One\n short\tpassage.  ")).toEqual([
      "One short passage.",
    ]);
    expect(chunkText("  \n\t ")).toEqual([]);
  });
  it("covers meaningful words in order with bounded overlapping windows", () => {
    const words = Array.from({ length: 1000 }, (_, index) => `word${index}`);
    const text = words.join(" ");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(10);
    expect(
      chunks.every(
        (chunk) => chunk.length <= 700 && chunk.split(" ").length <= 120,
      ),
    ).toBe(true);
    for (const word of words)
      expect(chunks.some((chunk) => chunk.split(" ").includes(word))).toBe(
        true,
      );
    const starts = chunks.map((chunk) => text.indexOf(chunk));
    starts.forEach((start, index) => {
      if (index) {
        expect(start).toBeGreaterThan(starts[index - 1]);
        expect(start).toBeLessThan(
          starts[index - 1] + chunks[index - 1].length,
        );
      }
    });
    expect(chunks.at(-1)).toContain("word999");
  });
  it("enforces word limits, preserves long tokens and rejects silent truncation", () => {
    const chunks = chunkText(Array(200).fill("a").join(" "));
    expect(chunks[0].split(" ")).toHaveLength(120);
    expect(
      chunks.every(
        (chunk) => chunk.length <= 700 && chunk.split(" ").length <= 120,
      ),
    ).toBe(true);
    expect(chunkText("x".repeat(1800))).toEqual([
      "x".repeat(700),
      "x".repeat(700),
      "x".repeat(400),
    ]);
    expect(() => chunkText("word ".repeat(1000), { maxChunks: 2 })).toThrow(
      "no text was silently truncated",
    );
    expect(() => chunkText("hello", { overlapCharacters: 700 })).toThrow(
      "Invalid",
    );
  });
});

describe("upload validation and source identity", () => {
  it("rejects unsupported files, ambiguous sources, and byte limits before parsing", () => {
    expect(() => validateImportFiles([])).toThrow("at least one");
    expect(() =>
      validateImportFiles([new File(["text"], "sample.docx")]),
    ).toThrow("not supported");
    expect(() =>
      validateImportFiles(
        Array.from(
          { length: 11 },
          (_, index) => new File(["text"], `${index}.txt`),
        ),
      ),
    ).toThrow("10 files");
    expect(() =>
      validateImportFiles([
        new File(["one"], "same.txt"),
        new File(["two"], "same.txt"),
      ]),
    ).toThrow("Rename");
    const oversized = new File(
      [new Uint8Array(IMPORT_LIMITS.fileBytes + 1)],
      "large.txt",
    );
    expect(() => validateImportFiles([oversized])).toThrow("10 MB");
    const totalTooLarge = Array.from(
      { length: 4 },
      (_, index) =>
        new File([new Uint8Array(8 * 1024 * 1024)], `large${index}.txt`),
    );
    expect(() => validateImportFiles(totalTooLarge)).toThrow("30 MB");
  });
  it("derives stable source/content IDs and distinguishes pages and changed text", async () => {
    const first = await importedDocumentId(
      "paper.pdf",
      2,
      1,
      "A source passage.",
    );
    expect(first).toBe(
      await importedDocumentId("paper.pdf", 2, 1, "A source passage."),
    );
    expect(first).not.toBe(
      await importedDocumentId("paper.pdf", 3, 1, "A source passage."),
    );
    expect(first).not.toBe(
      await importedDocumentId("paper.pdf", 2, 1, "Changed passage."),
    );
    expect(first).not.toBe(
      await importedDocumentId("other.pdf", 2, 1, "A source passage."),
    );
  });
  it("imports UTF-8 text/Markdown locally with provenance and progress", async () => {
    const progress: string[] = [];
    const files = [
      new File(["Café birds fly through the sky."], "birds.txt"),
      new File(["# Notes\n\nA chair supports the sitter."], "notes.md"),
    ];
    const outcome = await importDocumentFiles(files, (value) =>
      progress.push(value.message),
    );
    expect(outcome.documents).toHaveLength(2);
    expect(outcome.documents[0].text).toContain("Café");
    expect(outcome.documents[0].source).toEqual({
      fileName: "birds.txt",
      chunk: 1,
    });
    expect(outcome.documents[1].topic).toBe("notes.md");
    expect(outcome.files.map((file) => file.chunks)).toEqual([1, 1]);
    expect(progress).toHaveLength(4);
    const repeated = await importDocumentFiles([...files].reverse());
    expect(repeated.documents[1].id).toBe(outcome.documents[0].id);
    expect(repeated.documents[1].color).toBe(outcome.documents[0].color);
  });
  it("rejects invalid UTF-8/binary, reports blanks, and honors cancellation", async () => {
    await expect(
      importDocumentFiles([
        new File([new Uint8Array([255, 254, 253])], "bad.txt"),
      ]),
    ).rejects.toThrow("UTF-8");
    await expect(
      importDocumentFiles([new File(["binary\0data"], "bad.md")]),
    ).rejects.toThrow("binary");
    await expect(
      importDocumentFiles([new File(["  \n\t"], "empty.txt")]),
    ).rejects.toThrow("No searchable text");
    const mixed = await importDocumentFiles([
      new File(["  "], "empty.txt"),
      new File(["A real paragraph."], "valid.txt"),
    ]);
    expect(mixed.warnings).toHaveLength(1);
    expect(mixed.files[0].chunks).toBe(0);
    const controller = new AbortController();
    controller.abort();
    await expect(
      importDocumentFiles(
        [new File(["A paragraph"], "valid.txt")],
        undefined,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("uses distinct source-file colors, stable under selection reordering", async () => {
    const files = Array.from(
      { length: 10 },
      (_, index) => new File([`Passage ${index}.`], `source-${index}.markdown`),
    );
    const first = await importDocumentFiles(files);
    const reversed = await importDocumentFiles([...files].reverse());
    expect(
      new Set(first.documents.map((document) => document.color)).size,
    ).toBe(10);
    for (const document of first.documents)
      expect(
        reversed.documents.find((other) => other.id === document.id)?.color,
      ).toBe(document.color);
  });
});
