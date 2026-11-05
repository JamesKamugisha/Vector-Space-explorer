import { describe, expect, it } from "vitest";
import { UMAP } from "umap-js";
import {
  REAL_CORPUS,
  REAL_CORPUS_HASH,
  REAL_TOPICS,
  corpusHash,
} from "../src/real/corpus";
import {
  cosineDistance,
  cosineSimilarity,
  ragPrompt,
  rankEmbeddings,
  seededRandom,
} from "../src/real/numerics";

describe("real-model sample corpus", () => {
  it("contains 500 unique authored passages with six interleaved topics", () => {
    expect(REAL_CORPUS).toHaveLength(500);
    expect(new Set(REAL_CORPUS.map((document) => document.id)).size).toBe(500);
    expect(new Set(REAL_CORPUS.map((document) => document.title)).size).toBe(
      500,
    );
    expect(new Set(REAL_CORPUS.map((document) => document.text)).size).toBe(
      500,
    );
    expect(
      new Set(REAL_CORPUS.slice(0, 8).map((document) => document.topic)).size,
    ).toBe(6);
    expect(REAL_TOPICS).toHaveLength(6);
    expect(
      REAL_CORPUS.every((document) => document.text.split(/\s+/).length >= 40),
    ).toBe(true);
    expect(
      REAL_CORPUS.every((document) => /^#[0-9a-f]{6}$/i.test(document.color)),
    ).toBe(true);
  });
  it("invalidates cache keys when actual content changes", () => {
    expect(corpusHash(REAL_CORPUS)).toBe(REAL_CORPUS_HASH);
    const changed = REAL_CORPUS.map((document) => ({ ...document }));
    changed[0].text += " Updated example.";
    expect(corpusHash(changed)).not.toBe(REAL_CORPUS_HASH);
  });
});

describe("original-dimensional semantic ranking", () => {
  it("uses every embedding coordinate rather than the 3D plot", () => {
    const query = Array(384).fill(0);
    query[383] = 1;
    const identical = [...query];
    const unrelated = Array(384).fill(0);
    unrelated[0] = 1;
    const opposite = query.map((value) => -value);
    const result = rankEmbeddings(
      query,
      [unrelated, opposite, identical],
      REAL_CORPUS.slice(0, 3),
    );
    expect(result.map((entry) => entry.document.id)).toEqual([
      REAL_CORPUS[2].id,
      REAL_CORPUS[0].id,
      REAL_CORPUS[1].id,
    ]);
    expect(result.map((entry) => entry.score)).toEqual([1, 0, -1]);
    expect(result[0].distance).toBe(0);
    expect(result[2].distance).toBe(2);
  });
  it("handles scale-invariance, ties and invalid vectors explicitly", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineDistance([1, 0], [0, 1])).toBe(1);
    const docs = [REAL_CORPUS[1], REAL_CORPUS[0]];
    const ties = rankEmbeddings(
      [1, 0],
      [
        [1, 0],
        [1, 0],
      ],
      docs,
    );
    expect(ties[0].document.id.localeCompare(ties[1].document.id)).toBeLessThan(
      0,
    );
    expect(() => cosineSimilarity([0, 0], [1, 0])).toThrow("zero");
    expect(() => cosineSimilarity([1], [1, 0])).toThrow("matching");
    expect(() => cosineSimilarity([NaN], [1])).toThrow("finite");
  });
});

describe("retrieved generation context", () => {
  it("bounds input and identifies only supplied sources", () => {
    const results = REAL_CORPUS.slice(0, 5).map((document) => ({
      document,
      score: 0.5,
      distance: 1,
    }));
    const { prompt, contextIds } = ragPrompt("Why do birds migrate?", results);
    expect(contextIds).toEqual(
      REAL_CORPUS.slice(0, 3).map((document) => document.id),
    );
    expect(prompt).toContain("Question: Why do birds migrate?");
    expect(prompt).toContain("using only the following context");
    expect(prompt).not.toContain(REAL_CORPUS[3].text);
    expect(prompt.split(/\s+/).length).toBeLessThan(240);
    expect(ragPrompt("a".repeat(1000), results).prompt).not.toContain(
      "a".repeat(401),
    );
  });
});

describe("learned UMAP projection", () => {
  it("fits actual vectors without topic labels and transforms a query in the fitted space", async () => {
    const random = seededRandom(44);
    const vectors = Array.from({ length: 24 }, () =>
      Array.from({ length: 12 }, () => random() * 2 - 1),
    );
    const reducer = new UMAP({
      nComponents: 3,
      nNeighbors: 5,
      nEpochs: 30,
      random: seededRandom(77),
      distanceFn: cosineDistance,
    });
    const positions = await reducer.fitAsync(vectors);
    expect(positions).toHaveLength(24);
    expect(
      positions.every(
        (point) => point.length === 3 && point.every(Number.isFinite),
      ),
    ).toBe(true);
    const query = reducer.transform([vectors[0]]);
    expect(query).toHaveLength(1);
    expect(query[0]).toHaveLength(3);
    expect(query[0].every(Number.isFinite)).toBe(true);
    const first = seededRandom(77),
      second = seededRandom(77);
    expect(Array.from({ length: 10 }, first)).toEqual(
      Array.from({ length: 10 }, second),
    );
  });
});
