import {
  env,
  pipeline,
  InterruptableStoppingCriteria,
  type FeatureExtractionPipeline,
  type Text2TextGenerationPipeline,
} from "@huggingface/transformers";
import { UMAP } from "umap-js";
import { REAL_CORPUS, REAL_CORPUS_HASH } from "./corpus";
import { readEmbeddings, writeEmbeddings } from "./cache";
import {
  cosineDistance,
  ragPrompt,
  rankEmbeddings,
  seededRandom,
} from "./numerics";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  GENERATOR_MODEL,
  type RealDocument,
  type RealRequest,
  type RealResponse,
  type RealState,
} from "./types";
import type { Vec3 } from "../math/vector";

env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
let newestRequest = 0;
let work = Promise.resolve();
let extractor: Promise<FeatureExtractionPipeline> | undefined;
let generator: Promise<Text2TextGenerationPipeline> | undefined;
const interrupt = new InterruptableStoppingCriteria();
const memory = new Map<string, number[]>();
let activeDocuments: RealDocument[] = [];
let activeEmbeddings: number[][] = [];
let reducer: UMAP | undefined;
let center: Vec3 = [0, 0, 0];
let displayScale = 1;
const queryCache = new Map<string, { vector: number[]; position: Vec3 }>();
const keyFor = (document: RealDocument) =>
  `${EMBEDDING_MODEL}:q8:mean:normalized:${REAL_CORPUS_HASH}:${document.id}`;
const isCurrent = (id: number) => id === newestRequest;
const emit = (id: number, patch: Partial<RealState>) => {
  if (isCurrent(id)) self.postMessage({ id, patch } satisfies RealResponse);
};

function loadExtractor(id: number): Promise<FeatureExtractionPipeline> {
  if (!extractor)
    extractor = pipeline("feature-extraction", EMBEDDING_MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (info) => {
        if (info.status === "progress")
          emit(id, {
            status: "loading",
            progress: Math.min(0.99, info.progress / 100),
            message: `Downloading sentence model: ${info.file} · ${Math.round(info.progress)}%`,
          });
      },
    }).catch((error) => {
      extractor = undefined;
      throw error;
    });
  return extractor;
}

function loadGenerator(id: number): Promise<Text2TextGenerationPipeline> {
  if (!generator)
    generator = pipeline("text2text-generation", GENERATOR_MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (info) => {
        if (info.status === "progress")
          emit(id, {
            status: "answering",
            progress: Math.min(0.85, (info.progress / 100) * 0.85),
            message: `Downloading answer model: ${info.file} · ${Math.round(info.progress)}%`,
          });
      },
    }).catch((error) => {
      generator = undefined;
      throw error;
    });
  return generator;
}

const positionFor = (position: number[]): Vec3 => {
  const result: Vec3 = [
    (position[0] - center[0]) * displayScale,
    (position[1] - center[1]) * displayScale,
    (position[2] - center[2]) * displayScale,
  ];
  if (!result.every(Number.isFinite))
    throw new Error(
      "UMAP returned a nonfinite position. Retry the projection.",
    );
  return result;
};

async function initialize(id: number, requestedCount: number) {
  const count = Math.max(8, Math.min(500, Math.round(requestedCount)));
  const documents = REAL_CORPUS.slice(0, count);
  emit(id, {
    status: "loading",
    progress: 0,
    message:
      "Loading trained sentence model. First use downloads model weights; later visits reuse the browser cache.",
    documents,
    points: [],
    results: [],
    answer: undefined,
    queryVector: undefined,
    queryPosition: undefined,
    searchedQuery: undefined,
    error: undefined,
    contextIds: [],
  });
  const cached = await readEmbeddings(documents.map(keyFor));
  if (!isCurrent(id)) return;
  cached.forEach((value, key) => memory.set(key, value));
  const pipe = await loadExtractor(id);
  if (!isCurrent(id)) return;
  const missing = documents.filter((document) => !memory.has(keyFor(document)));
  const batchSize = 8;
  for (let start = 0; start < missing.length; start += batchSize) {
    if (!isCurrent(id)) return;
    const batch = missing.slice(start, start + batchSize);
    emit(id, {
      status: "embedding",
      progress: (count - missing.length + start) / count,
      message: `Computing actual 384-dimensional embeddings: ${count - missing.length + start} / ${count} documents.`,
    });
    const output = await pipe(
      batch.map((document) => `${document.title}. ${document.text}`),
      { pooling: "mean", normalize: true },
    );
    const vectors = output.tolist() as number[][];
    if (
      vectors.length !== batch.length ||
      vectors.some(
        (v) => v.length !== EMBEDDING_DIMENSIONS || !v.every(Number.isFinite),
      )
    )
      throw new Error(
        "The sentence model returned an unexpected embedding shape.",
      );
    const entries = batch.map((document, i): [string, number[]] => [
      keyFor(document),
      vectors[i],
    ]);
    entries.forEach(([key, value]) => memory.set(key, value));
    await writeEmbeddings(entries);
  }
  if (!isCurrent(id)) return;
  const embeddings = documents.map((document) => memory.get(keyFor(document))!);
  emit(id, {
    status: "projecting",
    progress: 0,
    message: `Fitting unsupervised 3D UMAP to ${count} real sentence embeddings. Topic colors do not determine positions.`,
  });
  const umap = new UMAP({
    nComponents: 3,
    nNeighbors: Math.min(15, count - 1),
    minDist: 0.16,
    spread: 1.15,
    nEpochs: 300,
    random: seededRandom(71337 + count),
    distanceFn: cosineDistance,
  });
  const positions = await umap.fitAsync(embeddings, (epoch) => {
    if (!isCurrent(id)) return false;
    if (epoch % 15 === 0)
      emit(id, {
        status: "projecting",
        progress: epoch / 300,
        message: `Optimizing 3D UMAP · epoch ${epoch} / 300. Search still uses all 384 dimensions.`,
      });
    return true;
  });
  if (!isCurrent(id)) return;
  center = [0, 1, 2].map(
    (axis) =>
      positions.reduce((sum, position) => sum + position[axis], 0) /
      positions.length,
  ) as Vec3;
  const maxRadius = Math.max(
    1e-6,
    ...positions.map((position) =>
      Math.hypot(
        position[0] - center[0],
        position[1] - center[1],
        position[2] - center[2],
      ),
    ),
  );
  displayScale = 5 / maxRadius;
  activeDocuments = documents;
  activeEmbeddings = embeddings;
  reducer = umap;
  queryCache.clear();
  emit(id, {
    status: "ready",
    progress: 1,
    message: `${count} documents embedded by MiniLM and projected with 3D UMAP. Colors identify authored topics; positions are learned from text.`,
    documents,
    points: documents.map((document, i) => ({
      id: document.id,
      label: document.title,
      position: positionFor(positions[i]),
      color: document.color,
    })),
  });
}

