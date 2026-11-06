import type { Vec3 } from "../math/vector";

export type SmallCorpusProjection = {
  positions: Vec3[];
  transform: (query: number[]) => Vec3;
};

const dot = (a: number[], b: number[]) =>
  a.reduce((sum, value, axis) => sum + value * b[axis], 0);

/** Centered PCA for one to seven samples, in any finite embedding dimension.
 * Diagonalize the at-most-7×7 Gram matrix, then lift its eigenvectors into
 * embedding space. This avoids initialization-sensitive power iteration
 * without allocating a 384×384 covariance matrix. Missing principal
 * directions remain zero; coincident points get no synthetic jitter. */
export function fitSmallCorpusProjection(
  data: number[][],
): SmallCorpusProjection {
  if (
    !data.length ||
    data.length > 7 ||
    !data[0].length ||
    data.some(
      (row) => row.length !== data[0].length || !row.every(Number.isFinite),
    )
  )
    throw new Error(
      "Small-corpus projection requires one to seven finite, equally sized embeddings.",
    );
  const count = data.length;
  const dimension = data[0].length;
  // Reference centering keeps identical rows exactly coincident, even when
  // their coordinates cannot be represented exactly as binary fractions.
  const mean = data[0].map(
    (reference, axis) =>
      reference +
      data.reduce((sum, row) => sum + (row[axis] - reference) / count, 0),
  );
  const centered = data.map((row) =>
    row.map((value, axis) => value - mean[axis]),
  );
  const maximum = centered.reduce(
    (largest, row) =>
      row.reduce(
        (magnitude, value) => Math.max(magnitude, Math.abs(value)),
        largest,
      ),
    0,
  );
  if (!Number.isFinite(maximum))
    throw new Error("Embedding values exceed the supported projection range.");
  const components: number[][] = [];
  if (maximum > 0) {
    // Uniform scaling prevents Gram underflow without changing eigenvectors.
    const scaled = centered.map((row) => row.map((value) => value / maximum));
    const gram = scaled.map((row) => scaled.map((other) => dot(row, other)));
    const eigenvectors = Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, column) => Number(row === column)),
    );
    const tolerance = Math.max(...gram.flat().map(Math.abs)) * 1e-14;
    for (let iteration = 0; iteration < 100 * count * count; iteration++) {
      let p = 0,
        q = 0,
        largest = 0;
      for (let row = 0; row < count; row++)
        for (let column = row + 1; column < count; column++) {
          if (Math.abs(gram[row][column]) > largest) {
            p = row;
            q = column;
            largest = Math.abs(gram[row][column]);
          }
        }
      if (largest <= tolerance) break;
      const app = gram[p][p],
        aqq = gram[q][q],
        apq = gram[p][q];
      const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(angle),
        s = Math.sin(angle);
      for (let row = 0; row < count; row++) {
        if (row !== p && row !== q) {
          const aip = gram[row][p],
            aiq = gram[row][q];
          gram[row][p] = gram[p][row] = c * aip - s * aiq;
          gram[row][q] = gram[q][row] = s * aip + c * aiq;
        }
        const vip = eigenvectors[row][p],
          viq = eigenvectors[row][q];
        eigenvectors[row][p] = c * vip - s * viq;
        eigenvectors[row][q] = s * vip + c * viq;
      }
      gram[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      gram[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      gram[p][q] = gram[q][p] = 0;
    }
    const eigenvalues = Array.from({ length: count }, (_, axis) => ({
      axis,
      value: Math.max(0, gram[axis][axis]),
    })).sort((a, b) => b.value - a.value || a.axis - b.axis);
    const rankTolerance = eigenvalues[0].value * 1e-12;
    for (const eigenvalue of eigenvalues) {
      if (components.length >= Math.min(3, count - 1, dimension)) break;
      if (eigenvalue.value <= rankTolerance) continue;
      let component = Array.from(
        { length: dimension },
        (_, axis) =>
          scaled.reduce(
            (sum, row, index) =>
              sum + row[axis] * eigenvectors[index][eigenvalue.axis],
            0,
          ) / Math.sqrt(eigenvalue.value),
      );
      // Remove the small loss of orthogonality incurred while lifting vectors.
      for (let pass = 0; pass < 2; pass++)
        for (const prior of components) {
          const amount = dot(component, prior);
          component = component.map(
            (value, axis) => value - amount * prior[axis],
          );
        }
      const length = Math.hypot(...component);
      if (length < 1e-12) continue;
      component = component.map((value) => value / length);
      const largestAxis = component.reduce(
        (best, value, axis) =>
          Math.abs(value) > Math.abs(component[best]) ? axis : best,
        0,
      );
      const sign = component[largestAxis] < 0 ? -1 : 1;
      components.push(component.map((value) => value * sign));
    }
  }
  const transform = (query: number[]): Vec3 => {
    if (query.length !== dimension || !query.every(Number.isFinite))
      throw new Error("Query dimensions do not match the projection.");
    const centeredQuery = query.map((value, axis) => value - mean[axis]);
    const coordinates = [0, 1, 2].map((axis) =>
      components[axis] ? dot(centeredQuery, components[axis]) : 0,
    ) as Vec3;
    if (!coordinates.every(Number.isFinite))
      throw new Error("Query values exceed the supported projection range.");
    return coordinates;
  };
  return { positions: data.map(transform), transform };
}
