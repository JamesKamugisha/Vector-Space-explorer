export type AiMetric = "cosine" | "euclidean";
export type TeachingVector = [number, number, number];
export type AiDocument = {
  id: string;
  title: string;
  text: string;
  vector: TeachingVector;
  category: string;
};

/** These are handcrafted pedagogical coordinates, not model embeddings. */
export const corpus: AiDocument[] = [
  {
    id: "password",
    title: "Reset your password",
    category: "Account access",
    vector: [4, 0, 0],
    text: "To reset your password, open the sign-in page and select Forgot password. Enter your work email and follow the reset link. The link expires after 30 minutes.",
  },
  {
    id: "signin",
    title: "Trouble signing in",
    category: "Account access",
    vector: [2, 0.35, 0.05],
    text: "If you cannot sign in, check your email address, password, and keyboard layout. If your account is locked, wait 15 minutes before trying again or contact the help desk.",
  },
  {
    id: "mfa",
    title: "Set up two-factor authentication",
    category: "Account access",
    vector: [3, 0.15, 0],
    text: "Open Account settings, choose Security, and add an authenticator app. Save your recovery codes somewhere safe. Contact the help desk if you lose your authentication device.",
  },
  {
    id: "access",
    title: "Request workspace access",
    category: "Access and workplace",
    vector: [1.5, 1.4, 0.05],
    text: "To request access to a team workspace, send the workspace name and your role to your manager. The workspace owner reviews access requests on working days.",
  },
  {
    id: "vacation",
    title: "Vacation and annual leave",
    category: "Workplace policy",
    vector: [0, 4, 0],
    text: "Submit vacation requests in the leave portal at least two weeks before your planned absence. Your manager approves requests based on team coverage. Check your personal leave balance in the portal.",
  },
  {
    id: "remote",
    title: "Working remotely",
    category: "Workplace policy",
    vector: [0.3, 2, 0.1],
    text: "Agree on remote working days with your manager and update your team calendar. Use the company VPN for internal resources and keep your contact details current.",
  },
  {
    id: "cafeteria",
    title: "Today at the cafeteria",
    category: "Food and dining",
    vector: [0, 0.1, 4],
    text: "The cafeteria serves lunch from 11:30 a.m. to 2 p.m. The example menu includes tomato soup, a grain bowl, and grilled chicken. Vegetarian options are available every day.",
  },
  {
    id: "allergy",
    title: "Dietary needs and allergens",
    category: "Food and dining",
    vector: [0, 0.4, 2],
    text: "Food labels list common allergens. Ask cafeteria staff about ingredients and preparation before ordering. Contact the dining team to discuss dietary requirements.",
  },
];

export const MIN_POINT_COUNT = 8;
export const MAX_POINT_COUNT = 500;

export function clampPointCount(count: number): number {
  return Number.isFinite(count)
    ? Math.min(MAX_POINT_COUNT, Math.max(MIN_POINT_COUNT, Math.floor(count)))
    : MIN_POINT_COUNT;
}

/** Repeatable synthetic examples expand the teaching cloud, never a real corpus. */
export function buildCorpus(count: number): AiDocument[] {
  const size = clampPointCount(count);
  const documents = corpus.map((document) => ({
    ...document,
    vector: [...document.vector] as TeachingVector,
  }));
  const fraction = (value: number) => value - Math.floor(value);
  for (let index = corpus.length; index < size; index++) {
    const original = corpus[(index - corpus.length) % corpus.length];
    const serial = String(index + 1).padStart(3, "0");
    const magnitude = 0.55 + 1.1 * fraction((index + 1) * 0.61803398875);
    const vector = original.vector.map((coordinate, axis) =>
      Number(
        (
          coordinate * magnitude +
          0.7 * fraction((index + 1) * (axis + 1) * 0.41421356237)
        ).toFixed(5),
      ),
    ) as TeachingVector;
    documents.push({
      id: `synthetic-${serial}`,
      title: `${original.title} · ${serial}`,
      text: `Synthetic teaching example ${serial}: ${original.text}`,
      vector,
      category: `${original.category} · synthetic`,
    });
  }
  return documents;
}

