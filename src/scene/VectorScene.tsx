import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  normalize as normalizeMath,
  RELATIVE_TOLERANCE,
  spanRank,
} from "../math/vector";
import "./scene.css";

type Vec3 = [number, number, number];
export type ScenePoint = {
  id: string;
  label: string;
  position: Vec3;
  color?: string;
  score?: number;
};
export type VectorSelection = {
  id: string;
  label: string;
  coordinates: Vec3;
  norm: number;
  azimuth: number | null;
  inclination: number | null;
};
export interface VectorSceneProps {
  u: Vec3;
  v: Vec3;
  result?: Vec3;
  secondary?: Vec3;
  operation: string;
  showSphere: boolean;
  showGrid: boolean;
  showSpan: boolean;
  showLabels: boolean;
  resetKey: number;
  playProgress: number | null;
  points?: ScenePoint[];
  selectedPoint?: string;
  onSelectPoint?: (id: string) => void;
  normalizedPoints?: boolean;
  nullBasis?: Vec3[];
  basis?: [Vec3, Vec3, Vec3];
  target?: Vec3;
  a?: number;
  b?: number;
  showNormShells?: boolean;
  showReferencePlanes?: boolean;
  onSelectVector?: (detail: VectorSelection) => void;
  basisCoordinates?: Vec3;
  scaledBasis?: [Vec3, Vec3, Vec3];
  gramProjection?: Vec3;
  gramResidual?: Vec3;
  aiMetric?: "cosine" | "euclidean";
  clusterMode?: boolean;
  clusterLabels?: Array<{ label: string; position: Vec3; color: string }>;
  clusterLinks?: Array<[string, string]>;
  showConnections?: boolean;
  queryVisible?: boolean;
  queryLabel?: string;
}

type SceneLabel = {
  element: HTMLDivElement;
  position: THREE.Vector3;
  always?: boolean;
};
type SceneEngine = {
  update: (props: VectorSceneProps) => void;
  reset: () => void;
  destroy: () => void;
};
const C = {
  u: "#69a9ff",
  v: "#ff8d86",
  result: "#63e4bb",
  secondary: "#f8cf7c",
  ink: "#b5c8e5",
};
const vector = (v: Vec3) => new THREE.Vector3(...v);
const finite = (v?: Vec3): v is Vec3 => !!v && v.every(Number.isFinite);
function particleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,.8)");
  gradient.addColorStop(0.4, "rgba(255,255,255,.24)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const fmt = (v: Vec3) =>
  `(${v.map((x) => (x === 0 ? "0" : Number(x.toPrecision(6)))).join(", ")})`;
const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.InstancedMesh) child.dispose();
    const drawable = child as THREE.Mesh;
    drawable.geometry?.dispose();
    if (Array.isArray(drawable.material))
      drawable.material.forEach((material) => material.dispose());
    else drawable.material?.dispose();
  });
};

