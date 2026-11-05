import { useEffect, useMemo, useState } from "react";
import {
  corpus,
  clampPointCount,
  cosineSimilarity,
  encodeQuery,
  extractAnswer,
  euclideanDistance,
  featureColors,
  featureNames,
  featureTerms,
  queryPresets,
  rankDocuments,
  retrieveContext,
  vectorText,
  type AiMetric,
  type AiDocument,
} from "./model";
import "./ai.css";

export type AiPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  metric: AiMetric;
  onMetricChange: (metric: AiMetric) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  normalized: boolean;
  onNormalizedChange: (value: boolean) => void;
  pointCount?: number;
  onPointCountChange?: (value: number) => void;
  documents?: AiDocument[];
  representation?: "teaching" | "counts";
  onRepresentationChange?: (mode: "teaching" | "counts") => void;
};

export default function AiPanel({
  query,
  onQueryChange,
  metric,
  onMetricChange,
  selectedId,
  onSelect,
  normalized,
  onNormalizedChange,
  pointCount = corpus.length,
  onPointCountChange,
  documents = corpus,
  representation = "teaching",
  onRepresentationChange,
}: AiPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [stage, setStage] = useState(0);
  const [showMatrix, setShowMatrix] = useState(false);
  const [countText, setCountText] = useState(String(pointCount));
  useEffect(() => setCountText(String(pointCount)), [pointCount]);
  const vector = useMemo(() => encodeQuery(query), [query]);
  const ranking = useMemo(
    () => rankDocuments(vector, metric, documents),
    [vector, metric, documents],
  );
  const valid = vector.some((value) => value !== 0);
  const selected =
    documents.find((document) => document.id === selectedId) ??
    (valid ? ranking[0]?.document : undefined);
  const retrieved = useMemo(
    () => retrieveContext(vector, metric, 2, documents),
    [vector, metric, documents],
  );
  const answer = useMemo(() => extractAnswer(retrieved), [retrieved]);
  const selectedCosine = selected
    ? cosineSimilarity(vector, selected.vector)
    : null;
  const selectedAngle =
    selectedCosine === null
      ? null
      : (Math.acos(selectedCosine) * 180) / Math.PI;
  const selectedDistance =
    valid && selected ? euclideanDistance(vector, selected.vector) : null;
  // A new search focuses its best result; clicking a document afterwards remains manual.
  useEffect(() => {
    setStage(0);
    onSelect(valid ? (ranking[0]?.document.id ?? "") : "");
  }, [ranking, valid, onSelect]);

  return (
    <section className="ai-panel" aria-label="AI and LLM lab controls">
      <div className="ai-section ai-query-section">
        <div className="ai-section-heading">
          <span className="ai-eyebrow">01 / YOUR QUERY</span>
          <span className="ai-local-badge">
            <i />
            Runs locally
          </span>
        </div>
        <label className="ai-input-label" htmlFor="semantic-query">
          What would you like to find?
        </label>
        <div className="ai-query-field">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            id="semantic-query"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Try “reset password”"
            autoComplete="off"
          />
        </div>
        <div className="ai-presets" aria-label="Example queries">
          {queryPresets.map((preset) => (
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
        <div className="ai-query-vector">
          <span>
            Query vector <strong>{vectorText(vector)}</strong>
          </span>
          <span className="ai-vector-dots">
            {featureColors.map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </span>
        </div>
        {!valid && (
          <p className="ai-notice" role="status">
            {query.trim()
              ? "No teaching keywords matched. Try a preset or inspect the feature mapping below."
              : "Enter a query or choose a preset to explore nearby documents."}
          </p>
        )}
      </div>

      <div className="ai-section">
        <div className="ai-section-heading">
          <span className="ai-eyebrow">02 / SIMILARITY METRIC</span>
        </div>
        <div
          className="ai-metric-switch"
          role="group"
          aria-label="Similarity metric"
        >
          <button
            type="button"
            aria-pressed={metric === "cosine"}
            onClick={() => onMetricChange("cosine")}
          >
            <span>∠</span> Cosine similarity
          </button>
          <button
            type="button"
            aria-pressed={metric === "euclidean"}
            onClick={() => onMetricChange("euclidean")}
          >
            <span>↔</span> Euclidean distance
          </button>
        </div>
        <p className="ai-helper">
          {metric === "cosine"
            ? "Compare direction. Higher scores mean a smaller angle."
            : "Compare straight-line distance. Lower scores mean a closer point."}
        </p>
        <label className="ai-normalize-toggle">
          <input
            type="checkbox"
            checked={normalized}
            onChange={(event) => onNormalizedChange(event.target.checked)}
          />
          <span>Plot normalized directions</span>
          <span className="ai-toggle-track" aria-hidden="true" />
        </label>
        {normalized && (
          <p className="ai-helper ai-plot-note">
            Only plotted positions are normalized. Rankings still use the
            original vectors.
          </p>
        )}
      </div>

      {onPointCountChange && (
        <div className="ai-section ai-count-section">
          <div className="ai-section-heading">
            <label htmlFor="ai-point-count" className="ai-eyebrow">
              NUMBER OF POINTS
            </label>
            <span className="ai-count">8–500</span>
          </div>
          <div className="ai-point-count-row">
            <input
              id="ai-point-count"
              type="number"
              min={8}
              max={500}
              step={1}
              value={countText}
              onChange={(event) => {
                const text = event.target.value;
                setCountText(text);
                const count = Number(text);
                if (
                  text !== "" &&
                  Number.isFinite(count) &&
                  count >= 8 &&
                  count <= 500
                )
                  onPointCountChange(Math.floor(count));
              }}
              onBlur={() => {
                const count = clampPointCount(Number(countText));
                setCountText(String(count));
                onPointCountChange(count);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <button
              type="button"
              disabled={pointCount >= 500}
              onClick={() =>
                onPointCountChange(clampPointCount(pointCount + 25))
              }
            >
              +25 points
            </button>
          </div>
          <div className="ai-count-presets" aria-label="Point count presets">
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
          <p className="ai-helper">
            {documents.length > 8
              ? `8 original examples + ${documents.length - 8} deterministic synthetic points. Added snippets are labeled synthetic.`
              : "Eight original teaching documents. Add synthetic points to explore a larger cloud."}
          </p>
        </div>
      )}

      <div className="ai-section ai-ranking-section">
        <div className="ai-section-heading">
          <span className="ai-eyebrow">03 / SEARCH RESULTS</span>
          <span className="ai-count">{documents.length} in corpus</span>
        </div>
        <div className="ai-ranked-list" aria-label="Ranked search results">
          {valid ? (
            (showAll ? ranking : ranking.slice(0, 4)).map(
              ({ document, score }, index) => (
                <button
                  type="button"
                  key={document.id}
                  className={`ai-document-row ${selected?.id === document.id ? "selected" : ""}`}
                  onClick={() => onSelect(document.id)}
                  aria-pressed={selected?.id === document.id}
                >
                  <span className="ai-rank">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="ai-document-info">
                    <strong>{document.title}</strong>
                    <small>{document.category}</small>
                  </span>
                  <span className="ai-score">
                    {score === null ? "—" : score.toFixed(3)}
                    <small>
                      {metric === "cosine" ? "similarity" : "distance"}
                    </small>
                  </span>
                </button>
              ),
            )
          ) : (
            <p className="ai-empty-results">
              No documents ranked yet.
              <br />
              Choose a recognized query to calculate scores.
            </p>
          )}
        </div>
        {valid && (
          <button
            className="ai-show-all"
            type="button"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll
              ? "Show top four"
              : `View all ${documents.length} documents`}{" "}
            <span aria-hidden="true">{showAll ? "↑" : "↓"}</span>
          </button>
        )}
        {selected && (
          <article
            className="ai-document-preview"
            aria-label="Selected document"
          >
            <div className="ai-preview-heading">
              <span className="ai-document-icon" aria-hidden="true">
                ▤
              </span>
              <strong>{selected.title}</strong>
            </div>
            <p>{selected.text}</p>
            <code>{vectorText(selected.vector)}</code>
            <span className="ai-preview-tag">
              {representation === "counts" ? "Count vector" : "Teaching vector"}
            </span>
            <dl className="ai-selected-metrics">
              <div>
                <dt>Cosine</dt>
                <dd>
                  {selectedCosine === null
                    ? "Undefined"
                    : selectedCosine.toFixed(4)}
                </dd>
              </div>
              <div>
                <dt>Angle</dt>
                <dd>
                  {selectedAngle === null
                    ? "Undefined"
                    : `${selectedAngle.toFixed(2)}°`}
                </dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>
                  {selectedDistance === null
                    ? "Undefined"
                    : selectedDistance.toFixed(4)}
                </dd>
              </div>
            </dl>
            <p className="ai-helper">
              Query ↔ selected document, computed from original 3D vectors.
            </p>
          </article>
        )}
      </div>

      <details className="ai-section ai-rag-details">
        <summary>
          <span className="ai-eyebrow">04 / RETRIEVAL TO ANSWER</span>
          <span className="ai-simulation-badge">
            Simulation <span aria-hidden="true">+</span>
          </span>
        </summary>
        <p className="ai-helper">
          Follow a miniature RAG pipeline. Answers quote local source text; no
          language model is called.
        </p>
        <div className="ai-pipeline" aria-label="RAG simulation steps">
          {["Retrieve", "Context", "Answer"].map((label, index) => (
            <button
              type="button"
              key={label}
              disabled={!valid || (index > 0 && stage < index)}
              onClick={() => setStage(index + 1)}
              className={stage >= index + 1 ? "complete" : ""}
            >
              <span>{stage > index + 1 ? "✓" : index + 1}</span>
              {label}
            </button>
          ))}
        </div>
        <div className="ai-rag-result" aria-live="polite">
          {stage === 0 && (
            <p>Start with Retrieve to find relevant source snippets.</p>
          )}
          {stage === 1 && (
            <>
              <strong>{retrieved.length} source documents retrieved</strong>
              <p>{retrieved.map((document) => document.title).join(" · ")}</p>
            </>
          )}
          {stage === 2 && (
            <>
              <strong>Context assembled from local sources</strong>
              {retrieved.map((document) => (
                <p key={document.id}>
                  <span className="ai-source-ref">[{document.id}]</span>{" "}
                  {document.text}
                </p>
              ))}
            </>
          )}
          {stage === 3 && (
            <>
              <strong>Simulated answer · extracted source text</strong>
              {answer.length ? (
                answer.map((item) => (
                  <p key={item.sourceId}>
                    {item.sentence}{" "}
                    <button
                      type="button"
                      onClick={() => onSelect(item.sourceId)}
                      className="ai-inline-source"
                    >
                      [{item.sourceId}]
                    </button>
                  </p>
                ))
              ) : (
                <p>No supporting context was found. Try another query.</p>
              )}
            </>
          )}
        </div>
      </details>

      <details className="ai-section ai-method-details">
        <summary>
          How these teaching vectors work <span aria-hidden="true">+</span>
        </summary>
        <p className="ai-helper">
          {representation === "counts"
            ? "The scene now plots document keyword counts: X is access, Y is workplace policy, and Z is food. These count vectors are a traditional representation, not LLM embeddings."
            : "These handcrafted 3D coordinates illustrate retrieval. They are not real LLM embeddings, and this keyword model does not understand language."}
        </p>
        <div className="ai-feature-list">
          {featureNames.map((name, index) => (
            <div key={name}>
              <strong>
                <i style={{ background: featureColors[index] }} />
                {["X", "Y", "Z"][index]} · {name}
              </strong>
              <p>{featureTerms[index].join(", ")}</p>
            </div>
          ))}
        </div>
        <p className="ai-helper">
          Each recognized query token adds 1 to its feature. “Sign in” and
          “sign-in” become “signin.” Document coordinates are intentionally
          handcrafted so direction and magnitude can differ.
        </p>
        <button
          type="button"
          className="ai-matrix-button"
          aria-expanded={showMatrix}
          onClick={() => setShowMatrix((value) => !value)}
        >
          {showMatrix ? "Hide" : "Explore"} term/document counts{" "}
          <span aria-hidden="true">{showMatrix ? "−" : "+"}</span>
        </button>
        {showMatrix && (
          <div className="ai-matrix-wrap">
            <p className="ai-helper">
              Counts below use the keyword rules on each document title and
              text.{" "}
              {representation === "counts"
                ? "The scene and rankings use these exact count vectors. Select a row to highlight its plotted point."
                : "Choose Plot count vectors to use these coordinates for the scene and ranking."}
            </p>
            {onRepresentationChange && (
              <button
                type="button"
                className="ai-matrix-button"
                onClick={() =>
                  onRepresentationChange(
                    representation === "counts" ? "teaching" : "counts",
                  )
                }
              >
                {representation === "counts"
                  ? "Return to teaching vectors"
                  : "Plot count vectors"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            )}
            <table className="ai-matrix">
              <caption>Feature counts in each document</caption>
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col" title="Account access">
                    X
                  </th>
                  <th scope="col" title="Workplace policy">
                    Y
                  </th>
                  <th scope="col" title="Food and dining">
                    Z
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    className={selected?.id === document.id ? "selected" : ""}
                  >
                    <th scope="row">
                      <button
                        type="button"
                        onClick={() => onSelect(document.id)}
                      >
                        {document.title}
                      </button>
                    </th>
                    {encodeQuery(`${document.title} ${document.text}`).map(
                      (count, index) => (
                        <td key={index}>{count}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      <p className="ai-footnote">
        Handcrafted teaching data · Computed scores · No external API
      </p>
    </section>
  );
}
