import type { MetricSet } from "@/lib/ml/metrics";
import type { FeatureDef, TargetKey } from "@/lib/ml/schema";
import type { Explanation } from "@/lib/ml/explain";
import type { DatasetReport } from "@/lib/ml/inspect";

export type { MetricSet, FeatureDef, TargetKey, Explanation, DatasetReport };

export interface TargetSummary {
  key: TargetKey;
  label: string;
  available: true;
  modelType: "logreg" | "forest";
  modelLabel: string;
  threshold: number;
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

export interface TargetUnavailable {
  key: TargetKey;
  label: string;
  available: false;
  reason: string;
}

export type TargetInfo = TargetSummary | TargetUnavailable;

export interface ModelInfo {
  modelsReady: boolean;
  message?: string;
  run?: {
    id: number;
    createdAt: string;
    datasetName: string;
    datasetKind: "synthetic" | "uploaded";
    nRows: number;
    seed: number;
    featureColumnsUsed: string[];
    missingFeatureColumns: string[];
    excludedLeakageColumns: string[];
    explanationMethod: string;
  };
  leakagePolicy?: string[];
  features: FeatureDef[];
  groups: Record<string, string>;
  targets: Record<string, TargetInfo>;
  runs?: { id: number; createdAt: string; datasetName: string; datasetKind: string; nRows: number; isActive: boolean }[];
}

export interface TargetPrediction {
  key: TargetKey;
  label: string;
  shortLabel: string;
  available: true;
  probability: number;
  predicted: 0 | 1;
  predictedLabel: string;
  threshold: number;
  modelLabel: string;
  modelType: "logreg" | "forest";
  testRocAuc: number | null;
  testBrier: number | null;
  cvAucMean: number | null;
  cvAucSd: number | null;
  prevalence: number;
  explanation: Explanation;
}

export interface TargetPredictionUnavailable {
  key: TargetKey;
  label: string;
  shortLabel: string;
  available: false;
  reason: string;
}

export type PredictionEntry = TargetPrediction | TargetPredictionUnavailable;

export interface PredictionResponse {
  runId: number;
  generatedAt: string;
  source: "user-entered" | "synthetic-demo";
  inferenceMode: "trained-model";
  datasetKind: "synthetic" | "uploaded";
  datasetName: string;
  explanationMethod: string;
  targets: Record<string, PredictionEntry>;
  disclaimer: string;
}

export interface MetricsResponse {
  runId: number;
  createdAt: string;
  datasetName: string;
  datasetKind: "synthetic" | "uploaded";
  nRows: number;
  seed: number;
  explanationMethod: string;
  excludedLeakageColumns: string[];
  targets: Record<string, TargetInfo>;
}
