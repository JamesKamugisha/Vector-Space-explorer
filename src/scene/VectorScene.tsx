import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { normalize as normalizeMath, RELATIVE_TOLERANCE } from "../math/vector";
import "./scene.css";

type Vec3 = [number, number, number];
export type ScenePoint = {
  id: string;
  label: string;
  position: Vec3;
  color?: string;
  score?: number;
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
  scene.add(fixed, dynamic, arrowGroup);
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
  const pointMeshes: THREE.Mesh[] = [];
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
  const pointGeometry = new THREE.SphereGeometry(0.09, 20, 12);
  const dotGeometry = new THREE.SphereGeometry(0.048, 16, 10);
  let ticks = new THREE.Group();
  fixed.add(ticks);

  const clearDynamic = () => {
    dynamic.children.forEach(disposeObject);
    dynamic.clear();
    pointMeshes.length = 0;
    dynamicLabels.forEach((label) => {
      label.element.remove();
      const index = labels.indexOf(label);
      if (index >= 0) labels.splice(index, 1);
    });
    dynamicLabels = [];
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

  const update = (next: VectorSceneProps) => {
    props = next;
    clearDynamic();
    arrows.forEach((entry) => {
      entry.arrow.visible = false;
      entry.dot.visible = false;
      entry.label.element.dataset.visible = "false";
    });
    const vectors = [
      next.u,
      next.v,
      next.result,
      next.secondary,
      ...(next.basis || []),
      ...(next.points?.map((p) =>
        next.normalizedPoints
          ? (vector(p.position).normalize().toArray() as Vec3)
          : p.position,
      ) || []),
    ].filter(finite);
    const longest = Math.max(1.3, ...vectors.map((v) => vector(v).length()));
    oldExtent = extent;
    extent = Math.max(2.6, longest * 1.3);
    origin.scale.setScalar(extent / 4);
    grid.scale.setScalar(extent / 5);
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
    sphere.visible = guides.visible = next.showSphere;
    grid.visible = next.showGrid;
    if (!didFit || extent > oldExtent * 1.35) {
      const direction = camera.position
        .clone()
        .sub(controls.target)
        .normalize();
      if (!didFit) direction.set(7, -9, 6).normalize();
      const distance = extent * (width < height ? 4.2 : 3.05);
      camera.position
        .copy(controls.target)
        .addScaledVector(direction, distance);
      controls.maxDistance = Math.max(40, extent * 12);
      camera.far = Math.max(200, extent * 25);
      camera.updateProjectionMatrix();
      controls.update();
      didFit = true;
    }

    if (next.points) {
      const query =
        next.normalizedPoints && vector(next.u).length()
          ? (vector(next.u).normalize().toArray() as Vec3)
          : next.u;
      const hasQuery = vector(query).length() > 0;
      updateArrow("query", query, "#e0be79", "query", undefined, hasQuery);
      const aiPoints = next.points.filter((point) => finite(point.position));
      const manyPoints = aiPoints.length > 50;
      const instances = manyPoints
        ? new THREE.InstancedMesh(
            pointGeometry.clone(),
            new THREE.MeshBasicMaterial({ color: "#ffffff" }),
            aiPoints.length,
          )
        : null;
      const instanceIds: string[] = [];
      const instanceMatrix = new THREE.Matrix4();
      if (instances) {
        instances.userData.instanceIds = instanceIds;
        dynamic.add(instances);
        pointMeshes.push(instances);
      }
      aiPoints.forEach((point, index) => {
        if (!finite(point.position)) return;
        const p = vector(point.position);
        if (next.normalizedPoints && p.length()) p.normalize();
        const color =
          point.color ||
          ["#78b7ff", "#90d9bf", "#c3a0ff", "#f1a1ab"][index % 4];
        const selected = point.id === next.selectedPoint;
        const size = (selected ? 1.55 : 1) * Math.max(0.55, extent / 4);
        if (instances) {
          instanceMatrix.compose(
            p,
            new THREE.Quaternion(),
            new THREE.Vector3(size, size, size),
          );
          instances.setMatrixAt(index, instanceMatrix);
          instances.setColorAt(index, new THREE.Color(color));
          instanceIds[index] = point.id;
        } else {
          const mesh = new THREE.Mesh(
            pointGeometry.clone(),
            new THREE.MeshBasicMaterial({ color }),
          );
          mesh.position.copy(p);
          mesh.scale.setScalar(size);
          mesh.userData = { id: point.id };
          dynamic.add(mesh);
          pointMeshes.push(mesh);
        }
        if (!manyPoints || selected || index < 8) {
          const label = addLabel(point.label, p.clone(), color);
          label.element.classList.toggle("selected", selected);
          label.element.dataset.visible = "true";
          label.element.title = `${point.label}: ${fmt(point.position)}${point.score === undefined ? "" : ` · score ${point.score.toFixed(4)}`}`;
          dynamicLabels.push(label);
        }
        if (
          hasQuery &&
          point.score !== undefined &&
          (!manyPoints || selected || index < 8)
        )
          line(
            [vector(query), p],
            selected ? color : "#6683ac",
            true,
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
    } else {
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
          : next.operation === "project"
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
        !["project", "combination"].includes(next.operation)
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
          !["basis", "nullspace", "project"].includes(next.operation))
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
        line([p, end], C.secondary, true);
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
            );
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
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown: [number, number] | undefined;
  const down = (event: PointerEvent) => {
    pointerDown = [event.clientX, event.clientY];
  };
  const up = (event: PointerEvent) => {
    if (
      !pointerDown ||
      Math.hypot(
        event.clientX - pointerDown[0],
        event.clientY - pointerDown[1],
      ) > 6
    )
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pointMeshes)[0];
    const id =
      hit?.object.userData.id ||
      (hit?.instanceId === undefined
        ? undefined
        : hit.object.userData.instanceIds?.[hit.instanceId]);
    if (id) onSelection(String(id));
  };
  const move = (event: PointerEvent) => {
    if (event.buttons) {
      tooltip.style.display = "none";
      return;
    }
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    raycaster.params.Line = { threshold: extent * 0.025 };
    const hits = raycaster.intersectObjects(
      [...pointMeshes, ...arrowGroup.children],
      true,
    );
    const hit = hits.find((item) => {
      let object: THREE.Object3D | null = item.object;
      while (object && object !== scene) {
        if (!object.visible) return false;
        object = object.parent;
      }
      return true;
    });
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
          : hit.object.userData.instanceIds?.[hit.instanceId]);
      if (!text && id) {
        const point = props.points?.find((p) => p.id === id);
        if (point)
          text = `${point.label}\n${fmt(point.position)}${point.score === undefined ? "" : `\nSimilarity / distance: ${point.score.toFixed(4)}`}`;
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
    labels.forEach((label) => {
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
      const x = (projected.x * 0.5 + 0.5) * width + 10;
      let y = (-projected.y * 0.5 + 0.5) * height - 15;
      const w = label.element.offsetWidth || 60;
      for (let attempts = 0; attempts < 5; attempts++) {
        if (
          !occupied.some(
            (box) =>
              x < box.x + box.w &&
              x + w > box.x &&
              y < box.y + box.h &&
              y + 24 > box.y,
          )
        )
          break;
        y -= 27;
      }
      occupied.push({ x, y, w, h: 24 });
      label.element.style.transform = `translate(${Math.min(width - w - 8, Math.max(4, x))}px, ${Math.max(8, y)}px)`;
    });
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
        .multiplyScalar(extent * (width < height ? 4.2 : 3.05));
      camera.up.set(0, 0, 1);
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
      labels.forEach((label) => label.element.remove());
      gizmoLabels.forEach((label) => label.element.remove());
      tooltip.remove();
      delete host.dataset.sceneFps;
      delete host.dataset.sceneGeometries;
      delete host.dataset.sceneTextures;
      delete host.dataset.sceneCamera;
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
      engine.current = createEngine(host.current, labelHost.current, (id) =>
        latest.current.onSelectPoint?.(id),
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
  ]);
  useEffect(() => {
    engine.current?.reset();
  }, [props.resetKey]);
  return (
    <div className="vector-scene" aria-label="Vector space visualization">
      <div className="scene-webgl" ref={host} />
      <div className="scene-labels" ref={labelHost} aria-hidden="true" />
      <div className="scene-space-note">
        {props.showSphere
          ? "Unit sphere · radius 1"
          : "Cartesian coordinates · Z up"}
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