function createEngine(
  host: HTMLDivElement,
  labelHost: HTMLDivElement,
  onSelection: (id: string) => void,
  onVectorSelection: (detail: VectorSelection) => void,
): SceneEngine {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#101b32");
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 2000);
  camera.up.set(0, 0, 1);
  camera.position.set(7, -9, 6);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive three-dimensional vector space. Drag to rotate, scroll to zoom. Calculated values are available in the results panel.",
  );
  renderer.domElement.setAttribute("role", "img");
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 0.6;
  controls.maxDistance = 700;
  controls.target.set(0, 0, 0);
  controls.update();

  const fixed = new THREE.Group();
  const dynamic = new THREE.Group();
  const arrowGroup = new THREE.Group();
  const embeddingGroup = new THREE.Group();
  scene.add(fixed, dynamic, arrowGroup, embeddingGroup);
  const origin = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 16, 10),
    new THREE.MeshBasicMaterial({ color: "#c3d1e6" }),
  );
  fixed.add(origin);
  const labels: SceneLabel[] = [];
  const tooltip = document.createElement("div");
  tooltip.className = "scene-hover-tooltip";
  tooltip.style.display = "none";
  labelHost.appendChild(tooltip);
  const arrows = new Map<
    string,
    { arrow: THREE.ArrowHelper; dot: THREE.Mesh; label: SceneLabel }
  >();
  const pointMeshes: THREE.Object3D[] = [];
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshBasicMaterial({
      color: "#7ca7f2",
      transparent: true,
      opacity: 0.075,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  fixed.add(sphere);
  const guides = new THREE.Group();
  for (const axis of [0, 1, 2]) {
    const circle: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      circle.push(
        axis === 0
          ? new THREE.Vector3(0, Math.cos(a), Math.sin(a))
          : axis === 1
            ? new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
            : new THREE.Vector3(Math.cos(a), Math.sin(a), 0),
      );
    }
    guides.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(circle),
        new THREE.LineBasicMaterial({
          color: "#8aaee7",
          transparent: true,
          opacity: 0.2,
        }),
      ),
    );
  }
  fixed.add(guides);
  const grid = new THREE.GridHelper(12, 24, "#3a5276", "#263a58");
  grid.rotation.x = Math.PI / 2;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.4;
  fixed.add(grid);
  const referencePlanes = new THREE.Group();
  for (const which of ["xz", "yz"]) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        color: which === "xz" ? "#6e89be" : "#77ac9d",
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    if (which === "xz") plane.rotation.x = Math.PI / 2;
    else plane.rotation.y = Math.PI / 2;
    referencePlanes.add(plane);
  }
  fixed.add(referencePlanes);
  const normShells = [C.u, C.v].map((color) => {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 28),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    fixed.add(shell);
    return shell;
  });

  const addLabel = (
    text: string,
    position: THREE.Vector3,
    color: string,
    always = false,
  ) => {
    const element = document.createElement("div");
    element.className = "scene-object-label";
    element.textContent = text;
    element.style.setProperty("--label-color", color);
    labelHost.appendChild(element);
    const label = { element, position, always };
    labels.push(label);
    return label;
  };
  const axes: { line: THREE.Line; label: SceneLabel; axis: THREE.Vector3 }[] =
    [];
  const normLabels = [C.u, C.v].map((color, index) =>
    addLabel(
      `norm shell ${index === 0 ? "u" : "v"}`,
      new THREE.Vector3(),
      color,
    ),
  );
  [
    [new THREE.Vector3(1, 0, 0), "#de807f", "x"],
    [new THREE.Vector3(0, 1, 0), "#6ac4b6", "y"],
    [new THREE.Vector3(0, 0, 1), "#7b9ce8", "z"],
  ].forEach(([direction, color, name]) => {
    const axis = direction as THREE.Vector3;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        axis.clone().multiplyScalar(-5),
        axis.clone().multiplyScalar(5),
      ]),
      new THREE.LineBasicMaterial({
        color: color as string,
        transparent: true,
        opacity: 0.65,
      }),
    );
    fixed.add(line);
    axes.push({
      line,
      axis,
      label: addLabel(
        String(name),
        axis.clone().multiplyScalar(5.2),
        color as string,
        true,
      ),
    });
  });

  // Render a separate orientation scene in the corner, independent of the orbit target.
  const gizmoScene = new THREE.Scene();
  const gizmoCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  gizmoCamera.up.set(0, 0, 1);
  const gizmoOrigin = new THREE.Vector3();
  const gizmoLabels: { element: HTMLDivElement; tip: THREE.Vector3 }[] = [];
  [
    [new THREE.Vector3(1, 0, 0), "#ed8f8c", "X"],
    [new THREE.Vector3(0, 1, 0), "#73d7be", "Y"],
    [new THREE.Vector3(0, 0, 1), "#86aaff", "Z"],
  ].forEach(([direction, color, name]) => {
    const d = direction as THREE.Vector3;
    const helper = new THREE.ArrowHelper(
      d,
      gizmoOrigin,
      0.9,
      color as string,
      0.18,
      0.1,
    );
    gizmoScene.add(helper);
    const element = document.createElement("div");
    element.className = "scene-gizmo-label";
    element.textContent = String(name);
    element.style.color = color as string;
    labelHost.appendChild(element);
    gizmoLabels.push({ element, tip: d.clone().multiplyScalar(1.16) });
  });

  let width = 1;
  let height = 1;
  let props: VectorSceneProps;
  let didFit = false;
  let extent = 4;
  let oldExtent = 4;
  let dynamicLabels: SceneLabel[] = [];
  let embeddingKey = "";
  let embeddingInstances: THREE.InstancedMesh | null = null;
  const embeddingMeshes = new Map<string, THREE.Mesh>();
  let staticKey = "";
  let staticUpdates = 0;
  let embeddingGeneration = 0;
  let previousBoundsKey = "";
  let clusterCloud: THREE.Points | null = null;
  let clusterCore: THREE.Points | null = null;
  let clusterCapacity = 0;
  let framedClusterCount = 0;
  let fitPositions: Vec3[] = [];
  const glowTexture = particleTexture();
  const queryMarker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: "#ffe2a3",
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const selectionHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: "#ffffff",
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  fixed.add(queryMarker, selectionHalo);
  const pointGeometry = new THREE.SphereGeometry(0.09, 20, 12);
  const dotGeometry = new THREE.SphereGeometry(0.048, 16, 10);
  let ticks = new THREE.Group();
  fixed.add(ticks);

  const clearDynamic = () => {
    dynamic.children.forEach(disposeObject);
    dynamic.clear();
    dynamicLabels.forEach((label) => {
      label.element.remove();
      const index = labels.indexOf(label);
      if (index >= 0) labels.splice(index, 1);
    });
    dynamicLabels = [];
  };
  const clearEmbedding = () => {
    embeddingGroup.children.forEach(disposeObject);
    embeddingGroup.clear();
    pointMeshes.length = 0;
    embeddingMeshes.clear();
    embeddingInstances = null;
    embeddingKey = "";
    clusterCloud = clusterCore = null;
    clusterCapacity = 0;
    host.dataset.scenePointCount = "0";
  };
  const line = (
    points: THREE.Vector3[],
    color: string,
    dashed = false,
    opacity = 0.8,
  ) => {
    const material = dashed
      ? new THREE.LineDashedMaterial({
          color,
          dashSize: extent * 0.035,
          gapSize: extent * 0.024,
          transparent: true,
          opacity,
        })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const object = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      material,
    );
    if (dashed) object.computeLineDistances();
    dynamic.add(object);
    return object;
  };
  const updateArrow = (
    id: string,
    value: Vec3 | undefined,
    color: string,
    name: string,
    start = new THREE.Vector3(),
    show = true,
  ) => {
    let entry = arrows.get(id);
    if (!entry) {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(),
        1,
        color,
      );
      const dot = new THREE.Mesh(
        dotGeometry,
        new THREE.MeshBasicMaterial({ color }),
      );
      arrowGroup.add(arrow, dot);
      entry = { arrow, dot, label: addLabel(name, new THREE.Vector3(), color) };
      arrows.set(id, entry);
    }
    const valid = finite(value) && show;
    const direction = valid ? vector(value!) : new THREE.Vector3();
    const length = Math.hypot(direction.x, direction.y, direction.z);
    entry.arrow.visible = valid && length > 1e-12;
    entry.dot.visible = valid;
    entry.arrow.position.copy(start);
    if (length > 1e-12) {
      entry.arrow.setDirection(direction.clone().normalize());
      entry.arrow.setLength(
        length,
        Math.min(extent * 0.105, length * 0.24),
        Math.min(extent * 0.042, length * 0.1),
      );
      entry.arrow.setColor(new THREE.Color(color));
    }
    const tip = start.clone().add(direction);
    entry.dot.position.copy(tip);
    entry.dot.scale.setScalar(Math.max(0.45, Math.min(3, extent / 4)));
    entry.label.position.copy(tip);
    entry.label.element.textContent = name;
    entry.label.element.dataset.priority = [
      "result",
      "query",
      "target",
    ].includes(id)
      ? "70"
      : ["u", "v"].includes(id) || id.startsWith("basis")
        ? "50"
        : "20";
    entry.label.element.title = valid
      ? `${name}: ${fmt(value!)} · magnitude ${length.toPrecision(5)}`
      : "";
    const coordinates = valid ? fmt(value!) : "";
    const angles =
      length > 1e-12 && valid
        ? `azimuth ${((Math.atan2(value![1], value![0]) * 180) / Math.PI).toFixed(1)}° · inclination ${((Math.acos(THREE.MathUtils.clamp(value![2] / length, -1, 1)) * 180) / Math.PI).toFixed(1)}°`
        : "unit direction and angles undefined";
    const tooltipText = `${name}  ${coordinates}\nMagnitude ${Number(length.toPrecision(5))}\n${angles}`;
    entry.dot.userData.sceneTooltip = tooltipText;
    entry.arrow.userData.sceneTooltip = tooltipText;
    const detail: VectorSelection | undefined = valid
      ? {
          id,
          label: name,
          coordinates: [...value!] as Vec3,
          norm: length,
          azimuth:
            length > 0
              ? (Math.atan2(value![1], value![0]) * 180) / Math.PI
              : null,
          inclination:
            length > 0
              ? (Math.acos(THREE.MathUtils.clamp(value![2] / length, -1, 1)) *
                  180) /
                Math.PI
              : null,
        }
      : undefined;
    entry.dot.userData.vectorDetail = detail;
    entry.arrow.userData.vectorDetail = detail;
    entry.label.element.dataset.visible = valid ? "true" : "false";
  };
  const subspace = (generators: Vec3[], color = "#68b5e4") => {
    const q: THREE.Vector3[] = [];
    generators.filter(finite).forEach((g) => {
      const normalized = normalizeMath(g);
      if (!normalized) return;
      const residual = vector(normalized);
      if (q.length === 1) {
        const normal = new THREE.Vector3().crossVectors(q[0], residual);
        if (normal.length() <= RELATIVE_TOLERANCE) return;
        q.push(new THREE.Vector3().crossVectors(normal, q[0]).normalize());
        return;
      }
      q.forEach((unit) => residual.addScaledVector(unit, -residual.dot(unit)));
      if (residual.length() > RELATIVE_TOLERANCE) q.push(residual.normalize());
    });
    if (q.length === 1)
      line(
        [
          q[0].clone().multiplyScalar(-extent * 1.2),
          q[0].clone().multiplyScalar(extent * 1.2),
        ],
        color,
        false,
        0.65,
      );
    if (q.length >= 2) {
      const s = extent * 0.84;
      const vertices = [
        q[0].clone().multiplyScalar(-s).addScaledVector(q[1], -s),
        q[0].clone().multiplyScalar(s).addScaledVector(q[1], -s),
        q[0].clone().multiplyScalar(s).addScaledVector(q[1], s),
        q[0].clone().multiplyScalar(-s).addScaledVector(q[1], s),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints([
        vertices[0],
        vertices[1],
        vertices[2],
        vertices[0],
        vertices[2],
        vertices[3],
      ]);
      geometry.computeVertexNormals();
      dynamic.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.105,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        ),
      );
      line([...vertices, vertices[0]], color, false, 0.3);
      for (let i = -4; i <= 4; i++) {
        const t = (i / 4) * s;
        line(
          [
            q[0].clone().multiplyScalar(-s).addScaledVector(q[1], t),
            q[0].clone().multiplyScalar(s).addScaledVector(q[1], t),
          ],
          color,
          false,
          0.09,
        );
        line(
          [
            q[1].clone().multiplyScalar(-s).addScaledVector(q[0], t),
            q[1].clone().multiplyScalar(s).addScaledVector(q[0], t),
          ],
          color,
          false,
          0.09,
        );
      }
      if (props.showSphere) {
        const circle: THREE.Vector3[] = [];
        for (let i = 0; i <= 128; i++)
          circle.push(
            q[0]
              .clone()
              .multiplyScalar(Math.cos((i / 128) * Math.PI * 2))
              .addScaledVector(q[1], Math.sin((i / 128) * Math.PI * 2)),
          );
        line(circle, "#a9d8f3", false, 0.7);
      }
    }
    if (q.length === 3) {
      const box = new THREE.Box3Helper(
        new THREE.Box3(
          new THREE.Vector3(-extent, -extent, -extent),
          new THREE.Vector3(extent, extent, extent),
        ),
        new THREE.Color(color),
      );
      (box.material as THREE.Material).transparent = true;
      (box.material as THREE.Material).opacity = 0.35;
      dynamic.add(box);
    }
  };

  const angleArc = (from: Vec3, to: Vec3, radius: number, color: string) => {
    const a = normalizeMath(from),
      b = normalizeMath(to);
    if (!a || !b) return;
    const u = vector(a),
      v = vector(b);
    const angle = Math.acos(THREE.MathUtils.clamp(u.dot(v), -1, 1));
    const tangent = v.clone().addScaledVector(u, -u.dot(v));
    if (tangent.length() < 1e-8)
      tangent.crossVectors(
        u,
        Math.abs(u.z) < 0.9
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(0, 1, 0),
      );
    tangent.normalize();
    line(
      Array.from({ length: 65 }, (_, i) =>
        u
          .clone()
          .multiplyScalar(Math.cos((angle * i) / 64) * radius)
          .addScaledVector(tangent, Math.sin((angle * i) / 64) * radius),
      ),
      color,
    );
  };

  const playback = (next: VectorSceneProps) => {
    if (next.points) return;
    const p =
      next.playProgress === null
        ? 1
        : THREE.MathUtils.clamp(next.playProgress, 0, 1);
    if (next.operation === "add") {
      updateArrow(
        "translated",
        next.v,
        "#ffb8a6",
        "v translated",
        vector(next.u).multiplyScalar(p),
      );
      updateArrow(
        "result",
        next.result,
        C.result,
        "result",
        undefined,
        p > 0.72,
      );
    }
    if (["scale", "normalize"].includes(next.operation) && finite(next.result))
      updateArrow(
        "result",
        vector(next.u).lerp(vector(next.result), p).toArray() as Vec3,
        C.result,
        next.operation === "normalize" ? "û" : "result",
      );
    if (
      ["project", "planeProject"].includes(next.operation) &&
      finite(next.result)
    ) {
      updateArrow(
        "result",
        vector(next.result)
          .multiplyScalar(next.playProgress === null ? 1 : Math.min(1, p * 2))
          .toArray() as Vec3,
        C.result,
        "projection",
      );
      const residual = dynamic.getObjectByName("projectionResidual");
      const marker = dynamic.getObjectByName("projectionMarker");
      if (residual) residual.visible = p > 0.55;
      if (marker) marker.visible = p > 0.85;
    }
    if (next.operation === "combination") {
      const au = vector(next.u).multiplyScalar(next.a ?? 1);
      const bv = vector(next.v).multiplyScalar(next.b ?? 1);
      updateArrow("scaledU", au.toArray() as Vec3, "#a0c8ff", "au");
      updateArrow(
        "scaledV",
        bv.toArray() as Vec3,
        "#ffc1b1",
        "bv",
        au.clone().multiplyScalar(p),
      );
      updateArrow(
        "result",
        next.result,
        C.result,
        "result",
        undefined,
        p > 0.72,
      );
    }
    if (next.operation === "basis" && next.scaledBasis && finite(next.result)) {
      const total = new THREE.Vector3();
      next.scaledBasis.forEach((component, index) => {
        const factor =
          next.playProgress === null
            ? 1
            : THREE.MathUtils.clamp(p * 3 - index, 0, 1);
        const partial = vector(component).multiplyScalar(factor);
        updateArrow(
          `basisComponent${index}`,
          partial.toArray() as Vec3,
          [C.u, C.v, C.secondary][index],
          `c${index + 1}b${index + 1}`,
          total.clone(),
          factor > 0,
        );
        total.add(partial);
      });
      updateArrow(
        "result",
        total.toArray() as Vec3,
        C.result,
        "x reconstructed",
      );
    }
    if (
      next.operation === "gramSchmidt" &&
      finite(next.result) &&
      finite(next.secondary) &&
      finite(next.gramProjection) &&
      finite(next.gramResidual)
    ) {
      const staticPresentation = next.playProgress === null;
      const firstPhase = staticPresentation
        ? 1
        : THREE.MathUtils.clamp(p * 4, 0, 1);
      updateArrow(
        "result",
        vector(next.u).lerp(vector(next.result), firstPhase).toArray() as Vec3,
        C.result,
        "q₁",
      );
      const projectionPhase = staticPresentation
        ? 1
        : THREE.MathUtils.clamp(p * 4 - 1, 0, 1);
      updateArrow(
        "gramProjection",
        vector(next.gramProjection)
          .multiplyScalar(projectionPhase)
          .toArray() as Vec3,
        "#b49bef",
        "projection onto q₁",
        undefined,
        projectionPhase > 0,
      );
      const subtractionPhase = staticPresentation
        ? 1
        : THREE.MathUtils.clamp(p * 4 - 2, 0, 1);
      const normalizationPhase = staticPresentation
        ? 1
        : THREE.MathUtils.clamp(p * 4 - 3, 0, 1);
      const residual = vector(next.v).lerp(
        vector(next.gramResidual),
        subtractionPhase,
      );
      if (p >= 0.75 || staticPresentation)
        residual.lerp(vector(next.secondary), normalizationPhase);
      updateArrow(
        "secondary",
        residual.toArray() as Vec3,
        C.secondary,
        normalizationPhase > 0 ? "q₂" : "v − projection",
        undefined,
        subtractionPhase > 0,
      );
    }
  };

  const updateClusters = (next: VectorSceneProps) => {
    const points = (next.points || []).filter((point) =>
      finite(point.position),
    );
    if (!clusterCloud || !clusterCore || points.length > clusterCapacity) {
      clearEmbedding();
      clusterCapacity = Math.max(
        512,
        2 ** Math.ceil(Math.log2(Math.max(1, points.length))),
      );
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array(clusterCapacity * 3),
          3,
        ).setUsage(THREE.DynamicDrawUsage),
      );
      geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(
          new Float32Array(clusterCapacity * 3),
          3,
        ).setUsage(THREE.DynamicDrawUsage),
      );
      const material = (size: number, opacity: number) =>
        new THREE.PointsMaterial({
          map: glowTexture,
          size,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        });
      clusterCloud = new THREE.Points(geometry, material(extent * 0.075, 0.38));
      clusterCore = new THREE.Points(geometry, material(extent * 0.026, 0.9));
      embeddingGroup.add(clusterCloud, clusterCore);
      pointMeshes.push(clusterCore);
      embeddingKey = "cluster";
      embeddingGeneration++;
      host.dataset.sceneEmbeddingGeneration = String(embeddingGeneration);
    }
    const positions = clusterCloud.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colors = clusterCloud.geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const ids: string[] = [];
    const color = new THREE.Color();
    points.forEach((point, index) => {
      positions.setXYZ(index, ...point.position);
      color.set(point.color || "#799bff");
      colors.setXYZ(index, color.r, color.g, color.b);
      ids.push(point.id);
    });
    positions.needsUpdate = colors.needsUpdate = true;
    clusterCloud.geometry.setDrawRange(0, points.length);
    clusterCloud.geometry.computeBoundingSphere();
    clusterCore.userData.pointIds = ids;
    (clusterCloud.material as THREE.PointsMaterial).size = extent * 0.075;
    (clusterCore.material as THREE.PointsMaterial).size = extent * 0.026;
    host.dataset.scenePointCount = String(points.length);
    host.dataset.sceneClusterMode = "true";
    const hasQuery =
      finite(next.u) && (next.queryVisible ?? Math.hypot(...next.u) > 0);
    queryMarker.visible = hasQuery;
    queryMarker.position.copy(vector(next.u));
    queryMarker.scale.setScalar(extent * 0.12);
    if (hasQuery) {
      const label = addLabel(
        next.queryLabel || "QUERY",
        vector(next.u),
        "#ffe2a3",
      );
      label.element.dataset.priority = "95";
      dynamicLabels.push(label);
    }
    const selected = points.find((point) => point.id === next.selectedPoint);
    selectionHalo.visible = !!selected;
    if (selected) {
      selectionHalo.position.copy(vector(selected.position));
      selectionHalo.scale.setScalar(extent * 0.12);
      (selectionHalo.material as THREE.SpriteMaterial).color.set(
        selected.color || "#a9c4ff",
      );
    }
    const topIds = new Set(
      points
        .filter((point) => point.score !== undefined)
        .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
        .slice(0, 4)
        .map((point) => point.id),
    );
    points
      .filter((point) => point.id === selected?.id || topIds.has(point.id))
      .forEach((point) => {
        const label = addLabel(
          point.label,
          vector(point.position),
          point.color || "#a9c4ff",
        );
        label.element.classList.toggle("selected", point.id === selected?.id);
        dynamicLabels.push(label);
      });
    (next.clusterLabels || [])
      .filter((cluster) => finite(cluster.position))
      .forEach((cluster) => {
        const label = addLabel(
          cluster.label,
          vector(cluster.position),
          cluster.color,
        );
        label.element.classList.add("scene-cluster-label");
        label.element.dataset.priority = "85";
        dynamicLabels.push(label);
      });
    if (next.showConnections) {
      const byId = new Map(points.map((point) => [point.id, point]));
      const vertices: number[] = [];
      for (const [left, right] of next.clusterLinks || []) {
        const a = byId.get(left),
          b = byId.get(right);
        if (a && b) vertices.push(...a.position, ...b.position);
      }
      if (vertices.length)
        dynamic.add(
          new THREE.LineSegments(
            new THREE.BufferGeometry().setAttribute(
              "position",
              new THREE.Float32BufferAttribute(vertices, 3),
            ),
            new THREE.LineBasicMaterial({
              color: "#6993c4",
              transparent: true,
              opacity: 0.12,
              depthWrite: false,
            }),
          ),
        );
      if (hasQuery)
        points
          .filter((point) => point.score !== undefined)
          .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
          .slice(0, 5)
          .forEach((point) =>
            line(
              [vector(next.u), vector(point.position)],
              point.color || "#91bef4",
              false,
              0.25,
            ),
          );
    }
  };

  const clusterFitDistance = (direction: THREE.Vector3) => {
    const forward = direction.clone().negate();
    const right = new THREE.Vector3()
      .crossVectors(
        forward,
        Math.abs(forward.z) > 0.9999
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1),
      )
      .normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return (
      Math.max(
        1,
        ...fitPositions.map((position) => {
          const p = vector(position).sub(controls.target);
          return (
            p.dot(direction) +
            Math.max(
              Math.abs(p.dot(right)) / (tangent * (width / height) * 0.8),
              Math.abs(p.dot(up)) / (tangent * 0.66),
            )
          );
        }),
      ) * 1.05
    );
  };

  const update = (next: VectorSceneProps) => {
    const nextStaticKey = JSON.stringify({
      ...next,
      playProgress: null,
      resetKey: 0,
    });
    if (nextStaticKey === staticKey) {
      props = next;
      playback(next);
      return;
    }
    staticKey = nextStaticKey;
    staticUpdates++;
    host.dataset.sceneStaticUpdates = String(staticUpdates);
    props = next;
    scene.background = new THREE.Color(
      next.clusterMode ? "#050d1c" : "#101b32",
    );
    queryMarker.visible = selectionHalo.visible = false;
    origin.visible = !next.clusterMode;
    host.dataset.sceneClusterMode = next.clusterMode ? "true" : "false";
    clearDynamic();
    arrows.forEach((entry) => {
      entry.arrow.visible = false;
      entry.dot.visible = false;
      entry.label.element.dataset.visible = "false";
    });
    // Frame world positions that can actually be drawn in the current mode.
    // Other lessons' retained input state must not set the scale of this scene.
    const visiblePositions: Array<Vec3 | undefined> = [];
    if (next.points) {
      if (!next.clusterMode || (next.queryVisible ?? Math.hypot(...next.u) > 0))
        visiblePositions.push(
          next.normalizedPoints && !next.clusterMode
            ? normalizeMath(next.u) || [0, 0, 0]
            : next.u,
        );
      next.points.forEach((point) =>
        visiblePositions.push(
          next.normalizedPoints && !next.clusterMode
            ? normalizeMath(point.position) || [0, 0, 0]
            : point.position,
        ),
      );
    } else if (next.operation === "basis") {
      visiblePositions.push(...(next.basis || []), next.target, next.result);
      const partial = new THREE.Vector3();
      next.scaledBasis?.forEach((component) => {
        partial.add(vector(component));
        visiblePositions.push(partial.toArray() as Vec3);
      });
    } else if (next.operation === "nullspace") {
      visiblePositions.push(next.result, next.secondary);
    } else {
      visiblePositions.push(next.u, next.result);
      if (!["scale", "normalize"].includes(next.operation))
        visiblePositions.push(next.v);
      if (next.operation === "planeProject") visiblePositions.push(next.target);
      if (next.operation === "combination")
        visiblePositions.push(
          vector(next.u)
            .multiplyScalar(next.a ?? 1)
            .toArray() as Vec3,
          vector(next.v)
            .multiplyScalar(next.b ?? 1)
            .toArray() as Vec3,
        );
      if (next.operation === "gramSchmidt")
        visiblePositions.push(
          next.secondary,
          next.gramProjection,
          next.gramResidual,
        );
    }
    const vectors = visiblePositions.filter(finite);
    fitPositions = vectors;
    const boundsKey = JSON.stringify(vectors);
    const boundsChanged = boundsKey !== previousBoundsKey;
    previousBoundsKey = boundsKey;
    const longest = Math.max(1.3, ...vectors.map((v) => vector(v).length()));
    oldExtent = extent;
    extent = Math.max(2.6, longest * 1.3);
    origin.scale.setScalar(extent / 4);
    grid.scale.setScalar(extent / 5);
    referencePlanes.visible = !!next.showReferencePlanes && !next.clusterMode;
    referencePlanes.scale.setScalar(extent);
    host.dataset.sceneReferencePlanes = referencePlanes.visible ? "2" : "0";
    normShells.forEach((shell, index) => {
      const source = index === 0 ? next.u : next.v;
      const radius = Math.hypot(...source);
      shell.visible =
        !!next.showNormShells &&
        !next.clusterMode &&
        radius > 0 &&
        !["basis", "nullspace"].includes(next.operation) &&
        !(index === 1 && ["scale", "normalize"].includes(next.operation));
      shell.scale.setScalar(radius);
      normLabels[index].position.set(radius, 0, 0);
      normLabels[index].element.textContent =
        `‖${index === 0 ? "u" : "v"}‖ = ${Number(radius.toPrecision(4))} · norm shell`;
      normLabels[index].element.dataset.visible = shell.visible
        ? "true"
        : "false";
    });
    host.dataset.sceneNormShells = String(
      normShells.filter((shell) => shell.visible).length,
    );
    host.dataset.sceneNormRadii = JSON.stringify(
      normShells.filter((shell) => shell.visible).map((shell) => shell.scale.x),
    );
    host.dataset.sceneUnitSphereRadius = "1";
    if (extent !== oldExtent || ticks.children.length === 0) {
      axes.forEach(({ axis, line: axisLine, label }) => {
        axisLine.geometry.dispose();
        axisLine.geometry = new THREE.BufferGeometry().setFromPoints([
          axis.clone().multiplyScalar(-extent),
          axis.clone().multiplyScalar(extent),
        ]);
        label.position.copy(axis).multiplyScalar(extent * 1.05);
      });
      disposeObject(ticks);
      fixed.remove(ticks);
      ticks = new THREE.Group();
      fixed.add(ticks);
      const tickStep =
        extent > 10
          ? Math.pow(10, Math.floor(Math.log10(extent / 4)))
          : extent < 3
            ? 0.5
            : 1;
      const markSize = extent * 0.012;
      for (let t = tickStep; t < extent; t += tickStep) {
        for (const sign of [-1, 1])
          for (const a of [0, 1, 2]) {
            const p = [0, 0, 0];
            p[a] = t * sign;
            const from = new THREE.Vector3().fromArray(p);
            const to = from.clone();
            from.setComponent((a + 1) % 3, -markSize);
            to.setComponent((a + 1) % 3, markSize);
            ticks.add(
              new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([from, to]),
                new THREE.LineBasicMaterial({
                  color: "#7c91b0",
                  transparent: true,
                  opacity: 0.35,
                }),
              ),
            );
          }
        if (ticks.children.length > 150) break;
      }
    }
    sphere.visible = guides.visible = next.showSphere && !next.clusterMode;
    grid.visible = next.showGrid && !next.clusterMode;
    ticks.visible = !next.clusterMode;
    axes.forEach(({ line, label }) => {
      line.visible = !next.clusterMode;
      label.element.dataset.visible = next.clusterMode ? "false" : "true";
    });
    const outsideView =
      boundsChanged &&
      vectors.some((position) => {
        const projectedPosition = vector(position).project(camera);
        return (
          projectedPosition.z <= -1 ||
          projectedPosition.z >= 1 ||
          Math.abs(projectedPosition.x) > 0.86 ||
          Math.abs(projectedPosition.y) > 0.86
        );
      });
    const clusterCount = next.clusterMode ? next.points?.length || 0 : 0;
    const newClusterLayout =
      clusterCount > 0 && clusterCount !== framedClusterCount;
    framedClusterCount = clusterCount;
    if (!didFit || outsideView || newClusterLayout) {
      const direction = camera.position
        .clone()
        .sub(controls.target)
        .normalize();
      if (!didFit) direction.set(7, -9, 6).normalize();
      const distance = next.clusterMode
        ? clusterFitDistance(direction)
        : extent * (width < height ? 4.2 : 3.05);
      camera.position
        .copy(controls.target)
        .addScaledVector(direction, distance);
      controls.maxDistance = Math.max(40, extent * 12);
      camera.far = Math.max(200, extent * 25);
      camera.updateProjectionMatrix();
      controls.update();
      didFit = true;
    }

    if (next.clusterMode && next.points) updateClusters(next);
    else if (next.points) {
      const query =
        next.normalizedPoints && vector(next.u).length()
          ? (vector(next.u).normalize().toArray() as Vec3)
          : next.u;
      const hasQuery = vector(query).length() > 0;
      updateArrow("query", query, "#e0be79", "query", undefined, hasQuery);
      const aiPoints = next.points
        .filter((point) => finite(point.position))
        .sort((a, b) => a.id.localeCompare(b.id));
      const manyPoints = aiPoints.length > 50;
      const nextEmbeddingKey = JSON.stringify({
        points: aiPoints.map(({ id, position, color }) => ({
          id,
          position,
          color,
        })),
        normalized: next.normalizedPoints,
      });
      const replaceEmbedding = nextEmbeddingKey !== embeddingKey;
      if (replaceEmbedding) {
        clearEmbedding();
        embeddingKey = nextEmbeddingKey;
        embeddingGeneration++;
        host.dataset.sceneEmbeddingGeneration = String(embeddingGeneration);
      }
      host.dataset.scenePointCount = String(aiPoints.length);
      const activePointId =
        next.selectedPoint ||
        next.points.find((point) => point.score !== undefined)?.id;
      const topIds = new Set(next.points.slice(0, 8).map((point) => point.id));
      const labelIds = new Set(
        next.points.slice(0, 4).map((point) => point.id),
      );
      if (replaceEmbedding && manyPoints)
        embeddingInstances = new THREE.InstancedMesh(
          pointGeometry.clone(),
          new THREE.MeshBasicMaterial({ color: "#ffffff" }),
          aiPoints.length,
        );
      const instances = embeddingInstances;
      const instanceIds: string[] = [];
      const instanceMatrix = new THREE.Matrix4();
      if (instances && replaceEmbedding) {
        instances.userData.instanceIds = instanceIds;
        embeddingGroup.add(instances);
        pointMeshes.push(instances);
      }
      aiPoints.forEach((point, index) => {
        if (!finite(point.position)) return;
        const p = vector(point.position);
        if (next.normalizedPoints && p.length()) p.normalize();
        const color =
          point.color ||
          ["#78b7ff", "#90d9bf", "#c3a0ff", "#f1a1ab"][index % 4];
        const selected = point.id === activePointId;
        const size = (selected ? 1.55 : 1) * Math.max(0.55, extent / 4);
        if (instances) {
          instanceMatrix.compose(
            p,
            new THREE.Quaternion(),
            new THREE.Vector3(size, size, size),
          );
          instances.setMatrixAt(index, instanceMatrix);
          instances.setColorAt(index, new THREE.Color(color));
          if (replaceEmbedding) instanceIds[index] = point.id;
        } else {
          let mesh = embeddingMeshes.get(point.id);
          if (!mesh) {
            mesh = new THREE.Mesh(
              pointGeometry.clone(),
              new THREE.MeshBasicMaterial({ color }),
            );
            embeddingMeshes.set(point.id, mesh);
            embeddingGroup.add(mesh);
            pointMeshes.push(mesh);
          }
          mesh.position.copy(p);
          mesh.scale.setScalar(size);
          mesh.userData = { id: point.id };
        }
        const topNeighbor = topIds.has(point.id);
        if (!manyPoints || selected || labelIds.has(point.id)) {
          const label = addLabel(point.label, p.clone(), color);
          label.element.classList.toggle("selected", selected);
          label.element.dataset.visible = "true";
          label.element.title = `${point.label}: ${fmt(point.position)}${point.score === undefined ? "" : ` · score ${point.score.toFixed(4)}`}`;
          dynamicLabels.push(label);
        }
        if (
          hasQuery &&
          point.score !== undefined &&
          (!manyPoints || selected || topNeighbor)
        )
          line(
            [vector(query), p],
            selected ? color : "#6683ac",
            next.aiMetric !== "euclidean" ||
              !selected ||
              !!next.normalizedPoints,
            selected ? 0.8 : 0.25,
          );
        if (selected) {
          const ring = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 24, 16),
            new THREE.MeshBasicMaterial({
              color,
              wireframe: true,
              transparent: true,
              opacity: 0.3,
            }),
          );
          ring.position.copy(p);
          ring.scale.setScalar(Math.max(0.55, extent / 4));
          dynamic.add(ring);
        }
      });
      if (instances) {
        instances.instanceMatrix.needsUpdate = true;
        if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
        instances.computeBoundingSphere();
      }
      const selectedPoint = next.points.find(
        (point) => point.id === activePointId,
      );
      if (
        hasQuery &&
        next.aiMetric === "cosine" &&
        selectedPoint &&
        selectedPoint.score !== undefined
      )
        angleArc(
          next.u,
          selectedPoint.position,
          next.normalizedPoints
            ? 1
            : Math.min(
                Math.hypot(...next.u),
                Math.hypot(...selectedPoint.position),
                extent * 0.45,
              ),
          "#efcd83",
        );
    } else {
      if (embeddingKey) clearEmbedding();
      const hideV = ["scale", "normalize", "basis", "nullspace"].includes(
        next.operation,
      );
      updateArrow(
        "u",
        next.u,
        C.u,
        "u",
        undefined,
        !["basis", "nullspace"].includes(next.operation),
      );
      updateArrow("v", next.v, C.v, "v", undefined, !hideV);
      const resultName =
        next.operation === "normalize"
          ? "û"
          : ["project", "planeProject"].includes(next.operation)
            ? "projection"
            : next.operation === "cross"
              ? "u × v"
              : next.operation === "basis"
                ? "x"
                : next.operation === "gramSchmidt"
                  ? "q₁"
                  : next.operation === "nullspace"
                    ? "n₁"
                    : "result";
      let animatedResult = next.result;
      if (
        finite(next.result) &&
        next.playProgress !== null &&
        ["scale", "normalize"].includes(next.operation)
      ) {
        animatedResult = vector(next.u)
          .lerp(vector(next.result), next.playProgress)
          .toArray() as Vec3;
      }
      if (next.operation === "planeProject") {
        subspace([next.u, next.v]);
        updateArrow("target", next.target, "#c4a3ff", "x");
        if (finite(next.result) && finite(next.target)) {
          const p = vector(next.result);
          const x = vector(next.target);
          const residual = x.clone().sub(p);
          line([p, x], C.secondary, true).name = "projectionResidual";
          const tangentSource = normalizeMath(next.u) || normalizeMath(next.v);
          if (tangentSource && residual.length() > 1e-10) {
            const a = vector(tangentSource).multiplyScalar(extent * 0.065);
            const b = residual.normalize().multiplyScalar(extent * 0.065);
            line(
              [p.clone().add(a), p.clone().add(a).add(b), p.clone().add(b)],
              C.secondary,
            ).name = "projectionMarker";
          }
        }
      }
      updateArrow(
        "result",
        animatedResult,
        C.result,
        resultName,
        undefined,
        next.playProgress === null ||
          !["add", "combination"].includes(next.operation) ||
          next.playProgress > 0.72,
      );
      if (
        next.secondary &&
        !["project", "planeProject", "combination"].includes(next.operation)
      )
        updateArrow(
          "secondary",
          next.secondary,
          C.secondary,
          next.operation === "gramSchmidt"
            ? "q₂"
            : next.operation === "nullspace"
              ? "n₂"
              : "secondary",
        );
      if (next.operation === "add" || next.operation === "combination") {
        const progress =
          next.playProgress === null
            ? 1
            : Math.min(1, Math.max(0, next.playProgress));
        const start = vector(next.u).multiplyScalar(progress);
        if (next.operation === "add")
          updateArrow("translated", next.v, "#ffb8a6", "v translated", start);
        if (next.operation === "add")
          line(
            [vector(next.u), vector(next.u).add(vector(next.v))],
            C.v,
            true,
            0.3,
          );
        if (next.operation === "combination") {
          const au = vector(next.u).multiplyScalar(next.a ?? 1);
          const bv = vector(next.v).multiplyScalar(next.b ?? 1);
          updateArrow("scaledU", au.toArray() as Vec3, "#a0c8ff", "au");
          updateArrow(
            "scaledV",
            bv.toArray() as Vec3,
            "#ffc1b1",
            "bv",
            au.clone().multiplyScalar(progress),
          );
        }
      }
      if (
        ["span", "independence", "cross"].includes(next.operation) ||
        (next.showSpan &&
          !["basis", "nullspace", "project", "planeProject"].includes(
            next.operation,
          ))
      ) {
        subspace(
          ["scale", "normalize"].includes(next.operation)
            ? [next.u]
            : [next.u, next.v],
        );
      }
      if (next.operation === "nullspace" && next.nullBasis)
        subspace(next.nullBasis, C.result);
      if (next.operation === "project" && finite(next.result)) {
        const p = vector(next.result);
        const end = vector(next.u);
        line([p, end], C.secondary, true).name = "projectionResidual";
        const d = vector(next.v);
        if (d.length()) {
          d.normalize();
          line(
            [
              d.clone().multiplyScalar(-extent),
              d.clone().multiplyScalar(extent),
            ],
            "#79bea9",
            false,
            0.3,
          );
          const residual = end.clone().sub(p);
          if (residual.length() > 1e-8) {
            const a = d.multiplyScalar(extent * 0.07);
            const b = residual.normalize().multiplyScalar(extent * 0.07);
            line(
              [p.clone().add(a), p.clone().add(a).add(b), p.clone().add(b)],
              "#f1ca83",
              false,
              0.7,
            ).name = "projectionMarker";
          }
        }
      }
      if (next.operation === "basis" && next.basis)
        next.basis.forEach((b, i) =>
          updateArrow(
            `basis${i}`,
            b,
            [C.u, C.v, C.secondary][i],
            `b${["₁", "₂", "₃"][i]}`,
          ),
        );
      if (next.operation === "gramSchmidt" && finite(next.gramProjection))
        line(
          [vector(next.gramProjection), vector(next.v)],
          "#b49bef",
          true,
          0.6,
        );
      if (
        next.operation === "normalize" &&
        finite(next.result) &&
        vector(next.u).length() > 0
      )
        line([vector(next.result), vector(next.u)], C.u, true, 0.45);
      if (next.operation === "dot") {
        const a = vector(next.u),
          b = vector(next.v);
        if (a.length() && b.length()) {
          const radius = Math.min(a.length(), b.length(), extent * 0.45);
          a.normalize();
          b.normalize();
          const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
          const tangent = b.clone().addScaledVector(a, -a.dot(b));
          if (tangent.length() < 1e-8)
            tangent.crossVectors(
              a,
              Math.abs(a.z) < 0.9
                ? new THREE.Vector3(0, 0, 1)
                : new THREE.Vector3(0, 1, 0),
            );
          tangent.normalize();
          const arc = Array.from({ length: 49 }, (_, i) =>
            a
              .clone()
              .multiplyScalar(Math.cos((angle * i) / 48) * radius)
              .addScaledVector(tangent, Math.sin((angle * i) / 48) * radius),
          );
          line(arc, C.secondary, false, 0.8);
        }
      }
    }
    playback(next);
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown: [number, number] | undefined;
  let dragged = false;
  const down = (event: PointerEvent) => {
    pointerDown =
      event.button === 0 ? [event.clientX, event.clientY] : undefined;
    dragged = false;
  };
  const pickAt = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    raycaster.params.Line = { threshold: extent * 0.025 };
    raycaster.params.Points = { threshold: extent * 0.025 };
    return raycaster
      .intersectObjects([...pointMeshes, ...arrowGroup.children], true)
      .find((item) => {
        let object: THREE.Object3D | null = item.object;
        while (object && object !== scene) {
          if (!object.visible) return false;
          object = object.parent;
        }
        return true;
      });
  };
  const up = (event: PointerEvent) => {
    if (
      !pointerDown ||
      dragged ||
      Math.hypot(
        event.clientX - pointerDown[0],
        event.clientY - pointerDown[1],
      ) > 6
    )
      return;
    pointerDown = undefined;
    const hit = pickAt(event);
    const id =
      hit?.object.userData.id ||
      (hit?.instanceId === undefined
        ? undefined
        : hit.object.userData.instanceIds?.[hit.instanceId]) ||
      (hit?.index === undefined
        ? undefined
        : hit.object.userData.pointIds?.[hit.index]);
    if (id) onSelection(String(id));
    let object: THREE.Object3D | null = hit?.object || null;
    while (object) {
      if (object.userData.vectorDetail) {
        host.dataset.sceneSelectedVector = (
          object.userData.vectorDetail as VectorSelection
        ).id;
        onVectorSelection(object.userData.vectorDetail as VectorSelection);
        break;
      }
      object = object.parent;
    }
  };
  const move = (event: PointerEvent) => {
    if (event.buttons) {
      if (
        pointerDown &&
        Math.hypot(
          event.clientX - pointerDown[0],
          event.clientY - pointerDown[1],
        ) > 6
      )
        dragged = true;
      tooltip.style.display = "none";
      return;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    const hit = pickAt(event);
    let text: string | undefined;
    if (hit) {
      let object: THREE.Object3D | null = hit.object;
      while (object && !text) {
        text = object.userData.sceneTooltip as string | undefined;
        object = object.parent;
      }
      const id =
        hit.object.userData.id ||
        (hit.instanceId === undefined
          ? undefined
          : hit.object.userData.instanceIds?.[hit.instanceId]) ||
        (hit.index === undefined
          ? undefined
          : hit.object.userData.pointIds?.[hit.index]);
      if (!text && id) {
        const point = props.points?.find((p) => p.id === id);
        if (point)
          text = `${point.label}\n${props.clusterMode ? "Projected " : ""}${fmt(point.position)}${point.score === undefined ? "" : `\n${props.clusterMode ? "Original-space score" : "Similarity / distance"}: ${point.score.toFixed(4)}`}`;
      }
    }
    tooltip.style.display = text ? "" : "none";
    renderer.domElement.style.cursor = text ? "pointer" : "grab";
    if (text) {
      tooltip.textContent = text;
      tooltip.style.transform = `translate(${Math.max(8, Math.min(width - 250, event.clientX - rect.left + 15))}px, ${Math.max(8, Math.min(height - 85, event.clientY - rect.top + 15))}px)`;
    }
  };
  const leave = () => {
    tooltip.style.display = "none";
  };
  renderer.domElement.addEventListener("pointerdown", down);
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointermove", move);
  renderer.domElement.addEventListener("pointerleave", leave);
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const projected = new THREE.Vector3();
  const occupied: { x: number; y: number; w: number; h: number }[] = [];
  let frameWindowStart = performance.now();
  let frameCount = 0;
  const draw = () => {
    controls.update();
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.render(scene, camera);
    occupied.length = 0;
    const insetSize = Math.min(90, width * 0.2);
    occupied.push(
      { x: 0, y: 0, w: width, h: 44 },
      { x: 0, y: height - 78, w: width, h: 78 },
      {
        x: width - insetSize - 18,
        y: height - insetSize - 50,
        w: insetSize + 18,
        h: insetSize + 12,
      },
    );
    const priority = (label: SceneLabel) =>
      label.always
        ? 100
        : label.element.classList.contains("selected")
          ? 90
          : Number(label.element.dataset.priority || 10);
    [...labels]
      .sort((a, b) => priority(b) - priority(a))
      .forEach((label) => {
        const shouldShow =
          (label.always || props?.showLabels) &&
          label.element.dataset.visible !== "false";
        projected.copy(label.position).project(camera);
        const visible =
          shouldShow &&
          projected.z > -1 &&
          projected.z < 1 &&
          Math.abs(projected.x) < 1.1 &&
          Math.abs(projected.y) < 1.1;
        label.element.style.display = visible ? "" : "none";
        if (!visible) return;
        const anchorX = (projected.x * 0.5 + 0.5) * width;
        const anchorY = (-projected.y * 0.5 + 0.5) * height;
        const w = label.element.offsetWidth || 60;
        const h = label.element.offsetHeight || 24;
        const clampX = (x: number) => Math.max(8, Math.min(width - w - 8, x));
        const clampY = (y: number) =>
          Math.max(48, Math.min(height - 82 - h, y));
        const available = (x: number, y: number) =>
          !occupied.some(
            (box) =>
              x < box.x + box.w + 4 &&
              x + w + 4 > box.x &&
              y < box.y + box.h + 4 &&
              y + h + 4 > box.y,
          );
        const offsets = [
          [10, -15],
          [10, -h - 20],
          [10, 14],
          [-w - 10, -15],
          [-w - 10, -h - 20],
          [-w - 10, 14],
          [10, -2 * h - 25],
          [10, h + 25],
          [-w - 10, -2 * h - 25],
          [-w - 10, h + 25],
          [-w / 2, -3 * h - 25],
          [-w / 2, 2 * h + 25],
        ];
        let placement: { x: number; y: number } | undefined;
        for (const [dx, dy] of offsets) {
          const x = clampX(anchorX + dx),
            y = clampY(anchorY + dy);
          if (available(x, y)) {
            placement = { x, y };
            break;
          }
        }
        // Preserve axis and selected-document context by searching farther before
        // suppressing less important labels in a dense projection.
        if (!placement && priority(label) >= 90) {
          const candidates: { x: number; y: number; distance: number }[] = [];
          for (let y = 49; y < height - 82 - h; y += h + 7)
            for (
              let x = 8;
              x <= Math.max(8, width - w - 8);
              x += Math.max(20, w / 2)
            )
              if (available(x, y))
                candidates.push({
                  x,
                  y,
                  distance: Math.hypot(x - anchorX, y - anchorY),
                });
          candidates.sort((a, b) => a.distance - b.distance);
          placement = candidates[0];
        }
        label.element.dataset.layoutHidden = placement ? "false" : "collision";
        if (!placement) {
          label.element.style.display = "none";
          return;
        }
        occupied.push({ x: placement.x, y: placement.y, w, h });
        label.element.style.transform = `translate(${placement.x}px, ${placement.y}px)`;
      });
    gizmoLabels.forEach((label) => {
      label.element.style.display = props?.clusterMode ? "none" : "";
    });
    if (!props?.clusterMode) {
      const size = Math.min(90, width * 0.2);
      const left = width - size - 8;
      const bottom = 42;
      gizmoCamera.position
        .copy(camera.position)
        .sub(controls.target)
        .normalize()
        .multiplyScalar(4.7);
      gizmoCamera.lookAt(0, 0, 0);
      renderer.clearDepth();
      renderer.setViewport(left, bottom, size, size);
      renderer.render(gizmoScene, gizmoCamera);
      gizmoLabels.forEach((label) => {
        projected.copy(label.tip).project(gizmoCamera);
        label.element.style.transform = `translate(${left + (projected.x * 0.5 + 0.5) * size - 4}px, ${height - bottom - size + (-projected.y * 0.5 + 0.5) * size - 5}px)`;
      });
    }
    frameCount++;
    const elapsed = performance.now() - frameWindowStart;
    if (elapsed > 1000) {
      host.dataset.sceneFps = String(Math.round((frameCount * 1000) / elapsed));
      host.dataset.sceneGeometries = String(renderer.info.memory.geometries);
      host.dataset.sceneTextures = String(renderer.info.memory.textures);
      host.dataset.sceneCamera = JSON.stringify({
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        extent,
        width,
        height,
      });
      const targets: Record<string, [number, number]> = {};
      const values: Record<string, Vec3> = {};
      arrows.forEach((entry, id) => {
        if (!entry.dot.visible) return;
        const detail = entry.dot.userData.vectorDetail as
          VectorSelection | undefined;
        if (detail) values[id] = detail.coordinates;
        projected.copy(entry.dot.position).project(camera);
        if (projected.z > -1 && projected.z < 1)
          targets[id] = [
            (projected.x * 0.5 + 0.5) * width,
            (-projected.y * 0.5 + 0.5) * height,
          ];
      });
      host.dataset.sceneVectorTargets = JSON.stringify(targets);
      host.dataset.sceneVectorValues = JSON.stringify(values);
      frameCount = 0;
      frameWindowStart = performance.now();
    }
  };
  renderer.setAnimationLoop(draw);

  return {
    update,
    reset: () => {
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update(); // Clear accumulated orbit/pan deltas before restoring the pose.
      controls.target.set(0, 0, 0);
      camera.position
        .set(7, -9, 6)
        .normalize()
        .multiplyScalar(
          props?.clusterMode
            ? clusterFitDistance(new THREE.Vector3(7, -9, 6).normalize())
            : extent * (width < height ? 4.2 : 3.05),
        );
      camera.up.set(0, 0, 1);
      controls.maxDistance = Math.max(40, extent * 12);
      camera.far = Math.max(200, extent * 25);
      camera.updateProjectionMatrix();
      controls.update();
      controls.enableDamping = damping;
    },
    destroy: () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerleave", leave);
      controls.dispose();
      disposeObject(scene);
      disposeObject(gizmoScene);
      pointGeometry.dispose();
      dotGeometry.dispose();
      glowTexture.dispose();
      labels.forEach((label) => label.element.remove());
      gizmoLabels.forEach((label) => label.element.remove());
      tooltip.remove();
      delete host.dataset.sceneFps;
      delete host.dataset.sceneGeometries;
      delete host.dataset.sceneTextures;
      delete host.dataset.sceneCamera;
      delete host.dataset.scenePointCount;
      delete host.dataset.sceneEmbeddingGeneration;
      delete host.dataset.sceneStaticUpdates;
      delete host.dataset.sceneNormShells;
      delete host.dataset.sceneReferencePlanes;
      delete host.dataset.sceneSelectedVector;
      delete host.dataset.sceneVectorTargets;
      delete host.dataset.sceneVectorValues;
      delete host.dataset.sceneNormRadii;
      delete host.dataset.sceneUnitSphereRadius;
      delete host.dataset.sceneClusterMode;
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export default function VectorScene(props: VectorSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const engine = useRef<SceneEngine | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current || !labelHost.current) return;
    try {
      engine.current = createEngine(
        host.current,
        labelHost.current,
        (id) => latest.current.onSelectPoint?.(id),
        (detail) => latest.current.onSelectVector?.(detail),
      );
      engine.current.update(latest.current);
    } catch (error) {
      console.warn("Vector scene unavailable:", error);
      setFailed(true);
    }
    return () => {
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.update(props);
  }, [
    props.u,
    props.v,
    props.result,
    props.secondary,
    props.operation,
    props.showSphere,
    props.showGrid,
    props.showSpan,
    props.showLabels,
    props.playProgress,
    props.points,
    props.selectedPoint,
    props.normalizedPoints,
    props.nullBasis,
    props.basis,
    props.a,
    props.b,
    props.target,
    props.showNormShells,
    props.showReferencePlanes,
    props.basisCoordinates,
    props.scaledBasis,
    props.gramProjection,
    props.gramResidual,
    props.aiMetric,
    props.clusterMode,
    props.clusterLabels,
    props.clusterLinks,
    props.showConnections,
    props.queryVisible,
    props.queryLabel,
  ]);
  useEffect(() => {
    engine.current?.reset();
  }, [props.resetKey]);
  const displaysSubspace =
    !props.points &&
    (["span", "independence", "cross", "planeProject", "nullspace"].includes(
      props.operation,
    ) ||
      (props.showSpan && !["basis", "project"].includes(props.operation)));
  const displayedRank =
    props.operation === "nullspace"
      ? props.nullBasis?.length || 0
      : ["scale", "normalize"].includes(props.operation)
        ? spanRank(props.u, [0, 0, 0])
        : spanRank(props.u, props.v);
  const subspaceCaption = displaysSubspace
    ? displayedRank === 2
      ? "Plane extends infinitely; the patch shows a finite portion."
      : displayedRank === 1
        ? "Line extends infinitely in both directions."
        : displayedRank === 3
          ? "The solution fills all of unbounded ℝ³."
          : "The zero subspace contains only the origin."
    : "";
  return (
    <div className="vector-scene" aria-label="Vector space visualization">
      <div className="scene-webgl" ref={host} />
      <div className="scene-labels" ref={labelHost} aria-hidden="true" />
      <div className="scene-space-note">
        {props.clusterMode
          ? "UMAP projection · neighborhoods are approximate"
          : props.points &&
              props.normalizedPoints &&
              props.aiMetric === "euclidean"
            ? "Normalized display · distance uses original vectors"
            : props.showSphere
              ? "Unit sphere · radius 1"
              : "Cartesian coordinates · Z up"}
      </div>
      <div className="scene-subspace-note">
        {subspaceCaption}
        {props.showSphere && !props.clusterMode && (
          <span>Sphere curves are orientation guides, not coordinates.</span>
        )}
      </div>
      {failed && (
        <div className="scene-fallback">
          <strong>3D preview is unavailable</strong>
          <p>
            Your browser could not start WebGL. All calculations and worked
            steps remain available below.
          </p>
        </div>
      )}
    </div>
  );
}