async function search(id: number, rawQuery: string) {
  if (!reducer || !activeEmbeddings.length)
    throw new Error("Load the document embeddings before searching.");
  const query = rawQuery.trim().slice(0, 400);
  if (!query) throw new Error("Enter a question or phrase to search.");
  emit(id, {
    status: "embedding",
    progress: 0,
    message: "Embedding your query with the same pretrained sentence model.",
    answer: undefined,
    contextIds: [],
    error: undefined,
  });
  let encoded = queryCache.get(query);
  if (!encoded) {
    const pipe = await loadExtractor(id);
    if (!isCurrent(id)) return;
    const output = await pipe(query, { pooling: "mean", normalize: true });
    if (!isCurrent(id)) return;
    const [vector] = output.tolist() as number[][];
    if (
      vector.length !== EMBEDDING_DIMENSIONS ||
      !vector.every(Number.isFinite)
    )
      throw new Error("The query embedding has an unexpected shape.");
    const [projection] = reducer.transform([vector]);
    encoded = { vector, position: positionFor(projection) };
    queryCache.set(query, encoded);
  }
  if (!isCurrent(id)) return;
  const results = rankEmbeddings(
    encoded.vector,
    activeEmbeddings,
    activeDocuments,
  );
  emit(id, {
    status: "ready",
    progress: 1,
    queryVector: encoded.vector,
    queryPosition: encoded.position,
    searchedQuery: query,
    results,
    message:
      "Ranked by original 384-dimensional cosine similarity. The query uses the fitted UMAP transform; visible 3D distances are approximate.",
  });
  return results;
}

async function generate(id: number, query: string) {
  const results = await search(id, query);
  if (!results || !isCurrent(id)) return;
  const { prompt, contextIds } = ragPrompt(query, results);
  emit(id, {
    status: "answering",
    progress: 0,
    message:
      "Loading the local FLAN-T5 answer model on demand. The three retrieved passages provide the context.",
    contextIds,
    answer: undefined,
  });
  const pipe = await loadGenerator(id);
  if (!isCurrent(id)) return;
  interrupt.reset();
  emit(id, {
    status: "answering",
    progress: 0.9,
    message:
      "Generating an answer locally from the retrieved passages. This small model can make mistakes; inspect its source context.",
  });
  const output = await pipe(prompt, {
    max_new_tokens: 96,
    do_sample: false,
    repetition_penalty: 1.1,
    stopping_criteria: [interrupt],
  });
  if (!isCurrent(id)) return;
  const answer = output[0]?.generated_text?.trim();
  if (!answer)
    throw new Error(
      "The local model returned no answer. Try a shorter, more specific question.",
    );
  emit(id, {
    status: "ready",
    progress: 1,
    answer,
    contextIds,
    message:
      "Generated locally by FLAN-T5-small using retrieved context. Context links identify supplied passages, not verified citations from the model.",
  });
}

self.onmessage = (event: MessageEvent<RealRequest>) => {
  const request = event.data;
  newestRequest = request.id;
  interrupt.interrupt();
  if (request.type === "cancel") return;
  work = work.then(async () => {
    if (!isCurrent(request.id)) return;
    try {
      if (request.type === "initialize")
        await initialize(request.id, request.count);
      else if (request.type === "search")
        await search(request.id, request.query);
      else await generate(request.id, request.query);
    } catch (error) {
      emit(request.id, {
        status: "error",
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
        message:
          "The real model operation failed. Check network access and retry; no simulated vectors or answers were substituted.",
      });
    }
  });
};
