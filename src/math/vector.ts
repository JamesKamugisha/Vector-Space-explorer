/** Pure mathematics. Coordinates are mathematical XYZ (Z up in the renderer). */
export type Vec3 = [number, number, number];
export const RELATIVE_TOLERANCE = 1e-10;
export const finiteVector = (v: Vec3): boolean => v.every(Number.isFinite);
export const add = (u: Vec3, v: Vec3): Vec3 => [
  u[0] + v[0],
  u[1] + v[1],
  u[2] + v[2],
];
export const sub = (u: Vec3, v: Vec3): Vec3 => [
  u[0] - v[0],
  u[1] - v[1],
  u[2] - v[2],
];
export const scale = (u: Vec3, a: number): Vec3 => [
  u[0] * a,
  u[1] * a,
  u[2] * a,
];
export const dot = (u: Vec3, v: Vec3): number =>
  u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
export const cross = (u: Vec3, v: Vec3): Vec3 => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
];
export const norm = (u: Vec3): number => Math.hypot(...u);

export function normalize(u: Vec3): Vec3 | null {
  if (!finiteVector(u)) return null;
  const m = Math.max(...u.map(Math.abs));
  if (m === 0) return null;
  const scaled: Vec3 = [u[0] / m, u[1] / m, u[2] / m];
  return scale(scaled, 1 / norm(scaled));
}

export function project(u: Vec3, v: Vec3): Vec3 | null {
  const q = normalize(v);
  if (!q || !finiteVector(u)) return null;
  const p = scale(q, dot(u, q));
  return finiteVector(p) ? p : null;
}

/** The rank of two generators, independent of their absolute magnitudes. */
export function spanRank(u: Vec3, v: Vec3): 0 | 1 | 2 {
  const q1 = normalize(u);
  const q2 = normalize(v);
  if (!q1 && !q2) return 0;
  if (!q1 || !q2) return 1;
  return norm(cross(q1, q2)) > RELATIVE_TOLERANCE ? 2 : 1;
}

/** Scaled partial pivoting; rejects a numerically singular basis. */
export function solveBasis(
  basis: [Vec3, Vec3, Vec3],
  target: Vec3,
): Vec3 | null {
  if (!basis.every(finiteVector) || !finiteVector(target)) return null;
  // Normalize columns before elimination so units do not determine rank.
  const columnScales = basis.map((v) => Math.max(...v.map(Math.abs)));
  if (columnScales.some((m) => m === 0)) return null;
  const a = [0, 1, 2].map((row) => [
    basis[0][row] / columnScales[0],
    basis[1][row] / columnScales[1],
    basis[2][row] / columnScales[2],
    target[row],
  ]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) <= RELATIVE_TOLERANCE) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j < 4; j++) a[col][j] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j < 4; j++) a[row][j] -= factor * a[col][j];
    }
  }
  const answer: Vec3 = [
    a[0][3] / columnScales[0],
    a[1][3] / columnScales[1],
    a[2][3] / columnScales[2],
  ];
  return finiteVector(answer) ? answer : null;
}

export type NullspaceResult = {
  basis: Vec3[];
  rank: number;
  reduced: number[][];
};

/** Computes ker(A) for a finite m by 3 matrix. Empty matrix has all of R3. */
export function nullspace(matrix: number[][]): NullspaceResult | null {
  if (matrix.some((row) => row.length !== 3 || !row.every(Number.isFinite)))
    return null;
  // Each equation may be rescaled without changing its solution space.
  const a = matrix.map((row) => {
    const m = Math.max(...row.map(Math.abs));
    return m === 0 ? [0, 0, 0] : row.map((value) => value / m);
  });
  const pivots: number[] = [];
  let pivotRow = 0;
  for (let col = 0; col < 3 && pivotRow < a.length; col++) {
    let pivot = pivotRow;
    for (let row = pivotRow + 1; row < a.length; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) <= RELATIVE_TOLERANCE) continue;
    [a[pivotRow], a[pivot]] = [a[pivot], a[pivotRow]];
    const divisor = a[pivotRow][col];
    for (let j = 0; j < 3; j++) a[pivotRow][j] /= divisor;
    for (let row = 0; row < a.length; row++) {
      if (row === pivotRow) continue;
      const factor = a[row][col];
      for (let j = 0; j < 3; j++) a[row][j] -= factor * a[pivotRow][j];
    }
    pivots.push(col);
    pivotRow++;
  }
  const basis: Vec3[] = [];
  for (let free = 0; free < 3; free++) {
    if (pivots.includes(free)) continue;
    const v: Vec3 = [0, 0, 0];
    v[free] = 1;
    pivots.forEach((col, row) => {
      v[col] = -a[row][free];
    });
    basis.push(v);
  }
  return { basis, rank: pivots.length, reduced: a };
}
