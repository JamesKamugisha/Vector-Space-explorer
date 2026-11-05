import { useEffect, useMemo } from "react";
import { getPcaView, pcaModel, pcaQueries } from "./pca";
import "./ai.css";

type PcaLessonProps = {
  queryId: string;
  onQueryIdChange: (id: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
};
const format = (values: number[]) =>
  `(${values.map((value) => Number(value.toFixed(3))).join(", ")})`;

export default function PcaLesson({
  queryId,
  onQueryIdChange,
  selectedId,
  onSelect,
}: PcaLessonProps) {
  const view = useMemo(() => getPcaView(queryId), [queryId]);
  const selected =
    view.rows.find((row) => row.id === selectedId) ?? view.rows[0];
  const retained = view.explainedVariance.reduce(
    (sum, value) => sum + value,
    0,
  );
  useEffect(() => {
    onSelect(view.rows[0].id);
  }, [view, onSelect]);
  return (
    <section className="ai-panel pca-panel" aria-label="PCA educational lesson">
      <div className="ai-section">
        <div className="ai-section-heading">
          <span className="ai-eyebrow">4D → 3D / COMPUTED PCA</span>
          <span className="ai-simulation-badge">Synthetic</span>
        </div>
        <h3 className="pca-title">A useful view loses information.</h3>
        <p className="ai-helper">
          Eight invented 4D points are centered and projected onto their three
          principal components. This is a real PCA calculation on synthetic
          numbers, not real embeddings.
        </p>
        <label className="ai-input-label pca-query-label" htmlFor="pca-query">
          Choose a 4D query
        </label>
        <select
          id="pca-query"
          value={queryId}
          onChange={(event) => onQueryIdChange(event.target.value)}
        >
          {pcaQueries.map((query) => (
            <option key={query.id} value={query.id}>
              {query.label}
            </option>
          ))}
        </select>
        <div className="ai-query-vector">
          <span>
            Original 4D
            <br />
            <strong>{format(view.queryOriginal)}</strong>
          </span>
        </div>
        <div className="ai-query-vector">
          <span>
            Projected 3D
            <br />
            <strong>{format(view.query)}</strong>
          </span>
        </div>
        <p className="ai-notice">
          PCA projection (approximate visualization). Scores and retrieval order
          use all four original dimensions. Visible distances can differ.
        </p>
      </div>
      <div className="ai-section">
        <div className="ai-section-heading">
          <span className="ai-eyebrow">VARIANCE RETAINED</span>
          <strong className="pca-retained">
            {(retained * 100).toFixed(2)}%
          </strong>
        </div>
        <div className="pca-variance-bar">
          {view.explainedVariance.map((value, index) => (
            <span
              key={index}
              style={{
                width: `${value * 100}%`,
                background: ["#426aab", "#138273", "#a66c32"][index],
              }}
              title={`PC${index + 1}: ${(value * 100).toFixed(2)}%`}
            />
          ))}
        </div>
        <p className="ai-helper">
          {view.explainedVariance
            .map(
              (value, index) => `PC${index + 1}: ${(value * 100).toFixed(2)}%`,
            )
            .join(" · ")}
        </p>
        <p className="ai-helper">
          High retained variance does not guarantee preserved neighbors or
          cosine values. Points G and H differ only in the discarded fourth
          coordinate and overlap in the 3D view.
        </p>
      </div>
      <div className="ai-section">
        <div className="ai-section-heading">
          <span className="ai-eyebrow">RANKED IN ORIGINAL 4D</span>
          <span className="ai-count">Cosine ↓</span>
        </div>
        <div className="pca-score-head">
          <span>Point</span>
          <span>4D score</span>
          <span>3D score</span>
        </div>
        <div className="ai-ranked-list">
          {view.rows.map((row, index) => (
            <button
              type="button"
              key={row.id}
              onClick={() => onSelect(row.id)}
              aria-pressed={selected.id === row.id}
              className={`ai-document-row pca-score-row ${selected.id === row.id ? "selected" : ""}`}
            >
              <span className="ai-document-info">
                <strong>
                  {index + 1}. {row.label}
                </strong>
              </span>
              <span>{row.originalCosine?.toFixed(3) ?? "—"}</span>
              <span>{row.projectedCosine?.toFixed(3) ?? "—"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ai-section">
        <div className="ai-section-heading">
          <span className="ai-eyebrow">SELECTED POINT</span>
        </div>
        <strong className="pca-selected-title">{selected.label}</strong>
        <p className="ai-helper">
          Original 4D: <code>{format(selected.vector)}</code>
          <br />
          Projected 3D: <code>{format(selected.position)}</code>
        </p>
        <dl className="ai-selected-metrics">
          <div>
            <dt>4D distance</dt>
            <dd>{selected.originalDistance.toFixed(3)}</dd>
          </div>
          <div>
            <dt>3D distance</dt>
            <dd>{selected.projectedDistance.toFixed(3)}</dd>
          </div>
        </dl>
      </div>
      <details className="ai-section ai-method-details">
        <summary>
          Inspect the PCA calculation <span aria-hidden="true">+</span>
        </summary>
        <p className="ai-helper">
          1. Subtract the dataset mean.
          <br />
          2. Calculate the sample covariance matrix.
          <br />
          3. Find orthonormal eigenvectors and sort by eigenvalue.
          <br />
          4. Project centered points onto the top three eigenvectors.
          <br />
          5. Keep similarity calculations in the original 4D coordinates.
        </p>
        <p className="ai-helper">
          Mean: <code>{format(pcaModel.mean)}</code>
        </p>
        {pcaModel.components.map((component, index) => (
          <p className="ai-helper" key={index}>
            PC{index + 1}: <code>{format(component)}</code>
            <br />
            Eigenvalue: {pcaModel.eigenvalues[index].toFixed(4)}
          </p>
        ))}
        <p className="ai-helper">
          The query uses the fitted dataset mean and components; it is not
          included when fitting PCA. Real embedding models and live AI services
          remain outside this demo.
        </p>
      </details>
    </section>
  );
}
