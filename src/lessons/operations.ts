import {
  add,
  cross,
  dot,
  finiteVector,
  norm,
  normalize,
  nullspace,
  orthonormalSpan,
  project,
  projectOntoSpan,
  scale,
  solveBasis,
  spanRank,
  sub,
  type Vec3,
} from "../math/vector";

export type Operation =
  | "add"
  | "scale"
  | "combination"
  | "normalize"
  | "span"
  | "independence"
  | "project"
  | "planeProject"
  | "basis"
  | "dot"
  | "cross"
  | "gramSchmidt"
  | "nullspace";
export type MathInputs = {
  u: Vec3;
  v: Vec3;
  a: number;
  b: number;
  basis: [Vec3, Vec3, Vec3];
  target: Vec3;
  matrix: number[][];
};
export type LessonResult = {
  title: string;
  equation: string;
  value: string;
  steps: string[];
  concept: string;
  warning?: string;
  result?: Vec3;
  secondary?: Vec3;
  rank?: number;
  nullBasis?: Vec3[];
  domainExample?: string;
  basisCoordinates?: Vec3;
  scaledBasis?: [Vec3, Vec3, Vec3];
  gramProjection?: Vec3;
  gramResidual?: Vec3;
};

export const operationLabels: Record<Operation, string> = {
  add: "Vector addition",
  scale: "Scalar multiplication",
  combination: "Linear combination",
  normalize: "Norm & normalization",
  span: "Span",
  independence: "Linear independence",
  project: "Orthogonal projection",
  planeProject: "Projection onto a plane",
  basis: "Basis coordinates",
  dot: "Dot product & angle",
  cross: "Cross product",
  gramSchmidt: "Gram–Schmidt",
  nullspace: "Homogeneous systems",
};

export const domainExamples: Record<Operation, string> = {
  add: "Navigation: combine a walking displacement and a moving walkway's displacement to find the total change in position.",
  scale:
    "Physics: doubling a force vector doubles its magnitude; multiplying by −1 reverses its direction.",
  combination:
    "Robotics: two independent actuator directions combine with adjustable weights to create a desired displacement.",
  normalize:
    "Computer graphics: normalize a lighting direction so its length does not accidentally change the brightness calculation.",
  span: "Robotics: a robot constrained to two independent motion directions can reach a plane of displacements, but cannot leave it.",
  independence:
    "Sensor design: a new measurement direction adds information only when it is independent of the existing directions.",
  project:
    "Physics: project a force onto a track to find the component that acts along the track.",
  planeProject:
    "Surveying: project a measured 3D position onto a reference plane; the residual is its perpendicular offset from that plane.",
  basis:
    "Coordinate frames: express the same 3D displacement using a robot's local axes instead of the world axes.",
  dot: "Search: the dot product of normalized document vectors measures directional alignment, which is cosine similarity.",
  cross:
    "Mechanics: torque is the cross product of the lever-arm vector and applied force, perpendicular to their plane.",
  gramSchmidt:
    "Computer graphics: construct perpendicular unit directions from independent inputs to form a stable camera coordinate frame.",
  nullspace:
    "Engineering: nullspace vectors describe changes to an unknown state that leave every linear measurement unchanged.",
};
export const defaultInputs: MathInputs = {
  u: [1, 2, 1],
  v: [2, -1, 1],
  a: 2,
  b: 1,
  basis: [
    [1, 0, 0],
    [1, 1, 0],
    [0, 0, 1],
  ],
  target: [3, 2, 4],
  matrix: [
    [1, -1, 0],
    [1, 0, -1],
  ],
};

export const formatNumber = (x: number): string => {
  if (!Number.isFinite(x)) return "undefined";
  if (x === 0 || Object.is(x, -0)) return "0";
  if (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-4)
    return x.toExponential(3).replace(/\.0+(?=e)/, "");
  return Number(x.toFixed(4)).toString();
};
export const formatVector = (v: Vec3): string =>
  `(${v.map(formatNumber).join(", ")})`;

