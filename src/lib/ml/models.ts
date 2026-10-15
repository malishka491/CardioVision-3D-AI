/**
 * Self-contained, dependency-free model implementations (TypeScript port of the
 * classic scikit-learn style estimators used in the original design):
 *  - Preprocessor: median/mode imputation + one-hot encoding + standardisation
 *  - LogisticRegression: L2-penalised, class-weighted, batch gradient descent
 *  - RandomForest: bootstrap-aggregated CART with Gini impurity
 *  - PlattCalibrator: sigmoid probability calibration fitted on validation data
 *
 * Everything is JSON-serialisable so a fitted pipeline can be persisted in
 * PostgreSQL and reloaded for inference without retraining.
 */
import { FEATURES, type FeatureDef } from "./schema";
import { mulberry32 } from "./synthetic";

export interface PreprocessorState {
  columns: { feature: string; kind: FeatureDef["kind"]; category?: string }[];
  medians: Record<string, number>;
  modes: Record<string, string>;
  means: number[];
  sds: number[];
}

export type RawPatient = Record<string, number | string | null | undefined>;

export function fitPreprocessor(rows: RawPatient[], features: FeatureDef[] = FEATURES): PreprocessorState {
  const medians: Record<string, number> = {};
  const modes: Record<string, string> = {};
  const columns: PreprocessorState["columns"] = [];

  for (const f of features) {
    if (f.kind === "categorical") {
      const counts = new Map<string, number>();
      for (const r of rows) {
        const v = r[f.key];
        if (v === null || v === undefined || v === "") continue;
        const s = String(v);
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
      let mode = String(f.default);
      let best = -1;
      counts.forEach((c, v) => {
        if (c > best) {
          best = c;
          mode = v;
        }
      });
      modes[f.key] = mode;
      const cats = f.categories ?? Array.from(counts.keys());
      for (const c of cats) columns.push({ feature: f.key, kind: "categorical", category: c });
    } else {
      const vals = rows.map((r) => (typeof r[f.key] === "number" ? (r[f.key] as number) : Number(r[f.key]))).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
      medians[f.key] = vals.length ? vals[Math.floor(vals.length / 2)] : Number(f.default) || 0;
      columns.push({ feature: f.key, kind: f.kind });
    }
  }

  const state: PreprocessorState = { columns, medians, modes, means: [], sds: [] };
  const matrix = rows.map((r) => encodeRow(r, state, false));
  const p = columns.length;
  const means = new Array(p).fill(0);
  const sds = new Array(p).fill(1);
  for (let j = 0; j < p; j++) {
    let sum = 0;
    for (const row of matrix) sum += row[j];
    means[j] = matrix.length ? sum / matrix.length : 0;
    let varSum = 0;
    for (const row of matrix) varSum += (row[j] - means[j]) ** 2;
    const sd = matrix.length > 1 ? Math.sqrt(varSum / (matrix.length - 1)) : 0;
    sds[j] = sd > 1e-8 ? sd : 1;
  }
  state.means = means;
  state.sds = sds;
  return state;
}

function encodeRow(row: RawPatient, state: PreprocessorState, scale = true): number[] {
  const out: number[] = [];
  state.columns.forEach((col, j) => {
    let v: number;
    if (col.kind === "categorical") {
      const raw = row[col.feature];
      const s = raw === null || raw === undefined || raw === "" ? state.modes[col.feature] : String(raw);
      v = s.toLowerCase() === (col.category ?? "").toLowerCase() ? 1 : 0;
    } else {
      const raw = row[col.feature];
      const num = typeof raw === "number" ? raw : raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
      v = Number.isFinite(num) ? num : state.medians[col.feature] ?? 0;
    }
    out.push(scale ? (v - state.means[j]) / state.sds[j] : v);
  });
  return out;
}

export function transform(rows: RawPatient[], state: PreprocessorState): number[][] {
  return rows.map((r) => encodeRow(r, state, true));
}

export function featureNames(state: PreprocessorState): string[] {
  return state.columns.map((c) => (c.category ? `${c.feature}=${c.category}` : c.feature));
}

// ------------------------------------------------------------------ logistic
export interface LogRegState {
  kind: "logreg";
  weights: number[];
  bias: number;
  l2: number;
  iterations: number;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

export function trainLogReg(X: number[][], y: number[], opts: { l2?: number; lr?: number; iterations?: number; classWeight?: boolean } = {}): LogRegState {
  const l2 = opts.l2 ?? 0.05;
  const lr = opts.lr ?? 0.15;
  const iterations = opts.iterations ?? 800;
  const n = X.length;
  const p = n ? X[0].length : 0;
  const w = new Array(p).fill(0);
  let b = 0;
  const pos = y.filter((v) => v === 1).length || 1;
  const neg = n - pos || 1;
  const wPos = opts.classWeight === false ? 1 : n / (2 * pos);
  const wNeg = opts.classWeight === false ? 1 : n / (2 * neg);
  for (let it = 0; it < iterations; it++) {
    const gw = new Array(p).fill(0);
    let gb = 0;
    let wsum = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < p; j++) z += w[j] * X[i][j];
      const pred = sigmoid(z);
      const cw = y[i] === 1 ? wPos : wNeg;
      const err = (pred - y[i]) * cw;
      for (let j = 0; j < p; j++) gw[j] += err * X[i][j];
      gb += err;
      wsum += cw;
    }
    const scale = lr / Math.max(wsum, 1);
    for (let j = 0; j < p; j++) w[j] -= scale * gw[j] + lr * l2 * w[j];
    b -= scale * gb;
  }
  return { kind: "logreg", weights: w, bias: b, l2, iterations };
}

