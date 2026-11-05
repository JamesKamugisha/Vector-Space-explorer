import { add, sub } from "../math/vector";
import type { Vec3 } from "../math/vector";
import { formatVector } from "../lessons/operations";

export const analogyPoints: Array<{
  id: string;
  label: string;
  position: Vec3;
  color: string;
}> = [
  { id: "paris", label: "Paris", position: [3, 0, 0], color: "#6ba5ff" },
  { id: "france", label: "France", position: [1, 0, 0], color: "#eaa28c" },
  { id: "italy", label: "Italy", position: [1, 1, 0], color: "#a69be8" },
  { id: "rome", label: "Rome", position: [3, 1, 0], color: "#64d9be" },
];
export function analogyResult(reverse = false): Vec3 {
  return reverse
    ? add(sub([3, 1, 0], [1, 1, 0]), [1, 0, 0])
    : add(sub([3, 0, 0], [1, 0, 0]), [1, 1, 0]);
}
export default function AnalogyLesson({
  reverse,
  onReverse,
}: {
  reverse: boolean;
  onReverse: (v: boolean) => void;
}) {
  const city = reverse ? "Rome" : "Paris",
    country = reverse ? "Italy" : "France",
    targetCountry = reverse ? "France" : "Italy";
  return (
    <section className="analogy-lesson">
      <span className="section-kicker">VECTOR ARITHMETIC</span>
      <h3>Can an offset express a relation?</h3>
      <p>
        These four coordinates are deliberately constructed to make the
        capital-to-country offset identical. They are teaching vectors, not
        trained embeddings.
      </p>
      <label htmlFor="analogy-direction">Analogy preset</label>
      <select
        id="analogy-direction"
        value={reverse ? "reverse" : "forward"}
        onChange={(e) => onReverse(e.target.value === "reverse")}
      >
        <option value="forward">Paris − France + Italy</option>
        <option value="reverse">Rome − Italy + France</option>
      </select>
      <div className="analogy-equation">
        {city} − {country} + {targetCountry}
        <strong>
          {formatVector(analogyResult(reverse))} = {reverse ? "Paris" : "Rome"}
        </strong>
      </div>
      <ol>
        <li>Subtract the starting country vector from its capital vector.</li>
        <li>Add the destination country vector to the offset.</li>
        <li>Compare the computed result with the destination capital.</li>
      </ol>
      <dl>
        {analogyPoints.map((point) => (
          <div key={point.id}>
            <dt>{point.label}</dt>
            <dd>{formatVector(point.position)}</dd>
          </div>
        ))}
      </dl>
      <p>
        Real embedding arithmetic is model-dependent and need not recover an
        exact answer. This contrived equality demonstrates the operation, not
        evidence about a model.
      </p>
    </section>
  );
}
