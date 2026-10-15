/**
 * Reproducible training + evaluation pipeline.
 *
 * Leakage control: the input matrix is built ONLY from the declared clinical
 * FEATURES. Cath / LAD / LCX / RCA (and any alias flagged by isLeakageColumn)
 * can never enter the matrix, for any target.
 */
import {
  FEATURES,
  TARGETS,
  FEATURE_BY_NAME,
  isLeakageColumn,
  mapTargetValue,
  resolveColumn,
  toNumber,
  type Row,
  type TargetDef,
  type TargetKey,
} from "./schema";
import {
  fitPreprocessor,
  transform,
  featureNames,
  trainLogReg,
  trainForest,
  predictAll,
  predictOne,
  fitPlatt,
  applyPlatt,
  type ModelState,
  type PlattState,
  type PreprocessorState,
  type RawPatient,
} from "./models";
import { evaluate, rocAuc, type MetricSet } from "./metrics";
import { mulberry32 } from "./synthetic";

export interface TargetArtifact {
  key: TargetKey;
  label: string;
  available: true;
  modelType: "logreg" | "forest";
  modelLabel: string;
  preprocessor: PreprocessorState;
  model: ModelState;
  calibration: PlattState | null;
  threshold: number;
  featureNames: string[];
  prevalence: number;
  nTrain: number;
  nVal: number;
  nTest: number;
  candidates: { name: string; valAuc: number | null; valF1: number | null; selected: boolean }[];
  cv: { folds: number; aucMean: number | null; aucSd: number | null; aucPerFold: (number | null)[] };
  validation: MetricSet;
  test: MetricSet;
  globalImportance: { feature: string; importance: number }[];
}

export interface UnavailableTarget {
  key: TargetKey;
  label: string;
  available: false;
  reason: string;
}

export type TargetEntry = TargetArtifact | UnavailableTarget;

export interface Artifact {
  version: 1;
  createdAt: string;
  datasetName: string;
  datasetKind: "synthetic" | "uploaded";
  nRows: number;
  nUsableRows: number;
  seed: number;
  featureColumnsUsed: string[];
  missingFeatureColumns: string[];
  excludedLeakageColumns: string[];
  explanationMethod: string;
  targets: Record<string, TargetEntry>;
}

export interface PreparedDataset {
  patients: RawPatient[];
  labels: Partial<Record<TargetKey, (0 | 1 | null)[]>>;
  featureColumnsUsed: string[];
  missingFeatureColumns: string[];
  excludedLeakageColumns: string[];
  targetAvailability: Record<string, { present: boolean; mapped: number; positives: number; reason?: string }>;
}

export function prepareDataset(headers: string[], rows: Row[]): PreparedDataset {
  const featureColumnsUsed: string[] = [];
  const missingFeatureColumns: string[] = [];
  const colMap = new Map<string, string>();
  for (const f of FEATURES) {
    const col = resolveColumn(headers, f.name, f.aliases);
    if (col) {
      colMap.set(f.key, col);
      featureColumnsUsed.push(col);
    } else missingFeatureColumns.push(f.name);
  }
  const excludedLeakageColumns = headers.filter((h) => isLeakageColumn(h));

  const patients: RawPatient[] = rows.map((r) => {
    const p: RawPatient = {};
    for (const f of FEATURES) {
      const col = colMap.get(f.key);
      if (!col) {
        p[f.key] = null;
        continue;
      }
      const raw = r[col];
      p[f.key] = f.kind === "categorical" ? (raw === null ? null : String(raw)) : toNumber(raw);
    }
    return p;
  });

  const labels: Partial<Record<TargetKey, (0 | 1 | null)[]>> = {};
  const targetAvailability: PreparedDataset["targetAvailability"] = {};
  for (const t of TARGETS) {
    const col = resolveColumn(headers, t.column);
    if (!col) {
      targetAvailability[t.key] = { present: false, mapped: 0, positives: 0, reason: `Column "${t.column}" is not present in the dataset.` };
      continue;
    }
    const mapped = rows.map((r) => mapTargetValue(t, r[col]));
    const usable = mapped.filter((v) => v !== null).length;
    const positives = mapped.filter((v) => v === 1).length;
    labels[t.key] = mapped;
    targetAvailability[t.key] = { present: true, mapped: usable, positives };
  }
  return { patients, labels, featureColumnsUsed, missingFeatureColumns, excludedLeakageColumns, targetAvailability };
}

function stratifiedSplit(y: number[], ratios: [number, number, number], seed: number) {
  const rand = mulberry32(seed);
  const byClass: Record<number, number[]> = { 0: [], 1: [] };
  y.forEach((v, i) => byClass[v].push(i));
  const train: number[] = [];
  const val: number[] = [];
  const test: number[] = [];
  for (const cls of [0, 1]) {
    const idx = byClass[cls].slice();
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const nTrain = Math.round(idx.length * ratios[0]);
    const nVal = Math.round(idx.length * ratios[1]);
    train.push(...idx.slice(0, nTrain));
    val.push(...idx.slice(nTrain, nTrain + nVal));
    test.push(...idx.slice(nTrain + nVal));
  }
  return { train, val, test };
}