export function predictLogReg(model: LogRegState, x: number[]): number {
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) z += model.weights[j] * x[j];
  return sigmoid(z);
}

// --------------------------------------------------------------------- trees
interface TreeNode {
  leaf?: number;
  f?: number;
  t?: number;
  l?: TreeNode;
  r?: TreeNode;
}

export interface ForestState {
  kind: "forest";
  trees: TreeNode[];
  nTrees: number;
  maxDepth: number;
}

function gini(pos: number, total: number) {
  if (total === 0) return 0;
  const p = pos / total;
  return 2 * p * (1 - p);
}

function buildTree(X: number[][], y: number[], idx: number[], depth: number, maxDepth: number, minLeaf: number, mtry: number, rand: () => number, weights: number[]): TreeNode {
  let wpos = 0;
  let wtot = 0;
  for (const i of idx) {
    wtot += weights[i];
    if (y[i] === 1) wpos += weights[i];
  }
  const leafValue = wtot > 0 ? wpos / wtot : 0;
  if (depth >= maxDepth || idx.length < 2 * minLeaf || wpos === 0 || wpos === wtot) return { leaf: leafValue };

  const p = X[0].length;
  const featureIdx: number[] = [];
  while (featureIdx.length < Math.min(mtry, p)) {
    const f = Math.floor(rand() * p);
    if (!featureIdx.includes(f)) featureIdx.push(f);
  }
  let bestGain = 1e-7;
  let bestF = -1;
  let bestT = 0;
  const parentImp = gini(wpos, wtot);
  for (const f of featureIdx) {
    const vals = idx.map((i) => X[i][f]).sort((a, b) => a - b);
    const candidates: number[] = [];
    for (const q of [0.25, 0.5, 0.75]) {
      const v = vals[Math.floor(q * (vals.length - 1))];
      if (!candidates.includes(v)) candidates.push(v);
    }
    for (const t of candidates) {
      let lp = 0;
      let lt = 0;
      let rp = 0;
      let rt = 0;
      let lc = 0;
      let rc = 0;
      for (const i of idx) {
        if (X[i][f] <= t) {
          lt += weights[i];
          lc++;
          if (y[i] === 1) lp += weights[i];
        } else {
          rt += weights[i];
          rc++;
          if (y[i] === 1) rp += weights[i];
        }
      }
      if (lc < minLeaf || rc < minLeaf) continue;
      const gain = parentImp - (lt / wtot) * gini(lp, lt) - (rt / wtot) * gini(rp, rt);
      if (gain > bestGain) {
        bestGain = gain;
        bestF = f;
        bestT = t;
      }
    }
  }
  if (bestF < 0) return { leaf: leafValue };
  const leftIdx = idx.filter((i) => X[i][bestF] <= bestT);
  const rightIdx = idx.filter((i) => X[i][bestF] > bestT);
  return {
    f: bestF,
    t: bestT,
    l: buildTree(X, y, leftIdx, depth + 1, maxDepth, minLeaf, mtry, rand, weights),
    r: buildTree(X, y, rightIdx, depth + 1, maxDepth, minLeaf, mtry, rand, weights),
  };
}

