import { useCallback, useEffect, useRef, useState } from "react";
import {
  INITIAL_REAL_STATE,
  type RealRequest,
  type RealResponse,
  type RealState,
  type RealDocument,
} from "./types";

export function useRealEmbeddings(
  count: number,
  enabled: boolean,
  documents: RealDocument[] | null = null,
) {
  const [state, setState] = useState<RealState>(INITIAL_REAL_STATE);
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const active = useRef({ count, enabled, documents });
  active.current = { count, enabled, documents };

  const send = useCallback(
    (
      request:
        | Omit<Extract<RealRequest, { type: "initialize" }>, "id">
        | Omit<Extract<RealRequest, { type: "search" | "generate" }>, "id">
        | { type: "cancel" },
    ) => {
      if (!worker.current) return;
      requestId.current += 1;
      worker.current.postMessage({
        ...request,
        id: requestId.current,
      } satisfies RealRequest);
    },
    [],
  );

  const ensureWorker = useCallback(() => {
    if (worker.current) return true;
    try {
      const instance = new Worker(
        new URL("./embedding.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<RealResponse>) => {
        if (event.data.id !== requestId.current) return;
        setState((previous) => ({ ...previous, ...event.data.patch }));
      };
      instance.onerror = (event) => {
        if (worker.current !== instance) return;
        instance.terminate();
        worker.current = null;
        requestId.current += 1;
        setState((previous) => ({
          ...previous,
          status: "error",
          progress: 0,
          error: event.message || "The model worker could not start.",
          message:
            "Unable to run the browser model worker. Check WebAssembly and network access, then retry.",
        }));
      };
      return true;
    } catch (error) {
      setState((previous) => ({
        ...previous,
        status: "error",
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
        message:
          "The browser could not create a model worker. No simulated fallback was used.",
      }));
      return false;
    }
  }, []);

  // The heavy worker bundle is not fetched until real mode is first enabled.
  // Keep its model sessions across later mode changes; release them on unmount.
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
      requestId.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (enabled && ensureWorker()) {
      setState({
        ...INITIAL_REAL_STATE,
        status: "loading",
        message: "Preparing document embeddings…",
      });
      send({ type: "initialize", count, documents: documents ?? undefined });
    } else send({ type: "cancel" });
  }, [count, enabled, documents, send, ensureWorker]);

  const search = useCallback(
    (query: string) => {
      if (active.current.enabled) send({ type: "search", query });
    },
    [send],
  );
  const generate = useCallback(
    (query: string) => {
      if (active.current.enabled) send({ type: "generate", query });
    },
    [send],
  );
  const retry = useCallback(() => {
    if (active.current.enabled && ensureWorker())
      send({
        type: "initialize",
        count: active.current.count,
        documents: active.current.documents ?? undefined,
      });
  }, [send, ensureWorker]);
  return { state, search, generate, retry };
}
