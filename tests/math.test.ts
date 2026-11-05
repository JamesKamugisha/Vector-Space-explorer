import { describe, expect, it } from "vitest";
import {
  add,
  cross,
  dot,
  norm,
  normalize,
  nullspace,
  project,
  scale,
  solveBasis,
  spanRank,
  type Vec3,
} from "../src/math/vector";
import {
  calculateLesson,
  defaultInputs,
  type MathInputs,
  type Operation,
} from "../src/lessons/operations";

function closeVector(actual: Vec3 | null, expected: Vec3) {
  expect(actual).not.toBeNull();
  actual!.forEach((value, index) =>
    expect(value).toBeCloseTo(expected[index], 10),
  );
}

describe("vector calculations", () => {
  it("adds coordinates and supports negative and zero scales", () => {
    closeVector(add([1, 2, 1], [2, -1, 1]), [3, 1, 2]);
    closeVector(scale([1, -2, 3], -2), [-2, 4, -6]);
    closeVector(scale([1, -2, 3], 0), [0, 0, 0]);
  });
  it("normalizes with no magnitude-based cutoff", () => {
    closeVector(normalize([3, 4, 0]), [0.6, 0.8, 0]);
    closeVector(normalize([3e-200, 4e-200, 0]), [0.6, 0.8, 0]);
    closeVector(normalize([3e200, 4e200, 0]), [0.6, 0.8, 0]);
    expect(normalize([0, 0, 0])).toBeNull();
    expect(normalize([Infinity, 0, 0])).toBeNull();
  });
  it("projects with a perpendicular residual", () => {
    const p = project([3, 1, 0], [1, 1, 0]);
    closeVector(p, [2, 2, 0]);
    expect(dot([3 - p![0], 1 - p![1], 0], [1, 1, 0])).toBeCloseTo(0, 10);
    closeVector(project([3, 1, 0], [1e-200, 1e-200, 0]), [2, 2, 0]);
    expect(project([1, 2, 3], [0, 0, 0])).toBeNull();
  });
  it("classifies rank across magnitudes and input order", () => {
    expect(spanRank([0, 0, 0], [0, 0, 0])).toBe(0);
    expect(spanRank([0, 0, 0], [1, 0, 0])).toBe(1);
    expect(spanRank([1, 0, 0], [0, 0, 0])).toBe(1);
    expect(spanRank([1, 0, 0], [-2, 0, 0])).toBe(1);
    expect(spanRank([1e-200, 0, 0], [0, 1e200, 0])).toBe(2);
    expect(spanRank([1, 1, 0], [1, 1 + 1e-12, 0])).toBe(1);
  });
  it("computes right-handed cross products", () => {
    closeVector(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
    const n = cross([1, 2, 3], [4, 1, -1]);
    expect(dot(n, [1, 2, 3])).toBe(0);
    expect(dot(n, [4, 1, -1])).toBe(0);
  });
  it("solves basis coordinates and rejects dependent bases", () => {
    closeVector(
      solveBasis(
        [
          [1, 0, 0],
          [1, 1, 0],
          [0, 0, 1],
        ],
        [3, 2, 4],
      ),
      [1, 2, 4],
    );
    closeVector(
      solveBasis(
        [
          [1e-200, 0, 0],
          [0, 1e200, 0],
          [0, 0, 2],
        ],
        [1e-200, 1e200, 4],
      ),
      [1, 1, 2],
    );
    expect(
      solveBasis(
        [
          [1, 0, 0],
          [2, 0, 0],
          [0, 0, 1],
        ],
        [1, 1, 1],
      ),
    ).toBeNull();
    expect(
      solveBasis(
        [
          [0, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        [1, 1, 1],
      ),
    ).toBeNull();
    expect(
      solveBasis(
        [
          [1, 0, 0],
          [1, 1e-12, 0],
          [0, 0, 1],
        ],
        [1, 1, 1],
      ),
    ).toBeNull();
    expect(
      solveBasis(
        [
          [Infinity, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        [1, 1, 1],
      ),
    ).toBeNull();
  });
  it("pivots basis equations and reconstructs multiple independent fixtures", () => {
    const fixtures: Array<[Vec3, Vec3, Vec3]> = [
      [
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 0],
      ],
      [
        [2, 3, -1],
        [4, 0, 2],
        [-3, 1, 2],
      ],
      [
        [1, 2, 3],
        [0, 1, 2],
        [4, 0, 1],
      ],
    ];
    const coefficients: Vec3 = [2, -3, 0.5];
    for (const basis of fixtures) {
      const target = add(
        add(scale(basis[0], coefficients[0]), scale(basis[1], coefficients[1])),
        scale(basis[2], coefficients[2]),
      );
      closeVector(solveBasis(basis, target), coefficients);
    }
  });
});

describe("homogeneous systems", () => {
  it("solves x-y=0, x-z=0", () => {
    const result = nullspace([
      [1, -1, 0],
      [1, 0, -1],
    ])!;
    expect(result.rank).toBe(2);
    closeVector(result.basis[0], [1, 1, 1]);
  });
  it("handles nullity zero through three", () => {
    expect(
      nullspace([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])!.basis,
    ).toHaveLength(0);
    expect(nullspace([[1, 1, 1]])!.basis).toHaveLength(2);
    expect(nullspace([[0, 0, 0]])!.basis).toHaveLength(3);
    expect(nullspace([])!.basis).toHaveLength(3);
    expect(nullspace([[1, 2]])).toBeNull();
  });
  it("preserves the kernel under equation rescaling", () => {
    const result = nullspace([
      [1e-200, -1e-200, 0],
      [1e200, 0, -1e200],
    ])!;
    closeVector(result.basis[0], [1, 1, 1]);
  });
  it("returns generators that actually satisfy each equation", () => {
    const fixtures = [
      [
        [0, 1, 2],
        [0, 2, 4],
        [0, 0, 0],
      ],
      [
        [0, 0, 0],
        [2, -3, 4],
        [4, -6, 8],
        [-2, 3, -4],
      ],
      [
        [0, 2, 1],
        [1, 0, -2],
        [2, 0, -4],
      ],
    ];
    for (const matrix of fixtures) {
      const result = nullspace(matrix)!;
      expect(result.rank + result.basis.length).toBe(3);
      for (const generator of result.basis) {
        expect(norm(generator)).toBeGreaterThan(0);
        matrix.forEach((row) =>
          expect(dot(row as Vec3, generator)).toBeCloseTo(0, 10),
        );
      }
    }
    expect(nullspace([[1, NaN, 0]])).toBeNull();
    expect(nullspace([[1, Infinity, 0]])).toBeNull();
  });
});

describe("lesson derivation", () => {
  it("derives correct results for the source fixtures", () => {
    closeVector(calculateLesson("add", defaultInputs).result!, [3, 1, 2]);
    closeVector(calculateLesson("basis", defaultInputs).result!, [3, 2, 4]);
    expect(calculateLesson("nullspace", defaultInputs).nullBasis).toEqual([
      [1, 1, 1],
    ]);
  });
  it("returns explicit errors rather than nonfinite geometry", () => {
    const inputs = {
      ...defaultInputs,
      u: [0, 0, 0] as Vec3,
      v: [0, 0, 0] as Vec3,
    };
    expect(calculateLesson("normalize", inputs).warning).toBeTruthy();
    expect(calculateLesson("project", inputs).warning).toBeTruthy();
    expect(calculateLesson("span", inputs).rank).toBe(0);
    expect(calculateLesson("dot", inputs).value).toContain("angle undefined");
  });
  it("makes Gram–Schmidt outputs orthonormal without changing the span", () => {
    const inputs: MathInputs = { ...defaultInputs, u: [1, 1, 0], v: [1, 0, 0] };
    const result = calculateLesson("gramSchmidt", inputs);
    expect(norm(result.result!)).toBeCloseTo(1, 10);
    expect(norm(result.secondary!)).toBeCloseTo(1, 10);
    expect(dot(result.result!, result.secondary!)).toBeCloseTo(0, 10);
    expect(result.result![2]).toBe(0);
    expect(result.secondary![2]).toBe(0);
    expect(
      calculateLesson("gramSchmidt", { ...inputs, v: [2, 2, 0] }).warning,
    ).toBeTruthy();
  });
  it("keeps Gram–Schmidt perpendicular for nearly parallel independent inputs", () => {
    const result = calculateLesson("gramSchmidt", {
      ...defaultInputs,
      u: [1, 2, 3],
      v: [1 + 1e-8, 2, 3],
    });
    expect(result.warning).toBeUndefined();
    expect(norm(result.result!)).toBeCloseTo(1, 12);
    expect(norm(result.secondary!)).toBeCloseTo(1, 12);
    expect(dot(result.result!, result.secondary!)).toBeCloseTo(0, 12);
  });
  it("warns on near-singular bases and numerical rank collapse", () => {
    const basis: [Vec3, Vec3, Vec3] = [
      [1, 0, 0],
      [1, 1e-7, 0],
      [0, 0, 1],
    ];
    const basisResult = calculateLesson("basis", {
      ...defaultInputs,
      basis,
      target: [2, 1e-7, 1],
    });
    expect(basisResult.warning).toContain("nearly dependent");
    closeVector(basisResult.result!, [2, 1e-7, 1]);
    const rankResult = calculateLesson("independence", {
      ...defaultInputs,
      u: [1, 0, 0],
      v: [1, 1e-12, 0],
    });
    expect(rankResult.rank).toBe(1);
    expect(rankResult.warning).toContain("exact mathematical span");
  });
  it("handles parallel, antiparallel, and zero angles correctly", () => {
    expect(
      calculateLesson("dot", { ...defaultInputs, u: [1, 0, 0], v: [1, 0, 0] })
        .value,
    ).toContain("θ = 0°");
    expect(
      calculateLesson("dot", { ...defaultInputs, u: [1, 0, 0], v: [-1, 0, 0] })
        .value,
    ).toContain("θ = 180°");
    expect(
      calculateLesson("dot", { ...defaultInputs, u: [1, 0, 0], v: [0, 1, 0] })
        .value,
    ).toContain("θ = 90°");
  });
  it("every registered operation yields an explanation and steps", () => {
    const operations: Operation[] = [
      "add",
      "scale",
      "combination",
      "normalize",
      "span",
      "independence",
      "project",
      "basis",
      "dot",
      "cross",
      "gramSchmidt",
      "nullspace",
    ];
    for (const op of operations) {
      const result = calculateLesson(op, defaultInputs);
      expect(result.steps.length).toBeGreaterThan(1);
      expect(result.concept.length).toBeGreaterThan(10);
      expect(result.value).not.toContain("NaN");
    }
  });
});
