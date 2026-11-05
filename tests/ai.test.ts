import { describe, expect, it } from "vitest";
import {
  corpus,
  cosineSimilarity,
  encodeQuery,
  euclideanDistance,
  extractAnswer,
  rankDocuments,
  retrieveContext,
  tokenize,
} from "../src/ai/model";

describe("teaching query encoder", () => {
  it("uses inspectable whole-token features and ignores unknown terms", () => {
    expect(encodeQuery("reset password")).toEqual([2, 0, 0]);
    expect(encodeQuery("Vacation leave policy")).toEqual([0, 3, 0]);
    expect(encodeQuery("cafeteria lunch menu")).toEqual([0, 0, 3]);
    expect(encodeQuery("a completely unknown question")).toEqual([0, 0, 0]);
    expect(encodeQuery("accessories")).toEqual([0, 0, 0]);
  });
  it("normalizes sign-in variants and handles empty inputs", () => {
    expect(encodeQuery("sign in")).toEqual([1, 0, 0]);
    expect(encodeQuery("SIGN-IN")).toEqual([1, 0, 0]);
    expect(tokenize("")).toEqual([]);
    expect(encodeQuery("")).toEqual([0, 0, 0]);
  });
});

describe("retrieval and answer provenance", () => {
  it("never retrieves or answers an unknown query", () => {
    expect(retrieveContext(encodeQuery("unknown question"), "cosine")).toEqual(
      [],
    );
    expect(retrieveContext([0, 0, 0], "euclidean")).toEqual([]);
    expect(extractAnswer([])).toEqual([]);
  });
  it("builds context from ranked corpus records and quotes their actual text", () => {
    const query = encodeQuery("reset password");
    for (const metric of ["cosine", "euclidean"] as const) {
      const context = retrieveContext(query, metric);
      expect(context).toHaveLength(2);
      expect(context[0].id).toBe(rankDocuments(query, metric)[0].document.id);
      for (const answer of extractAnswer(context)) {
        const source = context.find(
          (document) => document.id === answer.sourceId,
        );
        expect(source).toBeDefined();
        expect(source!.text.startsWith(answer.sentence)).toBe(true);
        expect(answer.sentence.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("similarity measures", () => {
  it("computes identical, orthogonal and opposite cosine values", () => {
    expect(cosineSimilarity([3, 4, 0], [3, 4, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBe(-1);
    expect(cosineSimilarity([1, 0, 0], [20, 0, 0])).toBe(1);
  });
  it("rejects undefined cosine and nonfinite inputs", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 0, 0])).toBeNull();
    expect(cosineSimilarity([Infinity, 0, 0], [1, 0, 0])).toBeNull();
    expect(euclideanDistance([NaN, 0, 0], [1, 0, 0])).toBeNull();
  });
  it("calculates distances directly from coordinates", () => {
    expect(euclideanDistance([0, 0, 0], [3, 4, 0])).toBe(5);
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe("document rankings", () => {
  it("can change ordering when metric changes", () => {
    const query = encodeQuery("reset password");
    expect(rankDocuments(query, "cosine")[0].document.id).toBe("password");
    expect(rankDocuments(query, "euclidean")[0].document.id).toBe("signin");
  });
  it("uses actual corpus arrays for all displayed scores", () => {
    const query = encodeQuery("remote access");
    for (const metric of ["cosine", "euclidean"] as const) {
      const ranked = rankDocuments(query, metric);
      expect(ranked).toHaveLength(corpus.length);
      for (const { document, score } of ranked) {
        expect(score).toBe(
          metric === "cosine"
            ? cosineSimilarity(query, document.vector)
            : euclideanDistance(query, document.vector),
        );
      }
      for (let index = 1; index < ranked.length; index++) {
        const previous = ranked[index - 1].score!;
        const current = ranked[index].score!;
        expect(
          metric === "cosine"
            ? previous >= current - 1e-12
            : previous <= current + 1e-12,
        ).toBe(true);
      }
    }
  });
  it("has stable tie ordering and never invents scores for unknown queries", () => {
    expect(
      rankDocuments([0, 0, 0], "cosine").every((item) => item.score === null),
    ).toBe(true);
    expect(
      rankDocuments([0, 0, 0], "euclidean").every(
        (item) => item.score === null,
      ),
    ).toBe(true);
    const first = rankDocuments([1, 0, 0], "cosine");
    const zeroMatches = first
      .filter((item) => item.score === 0)
      .map((item) => item.document.id);
    expect(zeroMatches).toEqual([...zeroMatches].sort());
    expect(rankDocuments([1, 0, 0], "cosine")).toEqual(first);
  });
});
