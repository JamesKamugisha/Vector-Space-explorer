import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Axis3D,
  BookOpen,
  Box,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  Copy,
  Expand,
  Focus,
  Grid3X3,
  Layers3,
  Lightbulb,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import VectorScene from "./scene/VectorScene";
import {
  calculateLesson,
  defaultInputs,
  operationLabels,
} from "./lessons/operations";
import type { MathInputs, Operation } from "./lessons/operations";
import type { Vec3 } from "./math/vector";
import AiPanel from "./ai/AiPanel";
import { buildCorpus, encodeQuery, rankDocuments } from "./ai/model";
import type { AiMetric } from "./ai/model";
import PcaLesson from "./ai/PcaLesson";
import { getPcaView } from "./ai/pca";
import VectorDetails from "./components/VectorDetails";
import AnalogyLesson, {
  analogyPoints,
  analogyResult,
} from "./components/AnalogyLesson";

type Scenario = "math" | "ai";
const ZERO: Vec3 = [0, 0, 0];
const groups: Array<{ title: string; operations: Operation[] }> = [
  {
    title: "Vector essentials",
    operations: ["add", "scale", "combination", "normalize"],
  },
  {
    title: "Spaces & coordinates",
    operations: ["span", "independence", "project", "planeProject", "basis"],
  },
  {
    title: "Go a little deeper",
    operations: ["dot", "cross", "gramSchmidt", "nullspace"],
  },
];
const descriptions: Record<Operation, string> = {
  add: "Two directions. One result. See how vectors come together, one step at a time.",
  scale:
    "Stretch, shrink, or reverse a vector. Watch what changes when you change the scalar.",
  combination:
    "Scale two vectors, then combine them. Explore the building blocks of a vector space.",
  normalize:
    "Keep the direction. Change the length. Find a vector’s place on the unit sphere.",
  span: "Explore every direction your vectors can reach: a line, a plane, or just the origin.",
  independence:
    "Does each vector bring a new direction? Discover how rank describes a space.",
  project:
    "Find the part of one vector that points along another, and see what is left over.",
  planeProject:
    "Find the closest point to x in a span, with the residual perpendicular to its directions.",
  basis:
    "A different set of directions. The same point. Reconstruct a vector in a new basis.",
  dot: "Connect alignment, angles, and inner products through an interactive picture.",
  cross:
    "Find a direction perpendicular to both inputs. Explore the right-hand rule in 3D.",
  gramSchmidt:
    "Turn independent directions into an orthonormal set, one projection at a time.",
  nullspace:
    "Find all vectors that a matrix sends to zero, and see their solution space.",
};
const presetMap: Partial<
  Record<Operation, Array<{ label: string; values: Partial<MathInputs> }>>
> = {
  add: [
    { label: "Classic example", values: { u: [1, 2, 1], v: [2, -1, 1] } },
    { label: "Opposite vectors", values: { u: [2, 1, 1], v: [-2, -1, -1] } },
  ],
  scale: [
    { label: "Reverse direction", values: { u: [1, 2, 1], a: -1.5 } },
    { label: "Shrink to zero", values: { a: 0 } },
  ],
  combination: [
    {
      label: "Build a vector",
      values: { u: [1, 0, 1], v: [0, 2, 1], a: 2, b: -1 },
    },
  ],
  normalize: [
    { label: "3–4–5 triangle", values: { u: [3, 4, 0] } },
    { label: "Zero vector", values: { u: [0, 0, 0] } },
  ],
  span: [
    { label: "A plane", values: { u: [1, 0, 0], v: [0, 1, 0] } },
    { label: "A line", values: { u: [1, 0, 0], v: [2, 0, 0] } },
    { label: "Only the origin", values: { u: [0, 0, 0], v: [0, 0, 0] } },
  ],
  independence: [
    { label: "Independent", values: { u: [1, 0, 0], v: [0, 1, 0] } },
    { label: "Dependent", values: { u: [1, 2, 1], v: [2, 4, 2] } },
  ],
  project: [
    { label: "See the perpendicular", values: { u: [3, 1, 0], v: [1, 1, 0] } },
  ],
  planeProject: [
    {
      label: "Project onto XY",
      values: { u: [1, 0, 0], v: [0, 1, 0], target: [2, 1, 3] },
    },
    {
      label: "A tilted plane",
      values: { u: [1, 0, 1], v: [0, 1, 1], target: [3, 1, 0] },
    },
    {
      label: "Collapse to a line",
      values: { u: [1, 1, 0], v: [2, 2, 0], target: [3, 1, 2] },
    },
  ],
  basis: [
    {
      label: "A new coordinate system",
      values: {
        basis: [
          [1, 0, 0],
          [1, 1, 0],
          [0, 0, 1],
        ],
        target: [3, 2, 4],
      },
    },
  ],
  dot: [
    { label: "Right angle", values: { u: [3, 0, 0], v: [0, 3, 0] } },
    { label: "Same direction", values: { u: [1, 2, 1], v: [2, 4, 2] } },
  ],
  cross: [{ label: "Right-hand rule", values: { u: [2, 0, 0], v: [0, 2, 0] } }],
  gramSchmidt: [
    { label: "Orthogonalize", values: { u: [1, 1, 0], v: [1, 0, 0] } },
  ],
  nullspace: [
    {
      label: "A solution line",
      values: {
        matrix: [
          [1, -1, 0],
          [1, 0, -1],
          [0, 0, 0],
        ],
      },
    },
    {
      label: "A solution plane",
      values: {
        matrix: [
          [1, 1, 1],
          [0, 0, 0],
          [0, 0, 0],
        ],
      },
    },
  ],
};

function NumericInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(String(value));
    setInvalid(false);
  }, [value]);
  return (
    <input
      type="number"
      step="any"
      value={text}
      aria-label={label}
      aria-invalid={invalid}
      title={
        invalid
          ? "Enter a finite number between −1,000,000 and 1,000,000. Last valid value is still in use."
          : label
      }
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = Number(next);
        const valid =
          next.trim() !== "" &&
          Number.isFinite(parsed) &&
          Math.abs(parsed) <= 1e6;
        setInvalid(!valid);
        if (valid) onChange(parsed);
      }}
      onBlur={() => {
        if (invalid) {
          setText(String(value));
          setInvalid(false);
        }
      }}
    />
  );
}

function VectorInput({
  name,
  color,
  value,
  onChange,
  caption,
}: {
  name: string;
  color: string;
  value: Vec3;
  onChange: (value: Vec3) => void;
  caption?: string;
}) {
  return (
    <fieldset className="vector-input">
      <legend>
        <span className="vector-dot" style={{ background: color }} />
        <span>{name}</span>
        {caption && <small>{caption}</small>}
      </legend>
      <div className="coordinate-labels">
        <span>x</span>
        <span>y</span>
        <span>z</span>
      </div>
      <div className="coordinate-inputs">
        {value.map((coordinate, index) => (
          <NumericInput
            key={index}
            value={coordinate}
            label={`${name} ${["x", "y", "z"][index]}`}
            onChange={(next) => {
              const updated = [...value] as Vec3;
              updated[index] = next;
              onChange(updated);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function LayerToggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`layer-toggle ${checked ? "is-on" : ""}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      {checked ? <Check size={13} /> : <span className="empty-check" />}
      {children}
    </button>
  );
}

export default function App() {
  const [scenario, setScenario] = useState<Scenario>("math");
  const [operation, setOperation] = useState<Operation>("add");
  const [inputs, setInputs] = useState<MathInputs>(() =>
    structuredClone(defaultInputs),
  );
  const [showSphere, setShowSphere] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showSpan, setShowSpan] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showNormShells, setShowNormShells] = useState(false);
  const [showReferencePlanes, setShowReferencePlanes] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [inspectedVector, setInspectedVector] = useState("u");
  const [clickedVector, setClickedVector] = useState<{
    id: string;
    label: string;
    coordinates: Vec3;
  } | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState("How do I reset my password?");
  const [metric, setMetric] = useState<AiMetric>("cosine");
  const [selectedId, setSelectedId] = useState("");
  const [normalized, setNormalized] = useState(false);
  const [pointCount, setPointCount] = useState(8);
  const [aiView, setAiView] = useState<
    "teaching" | "counts" | "pca" | "analogy"
  >("teaching");
  const [analogyReverse, setAnalogyReverse] = useState(false);
  const [analogySelectedId, setAnalogySelectedId] = useState("");
  const [pcaQueryId, setPcaQueryId] = useState("hidden");
  const [pcaSelectedId, setPcaSelectedId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const canvasSection = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const lastHelpTrigger = useRef<HTMLElement | null>(null);
  const playbackGeneration = useRef(0);
  const lesson = useMemo(
    () => calculateLesson(operation, inputs),
    [operation, inputs],
  );
  const queryVector = useMemo(() => encodeQuery(query), [query]);
  const documents = useMemo(
    () =>
      buildCorpus(pointCount).map((document) =>
        aiView === "counts"
          ? {
              ...document,
              vector: encodeQuery(`${document.title} ${document.text}`),
            }
          : document,
      ),
    [pointCount, aiView],
  );
  const rankings = useMemo(
    () => rankDocuments(queryVector, metric, documents),
    [queryVector, metric, documents],
  );
  const pcaView = useMemo(() => getPcaView(pcaQueryId), [pcaQueryId]);
  const stepsCount = Math.max(lesson.steps.length, 1);

  useLayoutEffect(() => {
    playbackGeneration.current += 1;
    setPlaying(false);
    setProgress(null);
    setStepIndex(0);
    setClickedVector(null);
    setInspectedVector(
      operation === "basis"
        ? "basis0"
        : operation === "nullspace"
          ? "result"
          : "u",
    );
  }, [inputs, operation, scenario]);
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      setStepIndex(stepsCount - 1);
      setPlaying(false);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const initial = progress ?? 0;
    const generation = playbackGeneration.current;
    const animate = (time: number) => {
      if (generation !== playbackGeneration.current) return;
      const next = Math.min(initial + (time - start) / 6500, 1);
      setProgress(next);
      setStepIndex(Math.min(Math.floor(next * stepsCount), stepsCount - 1));
      if (next < 1) frame = requestAnimationFrame(animate);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // Capture progress when playback starts; frame updates do not restart the clock.
  }, [playing, stepsCount]);
  useEffect(() => {
    if (help) {
      lastHelpTrigger.current = document.activeElement as HTMLElement;
      helpRef.current?.showModal();
    } else if (helpRef.current?.open) {
      helpRef.current.close();
      lastHelpTrigger.current?.focus();
    }
  }, [help]);

  const update = (values: Partial<MathInputs>) =>
    setInputs((previous) => ({ ...previous, ...values }));
  const selectOperation = (next: Operation) => {
    setOperation(next);
    if (next === "normalize") setShowSphere(true);
  };
  const changeStep = (next: number) => {
    setClickedVector(null);
    const index = Math.max(0, Math.min(next, stepsCount - 1));
    setPlaying(false);
    setStepIndex(index);
    setProgress((index + 1) / stepsCount);
  };
  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(
        `${lesson.title}\n${lesson.equation}\n${lesson.value}\n${lesson.steps.join("\n")}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const unary = operation === "scale" || operation === "normalize";
  const isBasis = operation === "basis";
  const isMatrix = operation === "nullspace";
  const operationIndex =
    groups.flatMap((group) => group.operations).indexOf(operation) + 1;
  const aiPoints = useMemo(
    () =>
      rankings.map(({ document, score }) => ({
        id: document.id,
        label: document.title,
        position: document.vector,
        score: score ?? undefined,
        color: document.category.toLowerCase().includes("access")
          ? "#6ba5ff"
          : document.category.toLowerCase().includes("food")
            ? "#f6b76f"
            : "#64d9be",
      })),
    [rankings],
  );
  const isPca = scenario === "ai" && aiView === "pca";
  const isAnalogy = scenario === "ai" && aiView === "analogy";
  const mathVectors = useMemo(() => {
    const choices: Array<{ id: string; label: string; coordinates: Vec3 }> = [];
    if (isBasis)
      inputs.basis.forEach((coordinates, index) =>
        choices.push({
          id: `basis${index}`,
          label: `Basis b${index + 1}`,
          coordinates,
        }),
      );
    else if (!isMatrix) {
      choices.push({ id: "u", label: "Vector u", coordinates: inputs.u });
      if (!unary)
        choices.push({ id: "v", label: "Vector v", coordinates: inputs.v });
    }
    if (operation === "planeProject")
      choices.push({
        id: "target",
        label: "Target x",
        coordinates: inputs.target,
      });
    if (lesson.result)
      choices.push({
        id: "result",
        label: isBasis
          ? "Target x"
          : operation === "gramSchmidt"
            ? "Orthonormal q1"
            : "Result",
        coordinates: lesson.result,
      });
    if (lesson.secondary)
      choices.push({
        id: "secondary",
        label: operation === "gramSchmidt" ? "Orthonormal q2" : "Residual",
        coordinates: lesson.secondary,
      });
    if (clickedVector) {
      const index = choices.findIndex(
        (choice) => choice.id === clickedVector.id,
      );
      if (index >= 0) choices[index] = clickedVector;
      else choices.push(clickedVector);
    }
    return choices;
  }, [inputs, isBasis, isMatrix, unary, operation, lesson, clickedVector]);

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setScenario("math");
          }}
        >
          <span className="brand-mark">
            <Axis3D size={25} strokeWidth={1.8} />
          </span>
          <span>
            vector<span className="brand-light">space</span>
            <small>EXPLORER</small>
          </span>
        </a>
        <nav className="scenario-nav" aria-label="Learning lab">
          <button
            className={scenario === "math" ? "active" : ""}
            aria-pressed={scenario === "math"}
            onClick={() => setScenario("math")}
          >
            <Box size={16} />
            Vector Math Lab
          </button>
          <button
            className={scenario === "ai" ? "active" : ""}
            aria-pressed={scenario === "ai"}
            onClick={() => setScenario("ai")}
          >
            <BrainCircuit size={17} />
            AI & LLM Lab<span className="new-tag">EXPLORE</span>
          </button>
        </nav>
        <div className="header-end">
          <span className="local-badge">
            <span />
            Interactive learning lab
          </span>
          <button
            aria-label="Reset workspace view"
            title="Reset workspace view"
            className="help-button"
            onClick={() => setResetKey((key) => key + 1)}
          >
            <RotateCcw size={17} />
          </button>
          <button
            aria-label="Quick guide"
            className="help-button"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={17} />
            <span>Quick guide</span>
          </button>
        </div>
      </header>

      <div className="page-intro">
        <div>
          <span className="eyebrow">
            <span />
            LEARN BY EXPLORING
          </span>
          <h1>
            A new perspective on{" "}
            {scenario === "math"
              ? "linear algebra."
              : "artificial intelligence."}
          </h1>
          <p>
            {scenario === "math"
              ? "Move beyond the equation. Make the mathematics visible."
              : "Explore the vector mathematics behind search, similarity, and retrieval."}
          </p>
        </div>
        <div className="intro-note">
          <Compass size={23} strokeWidth={1.4} />
          <span>
            Change a number.
            <br />
            <strong>Discover a connection.</strong>
          </span>
        </div>
      </div>

      <main
        id="workspace"
        className={`workspace ${scenario === "ai" ? "ai-workspace" : ""}`}
      >
        <aside
          className={`control-panel ${controlsOpen ? "controls-open" : "controls-collapsed"}`}
          aria-label={
            scenario === "math" ? "Math lab controls" : "AI lab controls"
          }
        >
          <button
            type="button"
            className="mobile-controls-toggle"
            aria-expanded={controlsOpen}
            aria-controls="lab-controls-content"
            onClick={() => setControlsOpen((open) => !open)}
          >
            <Layers3 size={16} />
            <span>Experiment controls</span>
            <span>{controlsOpen ? "Collapse" : "Expand"}</span>
            <ChevronDown size={16} />
          </button>
          <div id="lab-controls-content" className="lab-controls-content">
            {scenario === "math" ? (
              <>
                <div className="panel-heading">
                  <span className="section-kicker">
                    <Layers3 size={15} />
                    YOUR EXPERIMENT
                  </span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setInputs(structuredClone(defaultInputs));
                      setResetKey((key) => key + 1);
                    }}
                  >
                    <RotateCcw size={13} />
                    Reset
                  </button>
                </div>
                <label className="field-label" htmlFor="operation">
                  Choose an operation
                </label>
                <div className="select-wrapper">
                  <select
                    id="operation"
                    value={operation}
                    onChange={(event) =>
                      selectOperation(event.target.value as Operation)
                    }
                  >
                    {groups.map((group) => (
                      <optgroup key={group.title} label={group.title}>
                        {group.operations.map((op) => (
                          <option key={op} value={op}>
                            {operationLabels[op]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
                <div className="panel-rule" />
                <div className="input-section-heading">
                  <h2>
                    {isMatrix
                      ? "Your matrix"
                      : isBasis
                        ? "Your basis & target"
                        : "Your vectors"}
                  </h2>
                  <span>{isMatrix ? "A · x = 0" : "ℝ³"}</span>
                </div>
                {isMatrix ? (
                  <div className="matrix-editor">
                    <span className="matrix-bracket">[</span>
                    <div>
                      {inputs.matrix.map((row, i) => (
                        <div className="matrix-row" key={i}>
                          {row.map((value, j) => (
                            <NumericInput
                              key={j}
                              value={value}
                              label={`Matrix row ${i + 1} column ${j + 1}`}
                              onChange={(next) => {
                                const matrix = inputs.matrix.map((r) => [...r]);
                                matrix[i][j] = next;
                                update({ matrix });
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <span className="matrix-bracket">]</span>
                  </div>
                ) : isBasis ? (
                  <>
                    {inputs.basis.map((vector, index) => (
                      <VectorInput
                        key={index}
                        name={`b${index + 1}`}
                        color={["#669fff", "#ec8c81", "#b39bea"][index]}
                        value={vector}
                        onChange={(next) => {
                          const basis = [...inputs.basis] as [Vec3, Vec3, Vec3];
                          basis[index] = next;
                          update({ basis });
                        }}
                      />
                    ))}
                    <VectorInput
                      name="Target x"
                      color="#1caa89"
                      value={inputs.target}
                      onChange={(target) => update({ target })}
                    />
                  </>
                ) : (
                  <>
                    <VectorInput
                      name="Vector u"
                      color="#407ded"
                      value={inputs.u}
                      onChange={(u) => update({ u })}
                      caption="first vector"
                    />
                    {!unary && (
                      <VectorInput
                        name="Vector v"
                        color="#e67e70"
                        value={inputs.v}
                        onChange={(v) => update({ v })}
                        caption="second vector"
                      />
                    )}
                    {operation === "planeProject" && (
                      <VectorInput
                        name="Target x"
                        color="#b39bea"
                        value={inputs.target}
                        onChange={(target) => update({ target })}
                        caption="project this vector"
                      />
                    )}
                  </>
                )}
                {(operation === "scale" || operation === "combination") && (
                  <div className="scalar-row">
                    <label>
                      Scalar a
                      <NumericInput
                        value={inputs.a}
                        label="Scalar a"
                        onChange={(a) => update({ a })}
                      />
                    </label>
                    {operation === "combination" && (
                      <label>
                        Scalar b
                        <NumericInput
                          value={inputs.b}
                          label="Scalar b"
                          onChange={(b) => update({ b })}
                        />
                      </label>
                    )}
                  </div>
                )}
                <p className="input-hint">
                  <span className="live-dot" />
                  Updates live as you type
                </p>
                <div className="panel-rule" />
                <div className="input-section-heading">
                  <h2>Try a preset</h2>
                  <Sparkles size={14} />
                </div>
                <div className="preset-list">
                  {presetMap[operation]?.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => update(structuredClone(preset.values))}
                    >
                      {preset.label}
                      <ArrowRight size={13} />
                    </button>
                  ))}
                </div>
                <div className="teaching-note">
                  <Lightbulb size={18} />
                  <p>
                    Start with a preset, then change a coordinate. What stays
                    the same?
                  </p>
                </div>
              </>
            ) : (
              <>
                <div
                  className="ai-view-switch"
                  role="group"
                  aria-label="AI experiment"
                >
                  <button
                    aria-pressed={aiView === "teaching"}
                    onClick={() => setAiView("teaching")}
                  >
                    Teaching vectors
                  </button>
                  <button
                    aria-pressed={aiView === "counts"}
                    onClick={() => setAiView("counts")}
                  >
                    Count vectors
                  </button>
                  <button
                    aria-pressed={aiView === "pca"}
                    onClick={() => setAiView("pca")}
                  >
                    PCA projection
                  </button>
                  <button
                    aria-pressed={aiView === "analogy"}
                    onClick={() => setAiView("analogy")}
                  >
                    Vector analogy
                  </button>
                </div>
                {aiView === "pca" ? (
                  <PcaLesson
                    queryId={pcaQueryId}
                    onQueryIdChange={setPcaQueryId}
                    selectedId={pcaSelectedId}
                    onSelect={setPcaSelectedId}
                  />
                ) : aiView === "analogy" ? (
                  <AnalogyLesson
                    reverse={analogyReverse}
                    onReverse={setAnalogyReverse}
                  />
                ) : (
                  <AiPanel
                    query={query}
                    onQueryChange={setQuery}
                    metric={metric}
                    onMetricChange={setMetric}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    normalized={normalized}
                    onNormalizedChange={setNormalized}
                    pointCount={pointCount}
                    onPointCountChange={setPointCount}
                    documents={documents}
                    representation={aiView}
                    onRepresentationChange={setAiView}
                  />
                )}
              </>
            )}
          </div>
        </aside>

        <section className="experiment-area" aria-label="Experiment workspace">
          <div className="experiment-header">
            <div>
              <div className="experiment-meta">
                <span>
                  {scenario === "math" ? "VECTOR MATH LAB" : "AI & LLM LAB"}
                </span>
                <span className="meta-divider">/</span>
                <span>
                  {scenario === "math"
                    ? `EXPERIMENT ${String(operationIndex).padStart(2, "0")}`
                    : "TEACHING VECTORS"}
                </span>
              </div>
              <h2>
                {scenario === "math"
                  ? operationLabels[operation]
                  : isPca
                    ? "From four dimensions to three"
                    : isAnalogy
                      ? "An analogy in vector arithmetic"
                      : aiView === "counts"
                        ? "From words to count vectors"
                        : "The geometry of similarity"}
              </h2>
              <p>
                {scenario === "math"
                  ? descriptions[operation]
                  : isPca
                    ? "Compute similarity in the original space. Explore what projection changes."
                    : isAnalogy
                      ? "Subtract a relation. Add a new starting point. Inspect the computed offset."
                      : "Every point is a document. Every connection begins with a vector."}
              </p>
            </div>
            <span className="dimension-badge">
              <Box size={14} />
              3D WORKSPACE
            </span>
          </div>
          {scenario === "ai" && !isPca && !isAnalogy && (
            <div
              className="ai-learning-path"
              role="list"
              aria-label="Embedding and retrieval learning flow"
            >
              {[
                "Vector representation",
                "Similarity",
                "Retrieve",
                "Context",
                "RAG answer",
              ].map((stage, index) => (
                <span role="listitem" key={stage}>
                  <b>{index + 1}</b>
                  {stage}
                  {index < 4 && <ArrowRight size={12} />}
                </span>
              ))}
            </div>
          )}
          <div className="scene-card" ref={canvasSection}>
            <div className="scene-toolbar">
              <div className="scene-mode">
                <span className="scene-live-dot" />
                {scenario === "math"
                  ? "Free 3D space"
                  : isPca
                    ? "PCA projection · approximate visualization"
                    : isAnalogy
                      ? "Contrived 3D analogy vectors"
                      : normalized
                        ? "Normalized teaching vectors"
                        : "3D teaching vectors"}
              </div>
              <div className="scene-tools">
                <button
                  title="Reset camera view"
                  aria-label="Reset camera view"
                  onClick={() => setResetKey((key) => key + 1)}
                >
                  <Focus size={16} />
                </button>
                <button
                  title="Expand 3D workspace"
                  aria-label="Expand 3D workspace"
                  onClick={() => {
                    if (document.fullscreenElement)
                      void document.exitFullscreen();
                    else void canvasSection.current?.requestFullscreen?.();
                  }}
                >
                  <Expand size={15} />
                </button>
              </div>
            </div>
            <div className="scene-viewport">
              <VectorScene
                u={
                  scenario === "math"
                    ? inputs.u
                    : isPca
                      ? pcaView.query
                      : isAnalogy
                        ? analogyResult(analogyReverse)
                        : queryVector
                }
                v={scenario === "math" ? inputs.v : ZERO}
                result={scenario === "math" ? lesson.result : undefined}
                secondary={scenario === "math" ? lesson.secondary : undefined}
                operation={scenario === "math" ? operation : "ai"}
                showSphere={isPca ? false : showSphere}
                showGrid={showGrid}
                showSpan={showSpan}
                showLabels={showLabels}
                resetKey={resetKey}
                playProgress={progress}
                points={
                  scenario === "ai"
                    ? isPca
                      ? pcaView.points
                      : isAnalogy
                        ? analogyPoints
                        : aiPoints
                    : undefined
                }
                selectedPoint={
                  isPca
                    ? pcaSelectedId
                    : isAnalogy
                      ? analogySelectedId
                      : selectedId
                }
                onSelectPoint={
                  isPca
                    ? setPcaSelectedId
                    : isAnalogy
                      ? setAnalogySelectedId
                      : setSelectedId
                }
                normalizedPoints={!isPca && !isAnalogy && normalized}
                aiMetric={
                  scenario === "ai" && !isPca && !isAnalogy ? metric : undefined
                }
                nullBasis={lesson.nullBasis}
                basis={inputs.basis}
                target={inputs.target}
                a={inputs.a}
                b={inputs.b}
                showNormShells={scenario === "math" && showNormShells}
                showReferencePlanes={showReferencePlanes}
                onSelectVector={(detail) => {
                  setPlaying(false);
                  setClickedVector(detail);
                  setInspectedVector(detail.id);
                }}
                basisCoordinates={lesson.basisCoordinates}
                scaledBasis={lesson.scaledBasis}
                gramProjection={lesson.gramProjection}
                gramResidual={lesson.gramResidual}
              />
            </div>
            <div className="scene-legend">
              {scenario === "math" ? (
                <>
                  <span>
                    <i style={{ background: "#649cff" }} />
                    {isBasis ? "Basis b1" : "Vector u"}
                  </span>
                  {!unary && (
                    <span>
                      <i style={{ background: "#f49383" }} />
                      {isBasis ? "Basis b2" : "Vector v"}
                    </span>
                  )}
                  <span>
                    <i style={{ background: "#5bd5ad" }} />
                    {isBasis ? "Target x" : "Result"}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    <i style={{ background: "#9eacff" }} />
                    Query
                  </span>
                  <span>
                    <i style={{ background: "#64d9be" }} />
                    Documents
                  </span>
                  <span className="legend-caption">
                    {isPca
                      ? "Synthetic 4D data · original scores"
                      : isAnalogy
                        ? "Contrived arithmetic example"
                        : aiView === "counts"
                          ? "Keyword count vectors"
                          : pointCount > 8
                            ? "Synthetic teaching corpus"
                            : "Handcrafted examples"}
                  </span>
                </>
              )}
            </div>
            <div className="scene-bottom-bar">
              <span>
                <MousePointer2 size={12} />
                Drag to orbit<span className="interaction-separator">·</span>
                Scroll to zoom<span className="interaction-separator">·</span>
                Right-drag to pan
              </span>
              <button onClick={() => setResetKey((key) => key + 1)}>
                <RotateCcw size={12} />
                Reset view
              </button>
            </div>
          </div>
          <div className="layer-bar">
            <span>
              <Layers3 size={14} />
              Scene layers
            </span>
            <div>
              <LayerToggle checked={showGrid} onChange={setShowGrid}>
                <Grid3X3 size={13} />
                Grid
              </LayerToggle>
              {!isPca && (
                <LayerToggle checked={showSphere} onChange={setShowSphere}>
                  Unit sphere
                </LayerToggle>
              )}
              <LayerToggle checked={showLabels} onChange={setShowLabels}>
                Labels
              </LayerToggle>
              {scenario === "math" && (
                <>
                  <LayerToggle checked={showSpan} onChange={setShowSpan}>
                    Subspace
                  </LayerToggle>
                  <LayerToggle
                    checked={showNormShells}
                    onChange={setShowNormShells}
                  >
                    Norm shells
                  </LayerToggle>
                </>
              )}
              <LayerToggle
                checked={showReferencePlanes}
                onChange={setShowReferencePlanes}
              >
                Reference planes
              </LayerToggle>
            </div>
          </div>

          {scenario === "math" && (
            <VectorDetails
              vectors={mathVectors}
              selectedId={inspectedVector}
              onSelect={(id) => {
                setClickedVector(null);
                setInspectedVector(id);
              }}
            />
          )}

          {scenario === "math" ? (
            <div className="results-grid">
              <section className="result-card" aria-label="Calculated result">
                <div className="result-card-heading">
                  <span>
                    <span className="result-status-dot" />
                    CALCULATED RESULT
                  </span>
                  <button
                    aria-label="Copy calculated result"
                    title="Copy result and steps"
                    onClick={() => void copyResult()}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <div className="result-equation" data-testid="result-equation">
                  {lesson.equation}
                </div>
                <div className="result-value" data-testid="result-value">
                  {lesson.value}
                </div>
                {lesson.warning && (
                  <p className="warning" role="status">
                    {lesson.warning}
                  </p>
                )}
                <div className="concept">
                  <BookOpen size={16} />
                  <div>
                    <h3>The idea behind it</h3>
                    <p>{lesson.concept}</p>
                    {lesson.domainExample && (
                      <div className="domain-example">
                        <h3>Where you might use this</h3>
                        <p>{lesson.domainExample}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="ai-explainer">
              <div className="ai-explainer-icon">
                <BrainCircuit size={24} />
              </div>
              <div>
                <h3>
                  {isPca
                    ? "A projection is a useful picture, not the original space."
                    : "Similar directions. Related ideas."}
                </h3>
                <p>
                  {isPca ? (
                    "This local PCA lesson computes a three-dimensional view of synthetic four-dimensional vectors. Original-space rankings and projected scores are shown separately: centering and dropping a component can change angles, distances, and neighbors."
                  ) : (
                    <>
                      Cosine compares direction; Euclidean distance compares
                      position. Switch metrics to see why the same documents can
                      rank differently. The numbers come from the displayed
                      teaching vectors.
                    </>
                  )}
                </p>
              </div>
              <span className="simulation-badge">NO LIVE MODEL</span>
            </div>
          )}
        </section>

        <aside
          className="instructions-panel"
          aria-label="Experiment instructions"
          tabIndex={0}
        >
          <div className="instructions-title">
            <span className="section-kicker">
              <BookOpen size={15} />
              YOUR GUIDE
            </span>
            <h2>Instructions</h2>
            <p>
              {scenario === "math"
                ? `Explore ${operationLabels[operation].toLowerCase()} one step at a time.`
                : isPca
                  ? "See what is preserved, and what is lost, when dimensions are reduced."
                  : isAnalogy
                    ? "Follow the offset using transparent teaching coordinates."
                    : "Build a query, explore its neighbors, and follow the sources."}
            </p>
          </div>
          {scenario === "math" ? (
            <section className="steps-card" aria-label="Worked steps">
              <div className="steps-heading">
                <h3>
                  <span className="section-kicker">
                    <span className="steps-icon">≡</span>STEP BY STEP
                  </span>
                </h3>
                <button
                  className={`play-button ${playing ? "playing" : ""}`}
                  disabled={!!lesson.warning && !lesson.steps.length}
                  onClick={() => {
                    if (playing) setPlaying(false);
                    else {
                      if (progress === 1) setProgress(null);
                      setPlaying(true);
                    }
                  }}
                >
                  {playing ? (
                    <Pause size={12} fill="currentColor" />
                  ) : (
                    <Play size={12} fill="currentColor" />
                  )}
                  {playing ? "Pause" : "Play steps"}
                </button>
              </div>
              <ol className="steps-list">
                {lesson.steps.map((step, index) => (
                  <li
                    key={`${operation}-${index}`}
                    className={
                      progress !== null && index === stepIndex
                        ? "active-step"
                        : ""
                    }
                  >
                    <button
                      data-testid={`step-${index + 1}`}
                      aria-current={
                        progress !== null && index === stepIndex
                          ? "step"
                          : undefined
                      }
                      onClick={() => changeStep(index)}
                    >
                      <span className="step-number">{index + 1}</span>
                      <span>{step}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="step-footer">
                <span>
                  {progress === null
                    ? "Explore at your own pace"
                    : `Step ${stepIndex + 1} of ${stepsCount}`}
                </span>
                <div>
                  <button
                    aria-label="Previous step"
                    disabled={stepIndex === 0}
                    onClick={() => changeStep(stepIndex - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    aria-label="Next step"
                    disabled={stepIndex >= stepsCount - 1}
                    onClick={() => changeStep(stepIndex + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section
              className="steps-card"
              aria-label="AI exploration instructions"
            >
              <h3 className="section-kicker">HOW TO EXPLORE</h3>
              <ol className="instruction-list">
                {(isPca
                  ? [
                      "Choose a four-dimensional query in the left panel.",
                      "Inspect the original 4D vector and its 3D PCA coordinates.",
                      "Compare original cosine and distance with projected values.",
                      "Select points G and H: the discarded feature separates them in 4D even though their 3D positions coincide.",
                      "Open the calculation details to inspect the mean, eigenvalues, and explained variance.",
                    ]
                  : isAnalogy
                    ? [
                        "Select a forward or reverse analogy preset.",
                        "Read the coordinates for each country and capital.",
                        "Subtract the first country, then add the destination country.",
                        "Compare the computed arrow with its matching capital point. These equalities are contrived teaching examples.",
                      ]
                    : [
                        "Enter a query or choose a preset; recognized words determine its three feature counts.",
                        "Set the number of points, use a quick preset, or add 25 synthetic examples.",
                        "Switch between cosine similarity and Euclidean distance. Scores are computed from the current corpus.",
                        "Select a document in the list or click a point to inspect its text and coordinates.",
                        aiView === "counts"
                          ? "Open the count matrix. Its displayed counts are the plotted document coordinates."
                          : "Turn on normalized directions to compare angles; the numeric ranking still uses the original vectors.",
                        "Expand Retrieval to Answer, then choose Retrieve, Context, and Answer to follow the source-based simulation.",
                      ]
                ).map((instruction, index) => (
                  <li key={instruction}>
                    <span className="step-number">{index + 1}</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="instructions-tips">
            <h3>
              <MousePointer2 size={14} />
              Explore the scene
            </h3>
            <p>
              <strong>Orbit</strong> Left-drag or use one finger.
              <br />
              <strong>Zoom</strong> Scroll or pinch.
              <br />
              <strong>Pan</strong> Right-drag or use two fingers.
              <br />
              <strong>Reset</strong> Restore the canonical view.
            </p>
            <p>
              {isPca
                ? "The PCA plot is approximate. Its visible distances and angles can differ from the original scores."
                : "The unit sphere has radius 1. It is a reference surface; vectors can extend beyond it."}
            </p>
          </section>
        </aside>
      </main>
      <footer className="page-footer">
        <span>
          <Axis3D size={14} />
          Vector Space Explorer<span className="footer-dot">·</span>Built for
          curious minds
        </span>
        <span>
          ℝ³ is unbounded. The sphere is a reference, not a boundary.
          <ArrowDown size={12} className="footer-arrow" />
        </span>
      </footer>

      <dialog
        aria-labelledby="quick-guide-title"
        ref={helpRef}
        className="help-dialog"
        onCancel={() => setHelp(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelp(false);
        }}
      >
        <button
          className="dialog-close"
          aria-label="Close quick guide"
          onClick={() => setHelp(false)}
        >
          <X size={19} />
        </button>
        <span className="eyebrow">A LITTLE ORIENTATION</span>
        <h2 id="quick-guide-title">Your ideas, in three dimensions.</h2>
        <p>
          Choose an operation, enter coordinates, and explore the picture.
          Results and worked steps update immediately.
        </p>
        <div className="help-items">
          <div>
            <MousePointer2 />
            <span>
              <strong>Make room to explore</strong>Left-drag to orbit, scroll or
              pinch to zoom, and right-drag to pan. Reset view brings you home.
            </span>
          </div>
          <div>
            <Box />
            <span>
              <strong>A sphere is a reference</strong>Turn on the unit sphere to
              see vectors of length 1. Vectors in ℝ³ can extend infinitely
              beyond it.
            </span>
          </div>
          <div>
            <Play />
            <span>
              <strong>Follow the mathematics</strong>Play an operation or select
              a numbered step. Changing inputs cancels the old animation.
              Reduced motion is respected.
            </span>
          </div>
          <div>
            <BrainCircuit />
            <span>
              <strong>Explore AI honestly</strong>The AI Lab uses a small local
              corpus and documented teaching vectors. Its RAG answer is a
              simulation, with no live model.
            </span>
          </div>
        </div>
        <p className="help-fine-print">
          Coordinates use X right, Y depth, Z up. Enter finite values within
          ±1,000,000; invalid fields retain the last valid calculation and
          restore it on blur. The numeric results remain available if WebGL is
          unavailable.
        </p>
        <button className="primary-button" onClick={() => setHelp(false)}>
          Let’s explore
          <ArrowRight size={16} />
        </button>
      </dialog>
    </div>
  );
}
