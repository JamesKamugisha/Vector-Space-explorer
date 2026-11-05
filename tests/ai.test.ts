import { describe, expect, it } from "vitest";
import {
  corpus,
  buildCorpus,
  clampPointCount,
  cosineSimilarity,
  encodeQuery,
  euclideanDistance,
  extractAnswer,
  rankDocuments,
  retrieveContext,
  tokenize,
} from "../src/ai/model";
import {
  cosineNd,
  distanceNd,
  fitPca,
  getPcaView,
  pcaDataset,
  pcaModel,
  projectPca,
} from "../src/ai/pca";

describe("expanded synthetic teaching corpus", () => {
  it("keeps the original eight and generates repeatable, unique finite points", () => {
    expect(buildCorpus(8)).toEqual(corpus);
    const documents = buildCorpus(500);
    expect(documents).toHaveLength(500);
    expect(new Set(documents.map((document) => document.id)).size).toBe(500);
    expect(
      documents.every((document) => document.vector.every(Number.isFinite)),
    ).toBe(true);
    expect(
      documents
        .slice(8)
        .every((document) =>
          document.text.startsWith("Synthetic teaching example"),
        ),
    ).toBe(true);
    expect(buildCorpus(50)).toEqual(documents.slice(0, 50));
    expect(buildCorpus(500)).toEqual(documents);
    documents[0].vector[0] = 900;
    expect(corpus[0].vector[0]).toBe(4);
  });
  it("validates and bounds the requested count", () => {
    expect(clampPointCount(1)).toBe(8);
    expect(clampPointCount(50.9)).toBe(50);
    expect(clampPointCount(900)).toBe(500);
    expect(clampPointCount(NaN)).toBe(8);
    expect(buildCorpus(-10)).toHaveLength(8);
    expect(buildCorpus(5000)).toHaveLength(500);
  });
  it("ranks and retrieves from the exact 500-document array supplied", () => {
    const documents = buildCorpus(500);
    const query = encodeQuery("remote access");
    for (const metric of ["cosine", "euclidean"] as const) {
      const ranking = rankDocuments(query, metric, documents);
      expect(ranking).toHaveLength(500);
      expect(ranking).toEqual(rankDocuments(query, metric, documents));
      for (const row of ranking) {
        expect(documents).toContain(row.document);
        expect(row.score).toBe(
          metric === "cosine"
            ? cosineSimilarity(query, row.document.vector)
            : euclideanDistance(query, row.document.vector),
        );
      }
      expect(retrieveContext(query, metric, 2, documents)[0]).toBe(
        ranking[0].document,
      );
      expect(retrieveContext([0, 0, 0], metric, 2, documents)).toEqual([]);
    }
  });
});

describe("computed PCA", () => {
  it("finds known principal axes and sample eigenvalues", () => {
    const data = [
      [4, 0, 0, 0],
      [-4, 0, 0, 0],
      [0, 3, 0, 0],
      [0, -3, 0, 0],
      [0, 0, 2, 0],
      [0, 0, -2, 0],
      [0, 0, 0, 1],
      [0, 0, 0, -1],
    ];
    const model = fitPca(data);
    expect(model.mean).toEqual([0, 0, 0, 0]);
    expect(model.components).toEqual([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
    ]);
    expect(model.eigenvalues[0]).toBeCloseTo(32 / 7);
    expect(model.eigenvalues[1]).toBeCloseTo(18 / 7);
    expect(model.eigenvalues[2]).toBeCloseTo(8 / 7);
    expect(model.explainedVariance.reduce((a, b) => a + b, 0)).toBeCloseTo(
      58 / 60,
    );
    expect(projectPca([1, 2, 3, 4], model)).toEqual([1, 2, 3]);
  });
  it("fits orthonormal eigenvectors satisfying the covariance equation", () => {
    const data = pcaDataset.map((point) => point.vector);
    const centered = data.map((row) => row.map((v, i) => v - pcaModel.mean[i]));
    const covariance = pcaModel.mean.map((_, i) =>
      pcaModel.mean.map((__, j) =>
        centered.reduce(
          (sum, row) => sum + (row[i] * row[j]) / (data.length - 1),
          0,
        ),
      ),
    );
    pcaModel.components.forEach((component, index) => {
      expect(Math.hypot(...component)).toBeCloseTo(1, 10);
      pcaModel.components.forEach((other, j) =>
        expect(
          component.reduce((sum, value, i) => sum + value * other[i], 0),
        ).toBeCloseTo(Number(index === j), 10),
      );
      covariance.forEach((row, axis) =>
        expect(
          row.reduce((sum, value, i) => sum + value * component[i], 0),
        ).toBeCloseTo(pcaModel.eigenvalues[index] * component[axis], 9),
      );
    });
  });
  it("centers data consistently and handles constant/invalid datasets", () => {
    const data = [
      [1, 2, 3, 4],
      [3, 1, 5, 2],
      [-1, 4, 2, 1],
      [0, 0, 0, 0],
    ];
    const model = fitPca(data);
    const shifted = data.map((row) => row.map((value) => value + 100));
    const shiftedModel = fitPca(shifted);
    data.forEach((row, index) =>
      projectPca(row, model).forEach((value, axis) =>
        expect(value).toBeCloseTo(
          projectPca(shifted[index], shiftedModel)[axis],
          9,
        ),
      ),
    );
    const constant = fitPca([
      [2, 2, 2, 2],
      [2, 2, 2, 2],
    ]);
    expect(projectPca([2, 2, 2, 2], constant)).toEqual([0, 0, 0]);
    expect(constant.explainedVariance).toEqual([0, 0, 0]);
    expect(() => fitPca([[1, 2]])).toThrow();
    expect(() => fitPca([[1, 2], [1]])).toThrow();
    expect(() =>
      fitPca([
        [1, 2],
        [NaN, 2],
      ]),
    ).toThrow();
    expect(() => projectPca([1], model)).toThrow();
  });
  it("keeps retrieval scores in full dimension and demonstrates discarded information", () => {
    const view = getPcaView("hidden");
    const g = view.rows.find((row) => row.id === "pca-g")!;
    const h = view.rows.find((row) => row.id === "pca-h")!;
    g.position.forEach((value, axis) =>
      expect(value).toBeCloseTo(h.position[axis], 10),
    );
    expect(g.originalCosine).not.toBeCloseTo(h.originalCosine!);
    expect(g.projectedCosine).toBeCloseTo(h.projectedCosine!);
    for (const row of view.rows) {
      expect(row.originalCosine).toBe(cosineNd(view.queryOriginal, row.vector));
      expect(row.originalDistance).toBe(
        distanceNd(view.queryOriginal, row.vector),
      );
      expect(row.projectedDistance).toBeLessThanOrEqual(
        row.originalDistance + 1e-10,
      );
    }
    expect(getPcaView("missing")).toEqual(view);
  });
});

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