function stratifiedFolds(y: number[], k: number, seed: number) {
  const rand = mulberry32(seed);
  const folds: number[][] = Array.from({ length: k }, () => []);
  for (const cls of [0, 1]) {
    const idx = y.map((v, i) => ({ v, i })).filter((d) => d.v === cls).map((d) => d.i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    idx.forEach((v, i) => folds[i % k].push(v));
  }
  return folds;
}

function tuneThreshold(y: number[], probs: number[]): number {
  let best = 0.5;
  let bestScore = -1;
  for (let t = 0.05; t <= 0.95; t += 0.01) {
    const m = evaluate(y, probs, t);
    // Youden's J with a mild sensitivity preference: recall matters more than
    // specificity in a screening context, but specificity cannot collapse.
    const r = m.recall ?? 0;
    const s = m.specificity ?? 0;
    const score = 1.15 * r + s;
    if (score > bestScore) {
      bestScore = score;
      best = Number(t.toFixed(2));
    }
  }
  return best;
}

function permutationImportance(model: ModelState, X: number[][], y: number[], names: string[], seed: number) {
  const base = rocAuc(y, predictAll(model, X));
  if (base === null) return names.map((feature) => ({ feature, importance: 0 }));
  const rand = mulberry32(seed);
  const out: { feature: string; importance: number }[] = [];
  for (let j = 0; j < names.length; j++) {
    let drop = 0;
    const repeats = 3;
    for (let r = 0; r < repeats; r++) {
      const perm = X.map((row) => row.slice());
      const order = perm.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const k = Math.floor(rand() * (i + 1));
        [order[i], order[k]] = [order[k], order[i]];
      }
      order.forEach((src, i) => {
        perm[i][j] = X[src][j];
      });
      const auc = rocAuc(y, predictAll(model, perm));
      drop += base - (auc ?? base);
    }
    out.push({ feature: names[j], importance: drop / repeats });
  }
  return out.sort((a, b) => b.importance - a.importance);
}

export interface TrainOptions {
  datasetName: string;
  datasetKind: "synthetic" | "uploaded";
  seed?: number;
  cvFolds?: number;
}

export function trainArtifact(headers: string[], rows: Row[], opts: TrainOptions): Artifact {
  const seed = opts.seed ?? 20260207;
  const prepared = prepareDataset(headers, rows);
  const targets: Record<string, TargetEntry> = {};

  for (const t of TARGETS) {
    targets[t.key] = trainTarget(t, prepared, seed, opts.cvFolds ?? 5);
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    datasetName: opts.datasetName,
    datasetKind: opts.datasetKind,
    nRows: rows.length,
    nUsableRows: prepared.patients.length,
    seed,
    featureColumnsUsed: prepared.featureColumnsUsed,
    missingFeatureColumns: prepared.missingFeatureColumns,
    excludedLeakageColumns: prepared.excludedLeakageColumns,
    explanationMethod:
      "Permutation importance (global) + standardised weight x value / tree-path attribution (local). SHAP (Python) is not available in this runtime; the implemented method is an additive, model-appropriate alternative and is labelled as such.",
    targets,
  };
}