export function trainForest(X: number[][], y: number[], opts: { nTrees?: number; maxDepth?: number; minLeaf?: number; seed?: number } = {}): ForestState {
  const nTrees = opts.nTrees ?? 60;
  const maxDepth = opts.maxDepth ?? 6;
  const minLeaf = opts.minLeaf ?? 4;
  const rand = mulberry32(opts.seed ?? 42);
  const n = X.length;
  const pos = y.filter((v) => v === 1).length || 1;
  const neg = n - pos || 1;
  const weights = y.map((v) => (v === 1 ? n / (2 * pos) : n / (2 * neg)));
  const mtry = Math.max(2, Math.round(Math.sqrt(X[0]?.length ?? 1)));
  const trees: TreeNode[] = [];
  for (let t = 0; t < nTrees; t++) {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(Math.floor(rand() * n));
    trees.push(buildTree(X, y, idx, 0, maxDepth, minLeaf, mtry, rand, weights));
  }
  return { kind: "forest", trees, nTrees, maxDepth };
}

function predictTree(node: TreeNode, x: number[]): number {
  let cur = node;
  while (cur.leaf === undefined) {
    cur = x[cur.f as number] <= (cur.t as number) ? (cur.l as TreeNode) : (cur.r as TreeNode);
  }
  return cur.leaf;
}

export function predictForest(model: ForestState, x: number[]): number {
  if (model.trees.length === 0) return 0.5;
  let sum = 0;
  for (const t of model.trees) sum += predictTree(t, x);
  return sum / model.trees.length;
}

// --------------------------------------------------------------- calibration
export interface PlattState {
  a: number;
  b: number;
}

export function fitPlatt(probs: number[], y: number[]): PlattState {
  const logits = probs.map((p) => Math.log(Math.max(p, 1e-6) / Math.max(1 - p, 1e-6)));
  let a = 1;
  let b = 0;
  const n = logits.length;
  if (n === 0) return { a, b };
  for (let it = 0; it < 500; it++) {
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const pred = sigmoid(a * logits[i] + b);
      const err = pred - y[i];
      ga += err * logits[i];
      gb += err;
    }
    a -= (0.1 * ga) / n;
    b -= (0.1 * gb) / n;
  }
  return { a, b };
}

export function applyPlatt(cal: PlattState | null, p: number): number {
  if (!cal) return p;
  const logit = Math.log(Math.max(p, 1e-6) / Math.max(1 - p, 1e-6));
  return sigmoid(cal.a * logit + cal.b);
}

export type ModelState = LogRegState | ForestState;

export function predictOne(model: ModelState, x: number[]): number {
  return model.kind === "logreg" ? predictLogReg(model, x) : predictForest(model, x);
}

export function predictAll(model: ModelState, X: number[][]): number[] {
  return X.map((x) => predictOne(model, x));
}
