import { describe, expect, it } from "vitest";
import { fitSmallCorpusProjection } from "../src/real/projection";

const vector = (coordinates: Record<number, number> = {}) => {
  const result = Array<number>(384).fill(0);
  Object.entries(coordinates).forEach(([axis, value]) => {
    result[Number(axis)] = value;
  });
  return result;
};
const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((value, axis) => value - b[axis]));

describe("centered PCA for one to seven actual embedding vectors", () => {
  it("centers one point without inventing query directions", () => {
    const model = fitSmallCorpusProjection([vector({ 383: 0.7, 20: -0.3 })]);
    expect(model.positions).toEqual([[0, 0, 0]]);
    expect(model.transform(vector({ 9: 0.9 }))).toEqual([0, 0, 0]);
  });
  it("separates two points along their true line and transforms queries finitely", () => {
    const data = [vector({ 4: -2, 383: -1 }), vector({ 4: 2, 383: 1 })];
    const model = fitSmallCorpusProjection(data);
    expect(distance(model.positions[0], model.positions[1])).toBeCloseTo(
      distance(data[0], data[1]),
      12,
    );
    expect(model.positions[0][0]).toBeCloseTo(-Math.sqrt(5), 12);
    expect(model.positions[1][0]).toBeCloseTo(Math.sqrt(5), 12);
    expect(
      model.positions.every((point) => point[1] === 0 && point[2] === 0),
    ).toBe(true);
    expect(model.transform(vector({ 4: 1, 383: 0.5 }))[0]).toBeCloseTo(
      Math.sqrt(5) / 2,
      12,
    );
  });
  it("retains a rank-two plane and its pairwise geometry", () => {
    const data = [
      vector({ 3: 2, 100: 1 }),
      vector({ 3: -2, 100: 1 }),
      vector({ 3: 0, 100: -2 }),
    ];
    const model = fitSmallCorpusProjection(data);
    expect(model.positions.every((point) => point[2] === 0)).toBe(true);
    for (let i = 0; i < data.length; i++)
      for (let j = 0; j < i; j++)
        expect(distance(model.positions[i], model.positions[j])).toBeCloseTo(
          distance(data[i], data[j]),
          12,
        );
    for (let axis = 0; axis < 3; axis++)
      expect(
        model.positions.reduce((sum, point) => sum + point[axis], 0),
      ).toBeCloseTo(0, 12);
  });
  it("keeps duplicate corpora coincident without random padding or fake axes", () => {
    const row = Array(384).fill(0.1);
    const model = fitSmallCorpusProjection(
      Array.from({ length: 7 }, () => [...row]),
    );
    expect(model.positions).toEqual(Array.from({ length: 7 }, () => [0, 0, 0]));
    expect(model.transform(vector({ 2: 1 }))).toEqual([0, 0, 0]);
  });
  it("finds dominant variance when the largest sample is exactly orthogonal to it", () => {
    // Largest sample norm is2; greater aggregate variance lies along axis383.
    const data = [
      vector({ 17: 2 }),
      vector({ 17: -2 }),
      vector({ 383: 1.6 }),
      vector({ 383: -1.6 }),
      vector({ 383: 1.6 }),
      vector({ 383: -1.6 }),
      vector(),
    ];
    const model = fitSmallCorpusProjection(data);
    expect(model.positions[0][0]).toBeCloseTo(0, 12);
    expect(model.positions[2][0]).toBeCloseTo(1.6, 12);
    expect(model.positions[0][1]).toBeCloseTo(2, 12);
    expect(model.transform(vector({ 383: 3 }))[0]).toBeCloseTo(3, 12);
    expect(model.transform(vector({ 383: 3 }))[1]).toBeCloseTo(0, 12);
  });
  it("orders three nonzero principal variances in seven samples", () => {
    const data = [
      vector({ 8: 3 }),
      vector({ 8: -3 }),
      vector({ 70: 2 }),
      vector({ 70: -2 }),
      vector({ 383: 1 }),
      vector({ 383: -1 }),
      vector(),
    ];
    const model = fitSmallCorpusProjection(data);
    expect(model.positions[0][0]).toBeCloseTo(3, 12);
    expect(model.positions[2][1]).toBeCloseTo(2, 12);
    expect(model.positions[4][2]).toBeCloseTo(1, 12);
    const query = model.transform(vector({ 8: 1, 70: 2, 383: 3 }));
    query.forEach((value, axis) => expect(value).toBeCloseTo(axis + 1, 12));
  });
  it("handles tiny variance without an absolute-magnitude cutoff", () => {
    const model = fitSmallCorpusProjection([[-1e-180], [1e-180]]);
    expect(model.positions[0][0] / 1e-180).toBeCloseTo(-1, 12);
    expect(model.positions[1][0] / 1e-180).toBeCloseTo(1, 12);
    expect(model.transform([5e-180])[0] / 1e-180).toBeCloseTo(5, 12);
  });
  it("rejects incompatible shapes, nonfinite values, and unsupported counts", () => {
    expect(() => fitSmallCorpusProjection([])).toThrow("one to seven");
    expect(() => fitSmallCorpusProjection([[]])).toThrow("equally sized");
    expect(() => fitSmallCorpusProjection([[1], [1, 2]])).toThrow(
      "equally sized",
    );
    expect(() => fitSmallCorpusProjection([[NaN]])).toThrow("finite");
    expect(() =>
      fitSmallCorpusProjection(Array.from({ length: 8 }, () => [1])),
    ).toThrow("one to seven");
    const model = fitSmallCorpusProjection([
      [0, 0],
      [1, 0],
    ]);
    expect(() => model.transform([1])).toThrow("dimensions");
    expect(() => model.transform([Infinity, 0])).toThrow("dimensions");
  });
});
