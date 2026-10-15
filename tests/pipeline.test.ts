import { describe, expect, it } from "vitest";
import { FEATURES, isLeakageColumn, parseCsv, mapTargetValue, TARGETS } from "../src/lib/ml/schema";
import { generateSyntheticCohort, syntheticDemoPatient } from "../src/lib/ml/synthetic";
import { prepareDataset, trainArtifact, predictWithTarget } from "../src/lib/ml/train";
import { explainPatient } from "../src/lib/ml/explain";
import { inspectDataset } from "../src/lib/ml/inspect";
import { evaluate, rocAuc, wilsonCi } from "../src/lib/ml/metrics";
import { patientSchema, requiredMissing } from "../src/lib/validation";
import { fitPreprocessor, transform, featureNames } from "../src/lib/ml/models";

const cohort = generateSyntheticCohort(260, 7);
const headers = Object.keys(cohort[0]);
const artifact = trainArtifact(headers, cohort, { datasetName: "test cohort", datasetKind: "synthetic" });

describe("schema & leakage prevention", () => {
  it("flags every angiography target column as leakage", () => {
    for (const t of TARGETS) expect(isLeakageColumn(t.column)).toBe(true);
  });

  it("never admits a target column into the model input matrix", () => {
    const prepared = prepareDataset(headers, cohort);
    const pre = fitPreprocessor(prepared.patients);
    const names = featureNames(pre).map((n) => n.toLowerCase());
    for (const t of TARGETS) expect(names.some((n) => n.startsWith(t.column.toLowerCase()))).toBe(false);
    expect(prepared.excludedLeakageColumns).toEqual(expect.arrayContaining(["Cath", "LAD", "LCX", "RCA"]));
  });

  it("maps target values case-insensitively and rejects unknown labels", () => {
    const cad = TARGETS[0];
    expect(mapTargetValue(cad, "Cad")).toBe(1);
    expect(mapTargetValue(cad, "Normal")).toBe(0);
    expect(mapTargetValue(cad, "unknown-label")).toBeNull();
  });
});

describe("csv parsing & dataset inspection", () => {
  it("parses quoted csv content", () => {
    const { headers: h, rows } = parseCsv('Age,Sex\n61,"Male"\n,Fmale\n');
    expect(h).toEqual(["Age", "Sex"]);
    expect(rows).toHaveLength(2);
    expect(rows[1].Age).toBeNull();
  });

  it("reports missingness, duplicates and target availability", () => {
    const report = inspectDataset("t.csv", headers, cohort.slice(0, 120));
    expect(report.nRows).toBe(120);
    expect(report.targets.filter((t) => t.present)).toHaveLength(4);
    expect(report.leakageColumns).toContain("Cath");
    expect(report.trainable).toBe(true);
  });

  it("marks a dataset without targets as untrainable", () => {
    const stripped = cohort.slice(0, 60).map((r) => {
      const copy = { ...r };
      for (const t of TARGETS) delete copy[t.column];
      return copy;
    });
    const report = inspectDataset("t.csv", Object.keys(stripped[0]), stripped);
    expect(report.trainable).toBe(false);
    expect(report.targets.every((t) => !t.present)).toBe(true);
  });
});

