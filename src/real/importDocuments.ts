import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { RealDocument } from "./types";

export const IMPORT_LIMITS = {
  files: 10,
  fileBytes: 10 * 1024 * 1024,
  totalBytes: 30 * 1024 * 1024,
  pdfPages: 200,
  chunks: 500,
} as const;
export type ImportedFileSummary = {
  name: string;
  type: "pdf" | "text";
  pages?: number;
  chunks: number;
  characters: number;
};
export type ImportProgress = {
  fileName: string;
  completed: number;
  total: number;
  page?: number;
  pages?: number;
  message: string;
};
export type ImportOutcome = {
  documents: RealDocument[];
  files: ImportedFileSummary[];
  warnings: string[];
};
type ChunkOptions = {
  maxCharacters?: number;
  maxWords?: number;
  overlapCharacters?: number;
  maxChunks?: number;
};

const COLORS = [
  "#ff756f",
  "#68d4a5",
  "#79afff",
  "#c39aff",
  "#f5bc65",
  "#65d8d3",
  "#e997bc",
  "#a0c96b",
  "#f28f58",
  "#7c9de8",
];
const cleanText = (text: string) => text.replace(/\s+/g, " ").trim();
const abortIfNeeded = (signal?: AbortSignal) => {
  if (signal?.aborted)
    throw new DOMException("Document import was canceled.", "AbortError");
};

/** Bounded text windows, preserving original order with word-aligned overlap.
 * Long unbroken strings are split to respect the hard character bound. */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxCharacters = options.maxCharacters ?? 700;
  const maxWords = options.maxWords ?? 120;
  const overlapCharacters = options.overlapCharacters ?? 80;
  const maxChunks = options.maxChunks ?? IMPORT_LIMITS.chunks;
  if (
    !Number.isInteger(maxCharacters) ||
    maxCharacters < 2 ||
    !Number.isInteger(maxWords) ||
    maxWords < 1 ||
    !Number.isInteger(overlapCharacters) ||
    overlapCharacters < 0 ||
    overlapCharacters >= maxCharacters ||
    !Number.isInteger(maxChunks) ||
    maxChunks < 1
  )
    throw new Error("Invalid text chunk limits.");
  const normalized = cleanText(text);
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxCharacters, normalized.length);
    // If the hard bound cuts a normal word, end at its preceding whitespace.
    if (end < normalized.length && normalized[end] !== " ") {
      const boundary = normalized.lastIndexOf(" ", end);
      if (boundary > start) end = boundary;
    }
    // Do not split a UTF-16 surrogate pair when an unusually long token is cut.
    const lastCode = normalized.charCodeAt(end - 1);
    if (lastCode >= 0xd800 && lastCode <= 0xdbff) end--;
    let words = 0;
    for (let i = start; i < end; i++) {
      if (i === start || normalized[i - 1] === " ") words++;
      if (words > maxWords) {
        end = i - 1;
        break;
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (chunks.length > maxChunks)
      throw new Error(
        `This selection exceeds the ${maxChunks}-chunk limit. Import fewer pages or smaller files; no text was silently truncated.`,
      );
    if (end >= normalized.length) break;
    // Prefer an overlap of complete words. Very long tokens get no overlap.
    const overlapStart = Math.max(start + 1, end - overlapCharacters);
    const boundary = normalized.indexOf(" ", overlapStart);
    start = boundary >= 0 && boundary < end ? boundary + 1 : end;
    while (normalized[start] === " ") start++;
  }
  return chunks;
}

function fileType(file: File): "pdf" | "text" {
  if (/\.pdf$/i.test(file.name)) return "pdf";
  if (/\.(txt|md|markdown)$/i.test(file.name)) return "text";
  throw new Error(
    `“${file.name}” is not supported. Choose PDF, .txt, or .md files.`,
  );
}

export function validateImportFiles(files: File[]): void {
  if (!files.length)
    throw new Error("Choose at least one PDF, .txt, or .md file.");
  if (files.length > IMPORT_LIMITS.files)
    throw new Error(
      `Choose no more than ${IMPORT_LIMITS.files} files at a time.`,
    );
  const names = new Set<string>();
  let total = 0;
  for (const file of files) {
    fileType(file);
    if (names.has(file.name))
      throw new Error(
        `Two selected files are named “${file.name}”. Rename one so the source links are unambiguous.`,
      );
    names.add(file.name);
    if (file.size > IMPORT_LIMITS.fileBytes)
      throw new Error(`“${file.name}” exceeds the 10 MB per-file limit.`);
    total += file.size;
  }
  if (total > IMPORT_LIMITS.totalBytes)
    throw new Error(
      "The selected files exceed the 30 MB total limit. Choose a smaller selection.",
    );
}

function colorFor(name: string): string {
  let hash = 0;
  for (const character of name)
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return COLORS[(hash >>> 0) % COLORS.length];
}

/** A content-and-provenance digest: stable across upload order and sessions. */
export async function importedDocumentId(
  fileName: string,
  page: number | undefined,
  chunk: number,
  text: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify([fileName, page ?? null, chunk, text]),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `upload-${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24)}`;
}

/** Parses locally and returns an atomic replacement corpus. This module neither
 * sends content to a service nor writes uploaded text/vectors into persistent storage. */
