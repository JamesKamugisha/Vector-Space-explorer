import { useEffect, useId, useRef, useState } from "react";
import type { RealDocument } from "./types";
import {
  importDocumentFiles,
  type ImportedFileSummary,
  type ImportProgress,
} from "./importDocuments";
import "./document-upload.css";

export type DocumentUploadProps = {
  onImport: (documents: RealDocument[], files: ImportedFileSummary[]) => void;
  onUseSamples: () => void;
  importedDocuments: RealDocument[] | null;
  importedFiles: ImportedFileSummary[];
};

export default function DocumentUpload({
  onImport,
  onUseSamples,
  importedDocuments,
  importedFiles,
}: DocumentUploadProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const activeJob = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const imported = importedDocuments !== null;
  useEffect(() => () => activeJob.current?.abort(), []);

  const readFiles = async (files: File[]) => {
    if (!files.length) return;
    activeJob.current?.abort();
    const controller = new AbortController();
    activeJob.current = controller;
    setBusy(true);
    setError("");
    setWarnings([]);
    setProgress({
      fileName: files[0].name,
      completed: 0,
      total: files.length,
      message: "Reading document text locally…",
    });
    try {
      const result = await importDocumentFiles(
        files,
        (update) => {
          if (!controller.signal.aborted) setProgress(update);
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!result.documents.length)
        throw new Error(
          "No readable text chunks were found. Try a text-based PDF, TXT, or Markdown file.",
        );
      setWarnings(result.warnings);
      setManageOpen(false);
      onImport(result.documents, result.files);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setProgress(null);
      }
      if (input.current) input.current.value = "";
    }
  };
  const useSamples = () => {
    activeJob.current?.abort();
    activeJob.current = null;
    setBusy(false);
    setManageOpen(false);
    setProgress(null);
    setError("");
    setWarnings([]);
    if (input.current) input.current.value = "";
    onUseSamples();
  };
  const fileFraction =
    progress?.pages && progress.page ? progress.page / progress.pages : 0;
  const percent = progress
    ? Math.min(
        100,
        Math.round(
          ((progress.completed + fileFraction) / Math.max(1, progress.total)) *
            100,
        ),
      )
    : 0;

  const managementContent = (
    <>
      <h3>Explore your own material.</h3>
      <p className="upload-intro">
        Replace samples with your own PDF, TXT, or Markdown files.
      </p>
      <div
        className={`upload-dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          )
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void readFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z" />
          <path d="M13 3v7h7M12 17v-4m-2 2 2-2 2 2" />
        </svg>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="upload-choose-button"
        >
          {busy
            ? "Reading documents…"
            : imported
              ? "Replace imported files"
              : "Choose files"}
        </button>
        <span className="upload-drop-hint">or drop files here</span>
        <input
          ref={input}
          id={inputId}
          className="upload-file-input"
          type="file"
          multiple
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
          aria-label="Choose PDF or text files"
          onChange={(event) => {
            void readFiles(Array.from(event.target.files ?? []));
          }}
        />
      </div>
      <p className="upload-limits">
        PDF, TXT, MD · 10 MB per file · 30 MB total
        <br />
        Up to 10 files and 500 text chunks.
      </p>
      {imported && (
        <>
          <ul className="upload-file-summary">
            {importedFiles.map((file, index) => (
              <li key={`${index}-${file.name}`}>
                <strong title={file.name}>{file.name}</strong>
                <span>
                  {file.type === "pdf"
                    ? `${file.pages ?? 1} ${(file.pages ?? 1) === 1 ? "page" : "pages"} · `
                    : ""}
                  {file.chunks} {file.chunks === 1 ? "chunk" : "chunks"}
                </span>
              </li>
            ))}
          </ul>
          <p className="upload-scope-note">
            Imported passages replace the samples. Search and generation use
            this corpus.
          </p>
        </>
      )}
      <details className="upload-privacy">
        <summary>Privacy and PDF limitations</summary>
        <p>
          Files and extracted text stay in this browser page. They are not
          uploaded to an application server, and imported text and embeddings
          are not saved automatically. Reloading clears this imported corpus.
          Model weights still download from their public hosts.
        </p>
        <p>
          PDF text extraction reads selectable text. Scanned or image-only PDFs
          need OCR elsewhere first; this app does not perform OCR. Layout,
          tables, or reading order may not be preserved perfectly. Inspect the
          extracted source before trusting an answer.
        </p>
      </details>
    </>
  );

  return (
    <section
      className={`document-upload ${imported ? "is-imported" : ""}`}
      aria-label="Document import"
      aria-busy={busy}
    >
      <div className="upload-heading">
        <span className="upload-eyebrow">YOUR DOCUMENTS</span>
        <span className="upload-local-badge">Browser only</span>
      </div>
      {imported && (
        <div className="upload-imported-summary" role="status">
          <div className="upload-summary-heading">
            <strong>
              {importedDocuments.length} imported{" "}
              {importedDocuments.length === 1 ? "chunk" : "chunks"}
            </strong>
            <span>
              {importedFiles.length}{" "}
              {importedFiles.length === 1 ? "file" : "files"}
            </span>
          </div>
        </div>
      )}
      {imported ? (
        <details
          className="upload-management"
          open={manageOpen}
          onToggle={(event) => setManageOpen(event.currentTarget.open)}
        >
          <summary>Manage imported files</summary>
          {managementContent}
        </details>
      ) : (
        managementContent
      )}
      {busy && progress && (
        <div className="upload-progress" role="status">
          <div>
            <span>{progress.message}</span>
            <strong>{percent}%</strong>
          </div>
          <progress
            max={100}
            value={percent}
            aria-label="Document import progress"
          />
          <p>
            {progress.fileName}
            {progress.page && progress.pages
              ? ` · page ${progress.page} of ${progress.pages}`
              : ""}
          </p>
        </div>
      )}
      {error && (
        <div className="upload-error" role="alert">
          <strong>Document import needs attention.</strong>
          <p>{error}</p>
          <p>
            Your current corpus is unchanged. Choose another file or return to
            the samples.
          </p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="upload-warnings" role="status">
          <strong>Import notes</strong>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {(imported || busy || error) && (
        <button
          type="button"
          className="upload-use-samples"
          onClick={useSamples}
        >
          Use sample documents<span aria-hidden="true">↩</span>
        </button>
      )}
    </section>
  );
}