function trainTarget(t: TargetDef, prepared: PreparedDataset, seed: number, cvFolds: number): TargetEntry {
  const availability = prepared.targetAvailability[t.key];
  if (!availability?.present) {
    return {
      key: t.key,
      label: t.label,
      available: false,
      reason:
        availability?.reason ??
        `Target column "${t.column}" is missing. Upload a dataset that contains a "${t.column}" column with ${t.positiveLabel}/Normal values to enable this prediction.`,
    };
  }
  const mapped = prepared.labels[t.key] ?? [];
  const idx: number[] = [];
  mapped.forEach((v, i) => {
    if (v !== null) idx.push(i);
  });
  const y = idx.map((i) => mapped[i] as number);
  const patients = idx.map((i) => prepared.patients[i]);
  const pos = y.filter((v) => v === 1).length;
  const neg = y.length - pos;
  if (y.length < 40 || pos < 8 || neg < 8) {
    return {
      key: t.key,
      label: t.label,
      available: false,
      reason: `Insufficient labelled data for "${t.column}": ${y.length} usable rows (${pos} positive / ${neg} negative). At least 40 rows with >=8 per class are required.`,
    };
  }

  const split = stratifiedSplit(y, [0.6, 0.2, 0.2], seed + t.key.length);
  const trainRows = split.train.map((i) => patients[i]);
  const valRows = split.val.map((i) => patients[i]);
  const testRows = split.test.map((i) => patients[i]);
  const yTrain = split.train.map((i) => y[i]);
  const yVal = split.val.map((i) => y[i]);
  const yTest = split.test.map((i) => y[i]);

  // Preprocessor fitted on TRAIN ONLY (no leakage from val/test).
  const pre = fitPreprocessor(trainRows);
  const names = featureNames(pre);
  const Xtrain = transform(trainRows, pre);
  const Xval = transform(valRows, pre);
  const Xtest = transform(testRows, pre);

  const candidateDefs: { name: string; label: string; type: "logreg" | "forest"; fit: () => ModelState }[] = [
    { name: "logreg_l2", label: "Logistic regression (L2, class-weighted)", type: "logreg", fit: () => trainLogReg(Xtrain, yTrain, { l2: 0.05 }) },
    { name: "logreg_strong", label: "Logistic regression (stronger L2)", type: "logreg", fit: () => trainLogReg(Xtrain, yTrain, { l2: 0.3 }) },
    { name: "random_forest", label: "Random forest (balanced, 80 trees)", type: "forest", fit: () => trainForest(Xtrain, yTrain, { nTrees: 80, maxDepth: 6, seed }) },
  ];

  const candidates: TargetArtifact["candidates"] = [];
  let bestModel: ModelState | null = null;
  let bestName = "";
  let bestLabel = "";
  let bestType: "logreg" | "forest" = "logreg";
  let bestScore = -Infinity;

  for (const c of candidateDefs) {
    const m = c.fit();
    const pv = predictAll(m, Xval);
    const auc = rocAuc(yVal, pv);
    const thr = tuneThreshold(yVal, pv);
    const f1 = evaluate(yVal, pv, thr).f1;
    candidates.push({ name: c.name, valAuc: auc, valF1: f1, selected: false });
    // Prefer discrimination; break ties toward the simpler interpretable model.
    const score = (auc ?? 0) + (c.type === "logreg" ? 0.01 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestModel = m;
      bestName = c.name;
      bestLabel = c.label;
      bestType = c.type;
    }
  }
  const chosen = candidates.find((c) => c.name === bestName);
  if (chosen) chosen.selected = true;
  const model = bestModel as ModelState;

  // Probability calibration + threshold tuned on VALIDATION only.
  const valRaw = predictAll(model, Xval);
  const calibration = fitPlatt(valRaw, yVal);
  const valCal = valRaw.map((p) => applyPlatt(calibration, p));
  const threshold = tuneThreshold(yVal, valCal);

  const validation = evaluate(yVal, valCal, threshold);
  const testProbs = predictAll(model, Xtest).map((p) => applyPlatt(calibration, p));
  const test = evaluate(yTest, testProbs, threshold);

  // Stratified k-fold CV over train+val (test untouched).
  const cvIdx = [...split.train, ...split.val];
  const cvY = cvIdx.map((i) => y[i]);
  const folds = stratifiedFolds(cvY, Math.min(cvFolds, Math.max(2, Math.floor(Math.min(cvY.filter((v) => v === 1).length, cvY.filter((v) => v === 0).length) / 2))), seed + 7);
  const aucPerFold: (number | null)[] = [];
  for (let f = 0; f < folds.length; f++) {
    const testIdx = folds[f];
    const trIdx = folds.filter((_, i) => i !== f).flat();
    const trRows = trIdx.map((i) => patients[cvIdx[i]]);
    const teRows = testIdx.map((i) => patients[cvIdx[i]]);
    const preF = fitPreprocessor(trRows);
    const mF = bestType === "logreg" ? trainLogReg(transform(trRows, preF), trIdx.map((i) => cvY[i]), { l2: 0.05 }) : trainForest(transform(trRows, preF), trIdx.map((i) => cvY[i]), { nTrees: 60, maxDepth: 6, seed });
    aucPerFold.push(rocAuc(testIdx.map((i) => cvY[i]), predictAll(mF, transform(teRows, preF))));
  }
  const valid = aucPerFold.filter((a): a is number => a !== null);
  const aucMean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  const aucSd = valid.length > 1 ? Math.sqrt(valid.reduce((a, b) => a + (b - (aucMean as number)) ** 2, 0) / (valid.length - 1)) : null;

  const globalImportance = permutationImportance(model, Xval, yVal, names, seed + 11).slice(0, 20);

  return {
    key: t.key,
    label: t.label,
    available: true,
    modelType: bestType,
    modelLabel: bestLabel,
    preprocessor: pre,
    model,
    calibration,
    threshold,
    featureNames: names,
    prevalence: pos / y.length,
    nTrain: yTrain.length,
    nVal: yVal.length,
    nTest: yTest.length,
    candidates,
    cv: { folds: folds.length, aucMean, aucSd, aucPerFold },
    validation,
    test,
    globalImportance,
  };
}

export function predictWithTarget(entry: TargetArtifact, patient: RawPatient): { probability: number; predicted: 0 | 1 } {
  const x = transform([patient], entry.preprocessor)[0];
  const raw = predictOne(entry.model, x);
  const probability = Math.min(1, Math.max(0, applyPlatt(entry.calibration, raw)));
  return { probability, predicted: probability >= entry.threshold ? 1 : 0 };
}
