import { createRoot } from "react-dom/client";
import VectorScene, { type ScenePoint } from "../../src/scene/VectorScene";

// Test-only deterministic workload. This entry is not part of the production build.
let seed = 7142026;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const points: ScenePoint[] = Array.from({ length: 500 }, (_, index) => ({
  id: `document-${index}`,
  label: `Document ${index + 1}`,
  position: [random() * 6 - 3, random() * 6 - 3, random() * 6 - 3],
  score: random(),
  color: ["#78b7ff", "#90d9bf", "#c3a0ff", "#f1a1ab"][index % 4],
}));
const root = createRoot(document.getElementById("root")!);
let generation = 0;
let selected = points[0].id;
let selections = 0;
const mount = () => {
  root.render(
    <VectorScene
      key={generation}
      u={[1, 2, 1]}
      v={[0, 0, 0]}
      operation="ai"
      showSphere
      showGrid
      showSpan={false}
      showLabels
      resetKey={0}
      playProgress={null}
      points={points}
      selectedPoint={selected}
      onSelectPoint={(id) => {
        selected = id;
        selections++;
        mount();
      }}
    />,
  );
};
const profile = {
  mount: () => {
    generation++;
    mount();
  },
  unmount: () => {
    root.render(null);
  },
  pointCount: points.length,
  get selections() {
    return selections;
  },
  get selected() {
    return selected;
  },
};
Object.assign(window, { sceneProfile: profile });
mount();
