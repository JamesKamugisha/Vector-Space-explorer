import type { RealDocument, RealResult } from "./types";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (
    !a.length ||
    a.length !== b.length ||
    !a.every(Number.isFinite) ||
    !b.every(Number.isFinite)
  )
    throw new Error(
      "Embeddings must be finite arrays with matching dimensions.",
    );
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  if (!aa || !bb) throw new Error("A zero embedding has no cosine direction.");
  return Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb)));
}
export const cosineDistance = (a: number[], b: number[]) =>
  1 - cosineSimilarity(a, b);
export function rankEmbeddings(
  query: number[],
  embeddings: number[][],
  documents: RealDocument[],
): RealResult[] {
  if (embeddings.length !== documents.length)
    throw new Error("Document and embedding counts do not match.");
  return documents
    .map((document, i) => {
      const score = cosineSimilarity(query, embeddings[i]);
      const distance = Math.hypot(
        ...query.map((value, j) => value - embeddings[i][j]),
      );
      return { document, score, distance };
    })
    .sort(
      (a, b) => b.score - a.score || a.document.id.localeCompare(b.document.id),
    );
}

/** Fixed seed makes a given corpus prefix reproducible, not manually positioned. */
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ragPrompt(
  query: string,
  results: RealResult[],
): { prompt: string; contextIds: string[] } {
  const selected = results.slice(0, 3);
  const privateContext = selected.some((result) => result.document.source);
  const context = selected
    .map((result, index) =>
      result.document.text
        .split(/\s+/)
        .slice(0, privateContext ? (index === 0 ? 120 : 50) : 60)
        .join(" "),
    )
    .join("\n\n");
  return {
    prompt: `Answer the question using only the following context. If the context does not answer the question, say "The context does not provide that information."\n\nContext:\n${context}\n\nQuestion: ${query.trim().slice(0, 400)}\n\nAnswer:`,
    contextIds: selected.map((result) => result.document.id),
  };
}
