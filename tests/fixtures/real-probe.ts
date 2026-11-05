import { env, pipeline } from "@huggingface/transformers";
env.allowLocalModels = false;
env.backends.onnx.wasm!.numThreads = 1;
Object.assign(window, {
  runEmbeddingProbe: async () => {
    const extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      {
        dtype: "q8",
        device: "wasm",
        progress_callback: (event) => {
          document.getElementById("probe-status")!.textContent =
            JSON.stringify(event);
        },
      },
    );
    const output = await extractor(
      [
        "A kitten is a young cat.",
        "A small feline animal.",
        "A car engine burns fuel.",
      ],
      { pooling: "mean", normalize: true },
    );
    const vectors = output.tolist() as number[][];
    const cosine = (a: number[], b: number[]) =>
      a.reduce((sum, v, i) => sum + v * b[i], 0);
    return {
      dimensions: vectors[0].length,
      related: cosine(vectors[0], vectors[1]),
      unrelated: cosine(vectors[0], vectors[2]),
      preview: vectors[0].slice(0, 4),
    };
  },
});
Object.assign(window, {
  runGenerationProbe: async () => {
    const generator = await pipeline(
      "text2text-generation",
      "Xenova/flan-t5-small",
      {
        dtype: "q8",
        device: "wasm",
        progress_callback: (event) => {
          document.getElementById("probe-status")!.textContent =
            JSON.stringify(event);
        },
      },
    );
    const output = await generator(
      "Answer the question using only the context. Context: Bird wings generate lift as air moves around them. Flight feathers help a bird control lift and steering. Question: What parts of a bird help it fly? Answer:",
      { max_new_tokens: 60, do_sample: false },
    );
    return output;
  },
});
