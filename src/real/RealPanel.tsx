import { useEffect, useMemo, useState } from "react";
import type { RealState } from "./types";
import "./real.css";

export type RealPanelProps = {
  state: RealState;
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onGenerate: () => void;
  onRetry: () => void;
  pointCount: number;
  onPointCountChange: (count: number) => void;
  selectedId: string;
  onSelect: (id: string) => void;
};

const presets = [
  { label: "Cats", query: "How do cats communicate with their tails?" },
  { label: "Dogs", query: "How can a dog learn to come when called?" },
  { label: "Cars", query: "How does regenerative braking work?" },
  { label: "Faces", query: "What makes a portrait look natural?" },
  { label: "Chairs", query: "What makes an office chair ergonomic?" },
  { label: "Birds", query: "Why do birds migrate?" },
];
const boundedCount = (value: number) =>
  Number.isFinite(value) ? Math.max(8, Math.min(500, Math.floor(value))) : 8;
const modelUrl = (model: string) =>
  `https://huggingface.co/${model.split("/").map(encodeURIComponent).join("/")}`;

export default function RealPanel({
  state,
  query,
  onQueryChange,
  onSearch,
  onGenerate,
  onRetry,
  pointCount,
  onPointCountChange,
  selectedId,
  onSelect,
}: RealPanelProps) {
  const [countText, setCountText] = useState(String(pointCount));
  const [showAll, setShowAll] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  useEffect(() => setCountText(String(pointCount)), [pointCount]);
  const loading = ["loading", "embedding", "projecting"].includes(state.status);
  const answering = state.status === "answering";
  const ready = state.status === "ready";
  const progress = Math.max(0, Math.min(100, Math.round(state.progress * 100)));
  const selected =
    state.documents.find((document) => document.id === selectedId) ??
    state.results[0]?.document;
  const selectedResult = state.results.find(
    (result) => result.document.id === selected?.id,
  );
  const topics = useMemo(
    () => [
      ...new Map(
        state.documents.map((document) => [document.topic, document.color]),
      ).entries(),
    ],
    [state.documents],
  );
  const searchedQuery = state.searchedQuery ?? submittedQuery;
  const queryChanged =
    state.results.length > 0 &&
    searchedQuery !== "" &&
    searchedQuery.trim() !== query.trim();
  const pendingCount = boundedCount(Number(countText)) !== pointCount;
  const search = () => {
    if (ready && query.trim() && !pendingCount) {
      setSubmittedQuery(query.trim());
      onSearch();
    }
  };
  const applyCount = () => {
    const count = boundedCount(Number(countText));
    setCountText(String(count));
    if (count !== pointCount) onPointCountChange(count);
  };
  useEffect(() => {
    if (state.results[0]) onSelect(state.results[0].document.id);
  }, [state.results, onSelect]);

  return (
    <section className="real-panel" aria-label="Real embedding controls">
      <div className="real-section real-introduction">
        <div className="real-heading">
          <span className="real-eyebrow">TRAINED MODEL · LOCAL INFERENCE</span>
          <span className="real-local-badge">No API key</span>
        </div>
        <h3>Search a learned space.</h3>
        <p>
          Search sample text with a trained {state.dimensions || 384}D model.
          Explore meaning in a computed 3D map.
        </p>
        <details className="real-disclosure">
          <summary>Sample text, not image embeddings</summary>
          <p>
            These are text passages about cats, dogs, cars, faces, chairs, and
            birds. Topic colors are known labels; the model computes the
            positions.
          </p>
          <div className="real-topics">
            {topics.map(([topic, color]) => (
              <span key={topic}>
                <i style={{ background: color }} />
                {topic}
              </span>
            ))}
          </div>
        </details>
      </div>

      <div className="real-section real-point-section">
        <div className="real-heading">
          <label htmlFor="real-point-count" className="real-eyebrow">
            NUMBER OF POINTS
          </label>
          <span className="real-help">8–500</span>
        </div>
        <div className="real-count-row">
          <input
            id="real-point-count"
            type="number"
            min={8}
            max={500}
            step={1}
            value={countText}
            onChange={(event) => setCountText(event.target.value)}
            onBlur={applyCount}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <button
            type="button"
            disabled={pointCount >= 500}
            onClick={() => onPointCountChange(boundedCount(pointCount + 25))}
          >
            +25 points
          </button>
        </div>
        <div
          className="real-count-presets"
          aria-label="Real embedding point count presets"
        >
          {[8, 50, 100, 500].map((count) => (
            <button
              type="button"
              key={count}
              aria-pressed={pointCount === count}
              onClick={() => onPointCountChange(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="real-help">
          {pendingCount
            ? "Press Enter or leave the field to apply this point count."
            : `${pointCount} sample text passages. Changing this recomputes embeddings and the 3D map.`}
        </p>
      </div>

      <div className="real-section">
        <div className="real-heading">
          <span className="real-eyebrow">SEMANTIC QUERY</span>
        </div>
        <label htmlFor="real-semantic-query" className="real-label">
          Ask about an idea
        </label>
        <textarea
          id="real-semantic-query"
          rows={3}
          maxLength={400}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              search();
            }
          }}
          placeholder="For example: why do birds travel seasonally?"
        />
        <div className="real-query-presets" aria-label="Semantic query presets">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.label}
              onClick={() => onQueryChange(preset.query)}
              className={query === preset.query ? "active" : ""}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="real-search-button"
          disabled={!ready || !query.trim() || pendingCount}
          onClick={search}
        >
          <span aria-hidden="true">⌕</span>Search by meaning
          <span aria-hidden="true">→</span>
        </button>
        <p className="real-help">
          Press Enter or Search to encode your query. Changing text alone does
          not run a search.
        </p>
        {queryChanged && (
          <p className="real-query-changed" role="status">
            Query changed. Search again to refresh results before generating an
            answer.
          </p>
        )}
      </div>

      <div className="real-section real-model-section">
        <div className="real-heading">
          <span className="real-eyebrow">MODEL STATUS</span>
          <span
            className={`real-status ${ready ? "ready" : state.status === "error" ? "error" : ""}`}
          >
            {state.status === "ready"
              ? "Ready"
              : state.status === "idle"
                ? "Not started"
                : state.status === "answering"
                  ? "Generating"
                  : state.status.charAt(0).toUpperCase() +
                    state.status.slice(1)}
          </span>
        </div>
        <a
          className="real-model-name"
          href={modelUrl(state.embeddingModel)}
          target="_blank"
          rel="noreferrer"
        >
          {state.embeddingModel}
          <span aria-hidden="true">↗</span>
        </a>
        <p className="real-help">
          {state.dimensions || 384}-dimensional text embeddings · cosine ranking
          in original space
        </p>
        {(loading || answering) && (
          <div className="real-loading" role="status">
            <div className="real-progress-label">
              <span>{state.message || "Preparing local model…"}</span>
              <strong>{progress}%</strong>
            </div>
            <progress
              max={100}
              value={progress}
              aria-label="Local model progress"
            />
            <p>
              {answering
                ? "The small local language model is generating from retrieved source passages."
                : "The first run downloads model files. Loading and encoding can take a while, especially on mobile."}
            </p>
          </div>
        )}
        {state.status === "error" && (
          <div className="real-error" role="alert">
            <strong>Local model could not complete this step.</strong>
            <p>
              {state.error ||
                state.message ||
                "Check your connection and browser resources, then retry."}
            </p>
            <p>
              Allow downloads from Hugging Face and its file hosts. Retry on a
              stable connection; a desktop browser may have more memory.
            </p>
            <button type="button" onClick={onRetry}>
              Retry model loading
            </button>
          </div>
        )}
        <details className="real-download-details">
          <summary>First-run download and privacy</summary>
          <p>
            Model files are downloaded from Hugging Face and cached by your
            browser when supported. Embedding and generation run on your device,
            with no paid API key. Model downloads can be tens to hundreds of
            megabytes. The generation model downloads only when you request an
            answer. Queries are processed locally rather than sent to an
            inference API.
          </p>
        </details>
      </div>

      <div className="real-section">
        <div className="real-heading">
          <span className="real-eyebrow">ORIGINAL-SPACE RESULTS</span>
          <span className="real-help">Cosine ↓</span>
        </div>
        {state.results.length ? (
          <>
            <div
              className="real-results"
              aria-label="Real semantic search results"
            >
              {(showAll ? state.results : state.results.slice(0, 5)).map(
                ({ document, score, distance }, index) => (
                  <button
                    type="button"
                    key={document.id}
                    className={`real-result ${selected?.id === document.id ? "selected" : ""}`}
                    aria-pressed={selected?.id === document.id}
                    onClick={() => onSelect(document.id)}
                  >
                    <span className="real-result-rank">{index + 1}</span>
                    <span className="real-result-text">
                      <strong>{document.title}</strong>
                      <small>
                        <i style={{ background: document.color }} />
                        {document.topic}
                      </small>
                    </span>
                    <span className="real-result-score">
                      {score.toFixed(3)}
                      <small title="Euclidean distance in original dimensions">
                        d {distance.toFixed(2)}
                      </small>
                    </span>
                  </button>
                ),
              )}
            </div>
            {state.results.length > 5 && (
              <button
                type="button"
                className="real-show-more"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll
                  ? "Show top five"
                  : `View all ${state.results.length} scored passages`}
              </button>
            )}
          </>
        ) : (
          <p className="real-empty">
            {loading
              ? "Results will appear after the model is ready and you submit a query."
              : "Search a natural-language query to rank passages by their actual embedding similarity."}
          </p>
        )}
        {selected && (
          <article
            className="real-selected-document"
            aria-label="Selected real-embedding source"
          >
            <div className="real-source-title">
              <i style={{ background: selected.color }} />
              <strong>{selected.title}</strong>
            </div>
            <p>{selected.text}</p>
            <div className="real-source-metadata">
              <span>{selected.topic}</span>
              <code>[{selected.id}]</code>
            </div>
            {selectedResult && (
              <dl>
                <div>
                  <dt>Cosine similarity</dt>
                  <dd>{selectedResult.score.toFixed(4)}</dd>
                </div>
                <div>
                  <dt>Original distance</dt>
                  <dd>{selectedResult.distance.toFixed(4)}</dd>
                </div>
              </dl>
            )}
          </article>
        )}
      </div>

      <div className="real-section real-rag-section">
        <div className="real-heading">
          <span className="real-eyebrow">LOCAL GENERATIVE RAG</span>
          <span className="real-local-badge">Actual model</span>
        </div>
        <p className="real-help">
          Retrieve context, then ask a small local language model to generate an
          answer from those passages.
        </p>
        <a
          className="real-model-name"
          href={modelUrl(state.generatorModel)}
          target="_blank"
          rel="noreferrer"
        >
          {state.generatorModel}
          <span aria-hidden="true">↗</span>
        </a>
        <button
          type="button"
          className="real-generate-button"
          onClick={onGenerate}
          disabled={
            !ready ||
            !query.trim() ||
            !state.results.length ||
            queryChanged ||
            pendingCount
          }
        >
          {answering ? "Generating locally…" : "Generate answer from sources"}
          <span aria-hidden="true">✦</span>
        </button>
        {answering && (
          <p role="status" className="real-help">
            {state.message ||
              "Loading the generation model and composing an answer…"}
          </p>
        )}
        {state.answer && (
          <article
            className="real-answer"
            aria-label="Locally generated answer"
          >
            <span className="real-answer-label">GENERATED LOCALLY</span>
            {searchedQuery && (
              <p className="real-answer-question">Question: {searchedQuery}</p>
            )}
            <p>{state.answer}</p>
            <div
              className="real-source-links"
              aria-label="Retrieved context sources"
            >
              {state.contextIds.map((id) => (
                <button type="button" key={id} onClick={() => onSelect(id)}>
                  [{id}]
                </button>
              ))}
            </div>
            <p className="real-answer-caution">
              A small model can make mistakes. Verify the answer against the
              retrieved source text.
            </p>
          </article>
        )}
      </div>

      <details className="real-section real-projection-note">
        <summary>What the 3D clusters mean</summary>
        <p>
          Each point starts as a {state.dimensions || 384}-dimensional embedding
          computed from its actual sample text. The app projects the vectors
          into 3D for exploration. Neighborhoods can reveal related topics, but
          projected positions, distances, and angles are approximate. Retrieval
          always uses the original-dimensional embeddings.
        </p>
        <p>
          Topic names and colors come from sample-document labels. They are not
          model-generated classifications. Distinct-looking clusters are useful
          visual evidence, not proof of semantic understanding.
        </p>
      </details>
    </section>
  );
}
