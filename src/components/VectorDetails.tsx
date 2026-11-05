import { Compass } from "lucide-react";
import type { Vec3 } from "../math/vector";
import { formatNumber, formatVector } from "../lessons/operations";

export default function VectorDetails({
  vectors,
  selectedId,
  onSelect,
}: {
  vectors: Array<{ id: string; label: string; coordinates: Vec3 }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected =
    vectors.find((vector) => vector.id === selectedId) ?? vectors[0];
  if (!selected) return null;
  const length = Math.hypot(...selected.coordinates);
  const azimuth = length
    ? (Math.atan2(selected.coordinates[1], selected.coordinates[0]) * 180) /
      Math.PI
    : null;
  const inclination = length
    ? (Math.acos(Math.max(-1, Math.min(1, selected.coordinates[2] / length))) *
        180) /
      Math.PI
    : null;
  return (
    <section className="vector-details" aria-label="Vector details">
      <div className="vector-detail-heading">
        <span>
          <Compass size={15} />
          INSPECT A VECTOR
        </span>
        <select
          aria-label="Inspect vector"
          value={selected.id}
          onChange={(event) => onSelect(event.target.value)}
        >
          {vectors.map((vector) => (
            <option key={vector.id} value={vector.id}>
              {vector.label}
            </option>
          ))}
        </select>
      </div>
      <dl>
        <div>
          <dt>Cartesian coordinates</dt>
          <dd>{formatVector(selected.coordinates)}</dd>
        </div>
        <div>
          <dt>Magnitude r</dt>
          <dd>{formatNumber(length)}</dd>
        </div>
        <div>
          <dt>Azimuth</dt>
          <dd>
            {azimuth === null ? "Undefined" : `${formatNumber(azimuth)}°`}
          </dd>
        </div>
        <div>
          <dt>Inclination</dt>
          <dd>
            {inclination === null
              ? "Undefined"
              : `${formatNumber(inclination)}°`}
          </dd>
        </div>
      </dl>
      <p>
        {length
          ? "Spherical readouts describe the same vector in alternate coordinates. Click an arrow or use the selector to inspect it."
          : "The zero vector has no direction: its unit vector and spherical angles are undefined."}
      </p>
    </section>
  );
}
