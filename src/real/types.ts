import type { Vec3 } from "../math/vector";

export type RealDocument = {
  id: string;
  title: string;
  text: string;
  topic: string;
  color: string;
};
export type RealPoint = {
  id: string;
  label: string;
  position: Vec3;
  color: string;
  score?: number;
};
export type RealResult = {
  document: RealDocument;
  score: number;
  distance: number;
};
export type RealState = {
  status:
    | "idle"
    | "loading"
    | "embedding"
    | "projecting"
    | "ready"
    | "answering"
    | "error";
  progress: number;
  message: string;
  documents: RealDocument[];
  points: RealPoint[];
  queryVector?: number[];
  queryPosition?: Vec3;
  searchedQuery?: string;
  results: RealResult[];
  answer?: string;
  error?: string;
  embeddingModel: string;
  generatorModel: string;
  dimensions: number;
  contextIds: string[];
};
export type RealRequest =
  | { id: number; type: "initialize"; count: number }
  | { id: number; type: "search" | "generate"; query: string }
  | { id: number; type: "cancel" };
export type RealResponse = { id: number; patch: Partial<RealState> };

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const GENERATOR_MODEL = "Xenova/flan-t5-small";
export const EMBEDDING_DIMENSIONS = 384;
export const INITIAL_REAL_STATE: RealState = {
  status: "idle",
  progress: 0,
  message: "Load a trained sentence model to explore real text embeddings.",
  documents: [],
  points: [],
  results: [],
  contextIds: [],
  embeddingModel: EMBEDDING_MODEL,
  generatorModel: GENERATOR_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
};