describe("preprocessing consistency", () => {
  it("produces identical widths for train and inference rows and imputes missing values", () => {
    const prepared = prepareDataset(headers, cohort);
    const pre = fitPreprocessor(prepared.patients.slice(0, 100));
    const X = transform(prepared.patients.slice(0, 100), pre);
    const sparse = transform([{ age: 60 }], pre);
    expect(sparse[0]).toHaveLength(X[0].length);
    expect(sparse[0].every((v) => Number.isFinite(v))).toBe(true);
  });

  it("handles unseen categorical levels without crashing", () => {
    const prepared = prepareDataset(headers, cohort);
    const pre = fitPreprocessor(prepared.patients);
    const x = transform([{ ...syntheticDemoPatient("high"), bbb: "UNSEEN-LEVEL" }], pre)[0];
    expect(x.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("metrics", () => {
  it("returns null AUC for a single-class evaluation set", () => {
    expect(rocAuc([1, 1, 1], [0.2, 0.4, 0.9])).toBeNull();
    const m = evaluate([1, 1, 1], [0.2, 0.4, 0.9], 0.5);
    expect(m.rocAuc).toBeNull();
    expect(m.notes.length).toBeGreaterThan(0);
  });

  it("computes a perfect AUC for separable scores", () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9])).toBe(1);
  });

  it("produces a valid Wilson interval", () => {
    const ci = wilsonCi(8, 10);
    expect(ci).not.toBeNull();
    expect((ci as [number, number])[0]).toBeLessThan(0.8);
    expect((ci as [number, number])[1]).toBeGreaterThan(0.8);
  });
});

describe("training & inference", () => {
  it("trains all four targets on the synthetic cohort", () => {
    for (const t of TARGETS) expect(artifact.targets[t.key].available).toBe(true);
  });

  it("reports an unavailable target instead of inventing labels", () => {
    const stripped = cohort.map((r) => {
      const copy = { ...r };
      delete copy.LCX;
      return copy;
    });
    const a = trainArtifact(Object.keys(stripped[0]), stripped, { datasetName: "no-lcx", datasetKind: "synthetic" });
    const lcx = a.targets.lcx;
    expect(lcx.available).toBe(false);
    if (!lcx.available) expect(lcx.reason).toMatch(/LCX/);
    expect(a.targets.cad.available).toBe(true);
  });

  it("returns finite probabilities inside [0,1] with a usable threshold", () => {
    const entry = artifact.targets.cad;
    if (!entry.available) throw new Error("CAD model should be trained");
    for (const profile of ["high", "low"] as const) {
      const { probability, predicted } = predictWithTarget(entry, syntheticDemoPatient(profile));
      expect(Number.isFinite(probability)).toBe(true);
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
      expect([0, 1]).toContain(predicted);
    }
    expect(entry.threshold).toBeGreaterThan(0);
    expect(entry.threshold).toBeLessThan(1);
  });

  it("ranks the higher-risk synthetic profile above the lower-risk one", () => {
    const entry = artifact.targets.cad;
    if (!entry.available) throw new Error("CAD model should be trained");
    const high = predictWithTarget(entry, syntheticDemoPatient("high")).probability;
    const low = predictWithTarget(entry, syntheticDemoPatient("low")).probability;
    expect(high).toBeGreaterThan(low);
  });

  it("evaluates on a held-out test split with defined metrics", () => {
    const entry = artifact.targets.cad;
    if (!entry.available) throw new Error("CAD model should be trained");
    expect(entry.nTest).toBeGreaterThan(10);
    expect(entry.test.rocAuc).not.toBeNull();
    expect(entry.test.accuracy).toBeGreaterThan(0);
    expect(entry.cv.folds).toBeGreaterThanOrEqual(2);
  });
});

describe("explanations", () => {
  it("produces signed, finite contributions for a patient", () => {
    const entry = artifact.targets.lad;
    if (!entry.available) throw new Error("LAD model should be trained");
    const exp = explainPatient(entry, syntheticDemoPatient("high"), 10);
    expect(exp.contributions).toHaveLength(10);
    expect(exp.contributions.every((c) => Number.isFinite(c.contribution))).toBe(true);
    expect(exp.probability).toBeGreaterThanOrEqual(0);
    expect(exp.method.length).toBeGreaterThan(20);
  });

  it("produces a non-empty global importance ranking", () => {
    const entry = artifact.targets.rca;
    if (!entry.available) throw new Error("RCA model should be trained");
    expect(entry.globalImportance.length).toBeGreaterThan(0);
  });
});

describe("request validation", () => {
  it("accepts a valid patient payload", () => {
    expect(patientSchema.safeParse(syntheticDemoPatient("low")).success).toBe(true);
  });

  it("rejects out-of-range and unknown fields", () => {
    expect(patientSchema.safeParse({ age: 500 }).success).toBe(false);
    expect(patientSchema.safeParse({ notAFeature: 1 }).success).toBe(false);
    expect(patientSchema.safeParse({ sex: "unknown" }).success).toBe(false);
  });

  it("detects missing required inputs", () => {
    expect(requiredMissing({})).toContain("age");
    expect(requiredMissing(syntheticDemoPatient("high"))).toHaveLength(0);
  });

  it("declares a feature set that excludes every target column", () => {
    for (const f of FEATURES) expect(isLeakageColumn(f.name)).toBe(false);
  });
});