export const featureNames = [
  "Account access",
  "Workplace policy",
  "Food and dining",
] as const;
export const featureColors = ["#5a8dee", "#2bb7a5", "#ed9974"] as const;

/** Whole-token rules are public so the teaching model can be inspected. */
export const featureTerms: readonly (readonly string[])[] = [
  [
    "account",
    "access",
    "password",
    "reset",
    "login",
    "signin",
    "sign",
    "locked",
    "authentication",
    "authenticator",
    "mfa",
    "security",
    "vpn",
  ],
  [
    "vacation",
    "leave",
    "holiday",
    "annual",
    "policy",
    "workplace",
    "remote",
    "working",
    "manager",
    "calendar",
    "absence",
    "coverage",
    "portal",
  ],
  [
    "cafeteria",
    "food",
    "menu",
    "lunch",
    "dining",
    "dietary",
    "allergy",
    "allergens",
    "vegetarian",
    "soup",
    "ingredients",
    "meal",
    "eat",
  ],
];

export function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/sign[\s-]+in/g, "signin")
      .match(/[a-z]+/g) ?? []
  );
}

/** Each matched token adds one to its feature; unmatched tokens add nothing. */
export function encodeQuery(text: string): TeachingVector {
  const tokens = tokenize(text);
  return featureTerms.map((terms) =>
    tokens.reduce((count, token) => count + Number(terms.includes(token)), 0),
  ) as TeachingVector;
}

const finite = (v: TeachingVector) => v.every(Number.isFinite);
const length = (v: TeachingVector) => Math.hypot(...v);

export function cosineSimilarity(
  a: TeachingVector,
  b: TeachingVector,
): number | null {
  if (!finite(a) || !finite(b)) return null;
  const la = length(a);
  const lb = length(b);
  if (la === 0 || lb === 0) return null;
  const score = a.reduce(
    (sum, value, i) => sum + (value / la) * (b[i] / lb),
    0,
  );
  return Math.min(1, Math.max(-1, score));
}

export function euclideanDistance(
  a: TeachingVector,
  b: TeachingVector,
): number | null {
  if (!finite(a) || !finite(b)) return null;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function rankDocuments(
  query: TeachingVector,
  metric: AiMetric,
  documents: AiDocument[] = corpus,
): Array<{ document: AiDocument; score: number | null }> {
  // A zero query means no teaching vocabulary matched, not a meaningful search.
  const validQuery = finite(query) && length(query) > 0;
  return documents
    .map((document) => ({
      document,
      score: validQuery
        ? metric === "cosine"
          ? cosineSimilarity(query, document.vector)
          : euclideanDistance(query, document.vector)
        : null,
    }))
    .sort((a, b) => {
      if (a.score === null && b.score === null)
        return a.document.id.localeCompare(b.document.id);
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      const difference =
        metric === "cosine" ? b.score - a.score : a.score - b.score;
      return Math.abs(difference) <= 1e-12
        ? a.document.id.localeCompare(b.document.id)
        : difference;
    });
}

export const queryPresets = [
  { label: "Reset password", query: "reset password" },
  { label: "Vacation policy", query: "vacation leave policy" },
  { label: "Lunch menu", query: "cafeteria lunch menu" },
  { label: "Remote access", query: "remote working account access" },
];

export const vectorText = (vector: TeachingVector) =>
  `(${vector.map((value) => Number(value.toFixed(2))).join(", ")})`;

/** A deterministic retrieval simulation: only actual retrieved text can answer. */
export function retrieveContext(
  query: TeachingVector,
  metric: AiMetric,
  limit = 2,
  documents: AiDocument[] = corpus,
): AiDocument[] {
  return rankDocuments(query, metric, documents)
    .filter(
      (item) =>
        item.score !== null &&
        item.document.vector.some(
          (value, axis) => value > 0 && query[axis] > 0,
        ),
    )
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((item) => item.document);
}

export function extractAnswer(
  documents: AiDocument[],
): Array<{ sourceId: string; sentence: string }> {
  return documents.map((document) => ({
    sourceId: document.id,
    sentence: document.text.split(/(?<=\.)\s/)[0],
  }));
}