export async function importDocumentFiles(
  files: File[],
  onProgress?: (progress: ImportProgress) => void,
  signal?: AbortSignal,
): Promise<ImportOutcome> {
  abortIfNeeded(signal);
  validateImportFiles(files);
  const outcome: ImportOutcome = { documents: [], files: [], warnings: [] };
  const fileColors = new Map<string, string>();
  const usedColors = new Set<string>();
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    let index = COLORS.indexOf(colorFor(file.name));
    while (usedColors.has(COLORS[index])) index = (index + 1) % COLORS.length;
    usedColors.add(COLORS[index]);
    fileColors.set(file.name, COLORS[index]);
  }
  const append = async (file: File, text: string, page?: number) => {
    const chunks = chunkText(text);
    if (outcome.documents.length + chunks.length > IMPORT_LIMITS.chunks)
      throw new Error(
        "This selection exceeds the 500-chunk limit. Import fewer pages or smaller files; no text was silently truncated.",
      );
    for (let index = 0; index < chunks.length; index++) {
      abortIfNeeded(signal);
      const chunk = index + 1;
      outcome.documents.push({
        id: await importedDocumentId(file.name, page, chunk, chunks[index]),
        title: `${file.name}${page === undefined ? "" : ` · page ${page}`} · chunk ${chunk}`,
        text: chunks[index],
        topic: file.name,
        color: fileColors.get(file.name)!,
        source: {
          fileName: file.name,
          ...(page === undefined ? {} : { page }),
          chunk,
        },
      });
    }
  };

  for (let index = 0; index < files.length; index++) {
    abortIfNeeded(signal);
    const file = files[index];
    const type = fileType(file);
    const before = outcome.documents.length;
    let characters = 0;
    onProgress?.({
      fileName: file.name,
      completed: index,
      total: files.length,
      message: `Reading ${file.name} locally…`,
    });
    if (type === "text") {
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        throw new Error(
          `“${file.name}” is not valid UTF-8 text. Save it as UTF-8 and try again.`,
        );
      }
      abortIfNeeded(signal);
      if (text.includes("\0"))
        throw new Error(
          `“${file.name}” contains binary data. Choose a plain UTF-8 text or Markdown file.`,
        );
      characters = cleanText(text).length;
      if (!characters)
        outcome.warnings.push(
          `${file.name}: No nonblank text was found; this file contributed no chunks.`,
        );
      await append(file, text);
      outcome.files.push({
        name: file.name,
        type,
        chunks: outcome.documents.length - before,
        characters,
      });
    } else {
      // Load PDF.js only for a PDF. The worker URL is a same-origin build asset.
      const pdfjs = await import("pdfjs-dist");
      abortIfNeeded(signal);
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const data = new Uint8Array(await file.arrayBuffer());
      abortIfNeeded(signal);
      const task = pdfjs.getDocument({
        data,
        enableXfa: false,
        disableFontFace: true,
        useSystemFonts: false,
        useWorkerFetch: false,
      });
      const cancel = () => {
        void task.destroy().catch(() => undefined);
      };
      signal?.addEventListener("abort", cancel, { once: true });
      try {
        const pdf = await task.promise;
        abortIfNeeded(signal);
        if (pdf.numPages > IMPORT_LIMITS.pdfPages)
          throw new Error(
            `“${file.name}” has ${pdf.numPages} pages, above the 200-page per-PDF limit. Split the document first.`,
          );
        const blankPages: number[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          abortIfNeeded(signal);
          onProgress?.({
            fileName: file.name,
            completed: index,
            total: files.length,
            page: pageNumber,
            pages: pdf.numPages,
            message: `Extracting ${file.name} · page ${pageNumber} / ${pdf.numPages}…`,
          });
          const page = await pdf.getPage(pageNumber);
          try {
            const content = await page.getTextContent();
            abortIfNeeded(signal);
            const text = content.items
              .map((item) =>
                "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "",
              )
              .join("");
            const cleaned = cleanText(text);
            characters += cleaned.length;
            if (!cleaned) blankPages.push(pageNumber);
            else await append(file, cleaned, pageNumber);
          } finally {
            page.cleanup();
          }
        }
        if (blankPages.length)
          outcome.warnings.push(
            `${file.name}: No extractable text on ${blankPages.length === 1 ? "page" : "pages"} ${blankPages.slice(0, 12).join(", ")}${blankPages.length > 12 ? ` and ${blankPages.length - 12} more` : ""}. Scanned or image-only pages need OCR, which this importer does not provide.`,
          );
        outcome.files.push({
          name: file.name,
          type,
          pages: pdf.numPages,
          chunks: outcome.documents.length - before,
          characters,
        });
      } catch (error) {
        abortIfNeeded(signal);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Could not import “${file.name}”: ${message}. Password-protected, damaged, or image-only PDFs may need preparation before import.`,
          { cause: error },
        );
      } finally {
        signal?.removeEventListener("abort", cancel);
        await task.destroy();
      }
    }
    onProgress?.({
      fileName: file.name,
      completed: index + 1,
      total: files.length,
      message: `Read ${file.name}: ${outcome.documents.length - before} source chunks.`,
    });
  }
  abortIfNeeded(signal);
  if (!outcome.documents.length)
    throw new Error(
      `No searchable text was found. Empty files and scanned/image-only PDFs cannot be embedded. OCR is not supported.${outcome.warnings.length ? ` ${outcome.warnings.join(" ")}` : ""}`,
    );
  return outcome;
}
