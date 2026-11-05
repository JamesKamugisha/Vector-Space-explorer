import type { TeachingVector } from "./model";

export type PcaModel = {
  mean: number[];
  components: number[][];
  eigenvalues: number[];
  explainedVariance: number[];
  totalVariance: number;
};

const dot = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + value * b[i], 0);
const validVector = (vector: number[]) =>
  vector.length > 0 && vector.every(Number.isFinite);

/** Centered PCA using a deterministic Jacobi eigensolver for symmetric covariance. */
export function fitPca(data: number[][], count = 3): PcaModel {
  if (
    data.length < 2 ||
    !validVector(data[0]) ||
    data.some((row) => row.length !== data[0].length || !validVector(row))
  ) {
    throw new Error(
      "PCA requires at least two finite vectors of equal nonzero dimension.",
    );
  }
  const dimension = data[0].length;
  const componentCount = Math.max(
    1,
    Math.min(dimension, Number.isFinite(count) ? Math.floor(count) : 3),
  );
  const mean = Array.from({ length: dimension }, (_, axis) =>
    data.reduce((sum, row) => sum + row[axis] / data.length, 0),
  );
  const centered = data.map((row) =>
    row.map((value, axis) => value - mean[axis]),
  );
  const covariance = Array.from({ length: dimension }, (_, i) =>
    Array.from({ length: dimension }, (_, j) =>
      centered.reduce(
        (sum, row) => sum + (row[i] * row[j]) / (data.length - 1),
        0,
      ),
    ),
  );
  const eigenvectors = Array.from({ length: dimension }, (_, i) =>
    Array.from({ length: dimension }, (_, j) => Number(i === j)),
  );
  const scale = Math.max(...covariance.flat().map(Math.abs));
  const tolerance = scale * 1e-13;

  for (
    let iteration = 0;
    iteration < 100 * dimension * dimension;
    iteration++
  ) {
    let p = 0;
    let q = 0;
    let largest = 0;
    for (let i = 0; i < dimension; i++)
      for (let j = i + 1; j < dimension; j++) {
        if (Math.abs(covariance[i][j]) > largest) {
          largest = Math.abs(covariance[i][j]);
          p = i;
          q = j;
        }
      }
    if (largest <= tolerance) break;
    const angle =
      0.5 *
      Math.atan2(2 * covariance[p][q], covariance[q][q] - covariance[p][p]);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const app = covariance[p][p];
    const aqq = covariance[q][q];
    const apq = covariance[p][q];
    for (let i = 0; i < dimension; i++) {
      if (i !== p && i !== q) {
        const aip = covariance[i][p];
        const aiq = covariance[i][q];
        covariance[i][p] = covariance[p][i] = c * aip - s * aiq;
        covariance[i][q] = covariance[q][i] = s * aip + c * aiq;
      }
      const vip = eigenvectors[i][p];
      const viq = eigenvectors[i][q];
      eigenvectors[i][p] = c * vip - s * viq;
      eigenvectors[i][q] = s * vip + c * viq;
    }
    covariance[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    covariance[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    covariance[p][q] = covariance[q][p] = 0;
  }
  const eigensystem = Array.from({ length: dimension }, (_, axis) => {
    const component = eigenvectors.map((row) => row[axis]);
    let largestAxis = 0;
    for (let i = 1; i < dimension; i++)
      if (Math.abs(component[i]) > Math.abs(component[largestAxis]))
        largestAxis = i;
    const sign = component[largestAxis] < 0 ? -1 : 1;
    return {
      component: component.map((value) => value * sign),
      eigenvalue: Math.max(0, covariance[axis][axis]),
      axis,
    };
  }).sort((a, b) => b.eigenvalue - a.eigenvalue || a.axis - b.axis);
  const totalVariance = eigensystem.reduce(
    (sum, item) => sum + item.eigenvalue,
    0,
  );
  return {
    mean,
    components: eigensystem
      .slice(0, componentCount)
      .map((item) => item.component),
    eigenvalues: eigensystem
      .slice(0, componentCount)
      .map((item) => item.eigenvalue),
    explainedVariance: eigensystem
      .slice(0, componentCount)
      .map((item) => (totalVariance > 0 ? item.eigenvalue / totalVariance : 0)),
    totalVariance,
  };
}

export function projectPca(vector: number[], model: PcaModel): TeachingVector {
  if (!validVector(vector) || vector.length !== model.mean.length)
    throw new Error(
      "Vector must match the PCA model dimension and contain finite numbers.",
    );
  const centered = vector.map((value, axis) => value - model.mean[axis]);
  const coordinates = model.components
    .slice(0, 3)
    .map((component) => dot(centered, component));
  return [coordinates[0] ?? 0, coordinates[1] ?? 0, coordinates[2] ?? 0];
}

export function cosineNd(a: number[], b: number[]): number | null {
  if (!validVector(a) || !validVector(b) || a.length !== b.length) return null;
  const la = Math.hypot(...a);
  const lb = Math.hypot(...b);
  if (la === 0 || lb === 0) return null;
  return Math.max(
    -1,
    Math.min(
      1,
      a.reduce((sum, value, axis) => sum + (value / la) * (b[axis] / lb), 0),
    ),
  );
}

export function distanceNd(a: number[], b: number[]): number {
  if (!validVector(a) || !validVector(b) || a.length !== b.length)
    throw new Error(
      "Distance requires finite vectors of equal nonzero dimension.",
    );
  return Math.hypot(...a.map((value, axis) => value - b[axis]));
}

/** Synthetic 4D data: the fourth coordinate has little variance and PCA drops it. */
export const pcaDataset = [
  {
    id: "pca-a",
    label: "Point A",
    vector: [4, 0, 0, 0],
    category: "Synthetic 4D point",
  },
  {
    id: "pca-b",
    label: "Point B",
    vector: [0, 4, 0, 0],
    category: "Synthetic 4D point",
  },
  {
    id: "pca-c",
    label: "Point C",
    vector: [0, 0, 4, 0],
    category: "Synthetic 4D point",
  },
  {
    id: "pca-d",
    label: "Point D",
    vector: [-4, 0, 0, 0],
    category: "Synthetic 4D point",
  },
  {
    id: "pca-e",
    label: "Point E",
    vector: [0, -4, 0, 0],
    category: "Synthetic 4D point",
  },
  {
    id: "pca-f",
    label: "Point F",
    vector: [0, 0, -4, 0],
    category: "Synthetic 4D point",
  },
  {
    id: "pca-g",
    label: "Point G · +fourth",
    vector: [1.2, 0.2, 0.5, 0.9],
    category: "Synthetic 4D point",
  },
  {
    id: "pca-h",
    label: "Point H · −fourth",
    vector: [1.2, 0.2, 0.5, -0.9],
    category: "Synthetic 4D point",
  },
];
export const pcaQueries = [
  { id: "hidden", label: "A hidden fourth direction", vector: [2, 1, 1, 6] },
  {
    id: "opposite",
    label: "Reverse the fourth coordinate",
    vector: [2, 1, 1, -6],
  },
  { id: "visible", label: "Mostly visible direction", vector: [4, 1, 0, 0.1] },
];
export const pcaModel = fitPca(pcaDataset.map((point) => point.vector));

export function getPcaView(queryId: string) {
  const queryOriginal = (
    pcaQueries.find((item) => item.id === queryId) ?? pcaQueries[0]
  ).vector;
  const query = projectPca(queryOriginal, pcaModel);
  const rows = pcaDataset
    .map((point) => {
      const position = projectPca(point.vector, pcaModel);
      return {
        id: point.id,
        label: point.label,
        vector: point.vector,
        position,
        originalCosine: cosineNd(queryOriginal, point.vector),
        projectedCosine: cosineNd(query, position),
        originalDistance: distanceNd(queryOriginal, point.vector),
        projectedDistance: distanceNd(query, position),
      };
    })
    .sort(
      (a, b) =>
        (b.originalCosine ?? -2) - (a.originalCosine ?? -2) ||
        a.id.localeCompare(b.id),
    );
  return {
    query,
    queryOriginal,
    rows,
    points: rows.map((row) => ({
      id: row.id,
      label: row.label,
      position: row.position,
      color:
        row.id === "pca-g"
          ? "#64d9be"
          : row.id === "pca-h"
            ? "#f6b76f"
            : "#6ba5ff",
      score: row.originalCosine ?? 0,
    })),
    explainedVariance: pcaModel.explainedVariance,
  };
}