export function calculateLesson(
  operation: Operation,
  inputs: MathInputs,
): LessonResult {
  const { u, v, a, b, basis, target, matrix } = inputs;
  const base = {
    title: operationLabels[operation],
    domainExample: domainExamples[operation],
  };
  const invalid = (warning: string): LessonResult => ({
    ...base,
    equation: "Check your inputs",
    value: "Undefined",
    steps: [warning],
    concept:
      "A mathematical operation needs valid inputs before it can be visualized.",
    warning,
  });
  const f = formatVector;
  const n = formatNumber;
  const vectorResult = (
    result: Vec3,
    equation: string,
    steps: string[],
    concept: string,
  ): LessonResult => {
    if (!finiteVector(result))
      return invalid(
        "The result exceeds the supported numeric range. Use smaller coordinates.",
      );
    return { ...base, equation, result, value: f(result), steps, concept };
  };

  if (operation === "nullspace") {
    const solution = nullspace(matrix);
    if (!solution)
      return invalid("Enter a finite matrix with exactly three columns.");
    const nullity = 3 - solution.rank;
    const shape = [
      "the origin",
      "a line through the origin",
      "a plane through the origin",
      "all of R³",
    ][nullity];
    const terms = solution.basis.map(
      (vec, i) => `${["s", "t", "r"][i]}${f(vec)}`,
    );
    return {
      ...base,
      equation: "Ax = 0",
      value: terms.length ? `x = ${terms.join(" + ")}` : "x = (0, 0, 0)",
      rank: solution.rank,
      nullBasis: solution.basis,
      ...(solution.basis[0] ? { result: solution.basis[0] } : {}),
      ...(solution.basis[1] ? { secondary: solution.basis[1] } : {}),
      steps: [
        `Row-reduce the ${matrix.length} × 3 coefficient matrix.`,
        `Identify ${solution.rank} pivot column${solution.rank === 1 ? "" : "s"}: rank(A) = ${solution.rank}.`,
        `Rank–nullity gives dim ker(A) = 3 − ${solution.rank} = ${nullity}.`,
        terms.length
          ? `Choose one vector for each free variable: ${solution.basis.map(f).join("; ")}.`
          : "No free variables remain, so the zero vector is the only solution.",
        `The solution set is ${shape}.`,
      ],
      concept:
        "Homogeneous solution sets are vector subspaces: they contain zero and are closed under addition and scaling. In contrast, x − y = 1 excludes the origin and defines an affine set, not a vector subspace.",
    };
  }
  if (operation === "basis") {
    if (!basis.every(finiteVector) || !finiteVector(target))
      return invalid(
        "Enter finite coordinates for all basis vectors and the target.",
      );
    const coordinates = solveBasis(basis, target);
    if (!coordinates)
      return invalid(
        "These vectors do not form a numerically independent basis. Choose three independent vectors.",
      );
    const scaledBasis = basis.map((vector, index) =>
      scale(vector, coordinates[index]),
    ) as [Vec3, Vec3, Vec3];
    const reconstruction = add(
      add(scaledBasis[0], scaledBasis[1]),
      scaledBasis[2],
    );
    const unitBasis = basis.map(normalize) as [Vec3, Vec3, Vec3];
    const volume = Math.abs(
      dot(unitBasis[0], cross(unitBasis[1], unitBasis[2])),
    );
    return {
      ...base,
      equation: "Bc = x",
      value: `c = ${f(coordinates)}`,
      result: reconstruction,
      basisCoordinates: coordinates,
      scaledBasis,
      steps: [
        `Place the basis vectors in the columns of B: ${basis.map(f).join(", ")}.`,
        `Solve Bc = ${f(target)} for the three coefficients.`,
        `The coordinates in this basis are c = ${f(coordinates)}.`,
        `Scale each basis direction: ${n(coordinates[0])}b₁ = ${f(scaledBasis[0])}, ${n(coordinates[1])}b₂ = ${f(scaledBasis[1])}, ${n(coordinates[2])}b₃ = ${f(scaledBasis[2])}.`,
        `Add head to tail: ${f(scaledBasis[0])} + ${f(scaledBasis[1])} + ${f(scaledBasis[2])} = ${f(reconstruction)}.`,
      ],
      concept:
        "Coordinates depend on the chosen basis. The geometric vector stays the same while its coefficients change.",
      ...(volume < 1e-5
        ? {
            warning:
              "This basis is nearly dependent. Small input changes can produce large coordinate changes.",
          }
        : {}),
    };
  }
  if (
    !finiteVector(u) ||
    !finiteVector(v) ||
    !Number.isFinite(a) ||
    !Number.isFinite(b)
  )
    return invalid("Enter finite numbers for vector coordinates and scalars.");

  if (operation === "add") {
    const result = add(u, v);
    return vectorResult(
      result,
      "u + v",
      [
        `Start at the origin and draw u = ${f(u)}.`,
        `Translate a copy of v = ${f(v)} so its tail meets the tip of u.`,
        `Add matching coordinates: (${n(u[0])} + ${n(v[0])}, ${n(u[1])} + ${n(v[1])}, ${n(u[2])} + ${n(v[2])}).`,
        `Draw the sum from the origin to ${f(result)}.`,
      ],
      "Closure under addition: adding two vectors in R³ gives another vector in R³.",
    );
  }
  if (operation === "scale") {
    const result = scale(u, a);
    return vectorResult(
      result,
      `${n(a)}u`,
      [
        `Start with u = ${f(u)}.`,
        `Multiply each coordinate by ${n(a)}.`,
        `${n(a)}u = ${f(result)}.`,
        a < 0
          ? "A negative scalar reverses direction; its absolute value scales the length."
          : a === 0
            ? "Multiplying by zero collapses the vector to the origin."
            : "The direction stays the same and the length scales by the scalar.",
      ],
      "Scalar multiplication changes length and can reverse direction, while staying in the same vector space.",
    );
  }
  if (operation === "combination") {
    const au = scale(u, a),
      bv = scale(v, b),
      result = add(au, bv);
    return {
      ...vectorResult(
        result,
        `${n(a)}u + ${n(b)}v`,
        [
          `Scale u: ${n(a)}u = ${f(au)}.`,
          `Scale v: ${n(b)}v = ${f(bv)}.`,
          "Place the scaled vectors head to tail.",
          `Add their coordinates to get ${f(result)}.`,
        ],
        "Every choice of coefficients gives a vector in span{u, v}.",
      ),
      secondary: au,
    };
  }
  if (operation === "normalize") {
    const length = norm(u),
      q = normalize(u);
    if (!q)
      return {
        ...invalid(
          "The zero vector has no direction, so it cannot be normalized. Its spherical angles are also undefined.",
        ),
        equation: "‖u‖ = 0",
        value: "Norm = 0",
        result: [0, 0, 0],
      };
    const sphericalR = norm(u);
    const azimuth = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    const inclination =
      (Math.acos(Math.max(-1, Math.min(1, q[2]))) * 180) / Math.PI;
    return {
      ...vectorResult(
        q,
        "û = u / ‖u‖",
        [
          `Compute the length: ‖u‖ = √(${u.map((x) => `(${n(x)})²`).join(" + ")}) = ${n(length)}.`,
          `Divide each coordinate by the length: û = ${f(q)}.`,
          "The normalized vector has length 1 and meets the unit sphere.",
          `Alternate spherical coordinates: radius ${n(sphericalR)}, azimuth ${n(azimuth)}°, inclination ${n(inclination)}°.`,
        ],
        "The unit sphere describes directions. It does not contain all of R³ and is not itself a vector subspace.",
      ),
      value: `‖u‖ = ${n(length)} · û = ${f(q)}`,
    };
  }
  if (operation === "span" || operation === "independence") {
    const rank = spanRank(u, v);
    const uq = normalize(u),
      vq = normalize(v);
    const separation = uq && vq ? norm(cross(uq, vq)) : 0;
    const nearlyDependent = rank === 1 && separation > 0;
    const shape =
      rank === 2
        ? "Plane through origin"
        : rank === 1
          ? "Line through origin"
          : "Only the origin";
    return {
      ...base,
      equation: operation === "span" ? "span{u, v} = {au + bv}" : "au + bv = 0",
      value: `${shape} · rank ${rank}`,
      rank,
      steps: [
        `Inspect u = ${f(u)} and v = ${f(v)}.`,
        rank === 2
          ? "Neither generator is a scalar multiple of the other."
          : nearlyDependent
            ? "The directions are indistinguishable at the numerical rank tolerance."
            : rank === 1
              ? "Every nonzero generator points along the same line."
              : "Both generators are zero.",
        `There ${rank === 1 ? "is 1 independent direction" : `are ${rank} independent directions`} at the working tolerance.`,
        rank === 2
          ? "The two vectors are linearly independent. Their span is an infinite plane."
          : nearlyDependent
            ? "The numerical model treats this pair as dependent and shows a line."
            : "The pair is linearly dependent. The span has fewer than two dimensions.",
      ],
      concept:
        "A span includes all real linear combinations, including negative coefficients. The visible patch is only a finite view of an unbounded subspace.",
      ...(nearlyDependent
        ? {
            warning:
              "These inputs are nearly dependent. Direction differences below 1e−10 are treated as numerical rank 1; their exact mathematical span may still be a plane.",
          }
        : {}),
    };
  }
  if (operation === "project") {
    const p = project(u, v);
    if (!p)
      return invalid(
        "Projection onto the zero vector is undefined. Choose a nonzero target direction.",
      );
    const residual = sub(u, p),
      q = normalize(v)!;
    return {
      ...vectorResult(
        p,
        "projᵥ(u) = ((u · v) / (v · v))v",
        [
          `Use the target direction v = ${f(v)}.`,
          `Normalize it to q = ${f(q)}.`,
          `Compute p = (u · q)q = ${f(p)}.`,
          `The residual u − p = ${f(residual)} is perpendicular to v.`,
        ],
        "Orthogonal projection gives the closest point on the target line. Its residual is perpendicular to that line.",
      ),
      secondary: residual,
    };
  }
  if (operation === "planeProject") {
    if (!finiteVector(target))
      return invalid("Enter finite coordinates for the target x.");
    const p = projectOntoSpan(target, u, v);
    if (!p)
      return invalid(
        "The projected result exceeds the supported numeric range. Use smaller coordinates.",
      );
    const residual = sub(target, p);
    const q = orthonormalSpan(u, v);
    const rank = q.length;
    const shape = rank === 2 ? "plane" : rank === 1 ? "line" : "origin";
    return {
      ...vectorResult(
        p,
        "proj_span{u,v}(x) = QQᵀx",
        [
          `The generators span a ${shape}; the numerical dimension is ${rank}.`,
          rank
            ? `Build orthonormal directions Q: ${q.map(f).join("; ")}.`
            : "Both generators are zero, so their span is {0}.",
          rank
            ? `Keep the component of x = ${f(target)} along each direction, then add: p = ${f(p)}.`
            : "The closest point in {0} is the origin: p = (0, 0, 0).",
          `Subtract to get the residual x − p = ${f(residual)}.`,
          rank === 2
            ? "The residual is normal to the plane; p is its closest point to x."
            : rank === 1
              ? "The residual is perpendicular to the remaining line; p is its closest point to x."
              : "The whole target vector is the residual because the subspace contains only zero.",
        ],
        "Orthogonal projection onto a subspace minimizes Euclidean distance. A plane needs two independent generators; dependent inputs correctly reduce to a line or the origin.",
      ),
      secondary: residual,
      rank,
      ...(rank < 2
        ? {
            warning: `The generators do not define a plane. Projection is onto their actual span: the ${shape}.`,
          }
        : {}),
    };
  }
  if (operation === "dot") {
    const product = dot(u, v),
      uq = normalize(u),
      vq = normalize(v);
    if (!Number.isFinite(product))
      return invalid(
        "The dot product exceeds the supported numeric range. Use smaller coordinates.",
      );
    if (!uq || !vq)
      return {
        ...base,
        equation: "u · v",
        value: `${n(product)} · angle undefined`,
        steps: [
          `The coordinate products sum to ${n(product)}.`,
          "An angle requires two nonzero directions.",
        ],
        concept:
          "A zero vector has no direction, so its angle with another vector is undefined.",
        warning: "Choose two nonzero vectors to calculate their angle.",
      };
    const cosine = Math.max(-1, Math.min(1, dot(uq, vq))),
      angle = (Math.acos(cosine) * 180) / Math.PI;
    return {
      ...base,
      equation: "u · v = ‖u‖ ‖v‖ cos θ",
      value: `u · v = ${n(product)} · θ = ${n(angle)}°`,
      steps: [
        `Multiply corresponding coordinates and add: u · v = ${n(product)}.`,
        `Normalize the directions to compute cos θ = ${n(cosine)}.`,
        `Take arccos: θ = ${n(angle)}°.`,
      ],
      concept:
        "The dot product measures alignment. For nonzero vectors, a dot product of zero means perpendicular directions.",
    };
  }
  if (operation === "cross") {
    const result = cross(u, v);
    return vectorResult(
      result,
      "u × v",
      [
        `Compute the signed coordinate minors of u and v.`,
        `u × v = ${f(result)}.`,
        norm(result) === 0
          ? "Parallel or zero inputs have zero cross product."
          : "The result is perpendicular to both inputs, with direction given by the right-hand rule.",
      ],
      "The cross-product magnitude is the parallelogram area spanned by u and v.",
    );
  }
  const q1 = normalize(u);
  if (!q1) return invalid("Gram–Schmidt needs a nonzero first vector.");
  if (spanRank(u, v) < 2)
    return {
      ...invalid(
        "The input vectors are dependent, so there is no second independent direction to normalize.",
      ),
      result: q1,
      rank: 1,
    };
  // The double cross product gives the same residual direction as subtracting
  // the projection, with better orthogonality for nearly parallel inputs.
  const vDirection = normalize(v)!;
  const residual = cross(cross(q1, vDirection), q1);
  const q2 = normalize(residual);
  if (!q2)
    return invalid(
      "The vectors are too nearly dependent to resolve a second direction.",
    );
  const gramProjection = project(v, u);
  if (!gramProjection)
    return invalid(
      "The projection exceeds the supported numeric range. Use smaller coordinates.",
    );
  const gramResidual = sub(v, gramProjection);
  return {
    ...base,
    equation: "q₁ = u / ‖u‖, q₂ = (v − projᵤv) / ‖v − projᵤv‖",
    value: `q₁ = ${f(q1)} · q₂ = ${f(q2)}`,
    result: q1,
    secondary: q2,
    gramProjection,
    gramResidual,
    rank: 2,
    steps: [
      `Normalize the first vector: q₁ = ${f(q1)}.`,
      `Project v onto q₁: (v · q₁)q₁ = ${f(gramProjection)}.`,
      `Subtract that projection from v: w = ${f(gramResidual)}.`,
      `Normalize that residual to get q₂ = ${f(q2)}.`,
      `Both lengths are 1, and q₁ · q₂ ≈ ${n(dot(q1, q2))}.`,
    ],
    concept:
      "Gram–Schmidt changes the generators into perpendicular unit vectors without changing their span.",
  };
}
