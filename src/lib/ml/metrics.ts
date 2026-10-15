/** Classification metric helpers (safe against degenerate / tiny samples). */

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
}

export interface MetricSet {
  n: number;
  positives: number;
  negatives: number;
  threshold: number;
  accuracy: number;
  precision: number | null;
  recall: number | null;
  specificity: number | null;
  f1: number | null;
  rocAuc: number | null;
  prAuc: number | null;
  brier: number | null;
  confusion: ConfusionMatrix;
  rocCurve: { fpr: number; tpr: number }[];
  prCurve: { recall: number; precision: number }[];
  calibration: { bin: string; predicted: number; observed: number; count: number }[];
  accuracyCi95: [number, number] | null;
  notes: string[];
}

export function confusion(yTrue: number[], yProb: number[], threshold: number): ConfusionMatrix {
  const cm: ConfusionMatrix = { tn: 0, fp: 0, fn: 0, tp: 0 };
  for (let i = 0; i < yTrue.length; i++) {
    const pred = yProb[i] >= threshold ? 1 : 0;
    if (yTrue[i] === 1 && pred === 1) cm.tp++;
    else if (yTrue[i] === 1) cm.fn++;
    else if (pred === 1) cm.fp++;
    else cm.tn++;
  }
  return cm;
}

export function rocAuc(yTrue: number[], yProb: number[]): number | null {
  const pos = yTrue.filter((y) => y === 1).length;
  const neg = yTrue.length - pos;
  if (pos === 0 || neg === 0) return null;
  const idx = yProb.map((p, i) => ({ p, y: yTrue[i] })).sort((a, b) => a.p - b.p);
  // rank with ties averaged
  const ranks = new Array<number>(idx.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].p === idx[i].p) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  let sumRanksPos = 0;
  idx.forEach((d, k) => {
    if (d.y === 1) sumRanksPos += ranks[k];
  });
  return (sumRanksPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

export function rocCurve(yTrue: number[], yProb: number[]) {
  const pos = yTrue.filter((y) => y === 1).length;
  const neg = yTrue.length - pos;
  if (pos === 0 || neg === 0) return [];
  const pts: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }];
  const sorted = yProb.map((p, i) => ({ p, y: yTrue[i] })).sort((a, b) => b.p - a.p);
  let tp = 0;
  let fp = 0;
  for (const s of sorted) {
    if (s.y === 1) tp++;
    else fp++;
    pts.push({ fpr: fp / neg, tpr: tp / pos });
  }
  return downsample(pts, 60);
}

export function prCurve(yTrue: number[], yProb: number[]) {
  const pos = yTrue.filter((y) => y === 1).length;
  if (pos === 0) return [];
  const sorted = yProb.map((p, i) => ({ p, y: yTrue[i] })).sort((a, b) => b.p - a.p);
  const pts: { recall: number; precision: number }[] = [];
  let tp = 0;
  let fp = 0;
  for (const s of sorted) {
    if (s.y === 1) tp++;
    else fp++;
    pts.push({ recall: tp / pos, precision: tp / (tp + fp) });
  }
  return downsample(pts, 60);
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}

export function averagePrecision(yTrue: number[], yProb: number[]): number | null {
  const pos = yTrue.filter((y) => y === 1).length;
  if (pos === 0) return null;
  const sorted = yProb.map((p, i) => ({ p, y: yTrue[i] })).sort((a, b) => b.p - a.p);
  let tp = 0;
  let fp = 0;
  let prevRecall = 0;
  let ap = 0;
  for (const s of sorted) {
    if (s.y === 1) tp++;
    else fp++;
    const recall = tp / pos;
    const precision = tp / (tp + fp);
    ap += (recall - prevRecall) * precision;
    prevRecall = recall;
  }
  return ap;
}

export function brierScore(yTrue: number[], yProb: number[]): number | null {
  if (yTrue.length === 0) return null;
  return yTrue.reduce((acc, y, i) => acc + (yProb[i] - y) ** 2, 0) / yTrue.length;
}

export function calibrationBins(yTrue: number[], yProb: number[], bins = 5) {
  const out: { bin: string; predicted: number; observed: number; count: number }[] = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    const idx = yProb.map((p, i) => ({ p, i })).filter((d) => (b === bins - 1 ? d.p >= lo && d.p <= hi : d.p >= lo && d.p < hi));
    if (idx.length === 0) continue;
    out.push({
      bin: `${lo.toFixed(1)}–${hi.toFixed(1)}`,
      predicted: idx.reduce((a, d) => a + d.p, 0) / idx.length,
      observed: idx.reduce((a, d) => a + yTrue[d.i], 0) / idx.length,
      count: idx.length,
    });
  }
  return out;
}

/** Wilson score interval for a proportion. */
export function wilsonCi(successes: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - margin) / denom), Math.min(1, (centre + margin) / denom)];
}

export function evaluate(yTrue: number[], yProb: number[], threshold: number): MetricSet {
  const notes: string[] = [];
  const cm = confusion(yTrue, yProb, threshold);
  const n = yTrue.length;
  const positives = yTrue.filter((y) => y === 1).length;
  const negatives = n - positives;
  const correct = cm.tp + cm.tn;
  const precision = cm.tp + cm.fp > 0 ? cm.tp / (cm.tp + cm.fp) : null;
  const recall = cm.tp + cm.fn > 0 ? cm.tp / (cm.tp + cm.fn) : null;
  const specificity = cm.tn + cm.fp > 0 ? cm.tn / (cm.tn + cm.fp) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
  const auc = rocAuc(yTrue, yProb);
  if (auc === null) notes.push("ROC-AUC undefined: evaluation set contains a single class.");
  if (precision === null) notes.push("Precision undefined: no positive predictions at this threshold.");
  if (n < 50) notes.push("Very small evaluation sample — metrics are unstable and preliminary.");
  return {
    n,
    positives,
    negatives,
    threshold,
    accuracy: n > 0 ? correct / n : 0,
    precision,
    recall,
    specificity,
    f1,
    rocAuc: auc,
    prAuc: averagePrecision(yTrue, yProb),
    brier: brierScore(yTrue, yProb),
    confusion: cm,
    rocCurve: rocCurve(yTrue, yProb),
    prCurve: prCurve(yTrue, yProb),
    calibration: calibrationBins(yTrue, yProb),
    accuracyCi95: wilsonCi(correct, n),
    notes,
  };
}
