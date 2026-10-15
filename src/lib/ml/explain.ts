/**
 * Patient-level explanations.
 *
 * SHAP (the Python library) is not available in this JavaScript runtime, so the
 * app implements two documented, model-appropriate additive alternatives:
 *
 *  - Logistic regression: signed log-odds contribution w_j * z_j, where z_j is
 *    the standardised feature value. This is the exact additive decomposition
 *    of the model's log-odds relative to the training-mean patient (identical
 *    to LinearExplainer SHAP values under feature independence).
 *  - Random forest: single-feature ablation — the feature is reset to its
 *    training-median/modal value and the change in predicted log-odds is
 *    recorded. This is a 1-order approximation of a Shapley value, not an exact
 *    Shapley value, and is labelled as such in the UI.
 *
 * Contributions are associations learned by the model, NOT causal effects.
 */
import { FEATURE_BY_KEY } from "./schema";
import { transform, predictOne, applyPlatt, type RawPatient } from "./models";
import type { TargetArtifact } from "./train";

export interface Contribution {
  column: string;
  feature: string;
  label: string;
  value: string;
  contribution: number;
}

export interface Explanation {
  method: string;
  methodShort: string;
  baseProbability: number;
  probability: number;
  contributions: Contribution[];
}

const logit = (p: number) => Math.log(Math.max(p, 1e-6) / Math.max(1 - p, 1e-6));

function prettyValue(patient: RawPatient, key: string): string {
  const def = FEATURE_BY_KEY.get(key);
  const raw = patient[key];
  if (raw === null || raw === undefined || raw === "") return "missing (imputed)";
  if (def?.kind === "binary") return Number(raw) === 1 ? "Yes" : "No";
  return def?.unit ? `${raw} ${def.unit}` : String(raw);
}

export function explainPatient(entry: TargetArtifact, patient: RawPatient, topK = 12): Explanation {
  const pre = entry.preprocessor;
  const x = transform([patient], pre)[0];
  const probability = Math.min(1, Math.max(0, applyPlatt(entry.calibration, predictOne(entry.model, x))));
  const perColumn: Contribution[] = [];

  if (entry.model.kind === "logreg") {
    const w = entry.model.weights;
    entry.featureNames.forEach((name, j) => {
      const col = pre.columns[j];
      const def = FEATURE_BY_KEY.get(col.feature);
      perColumn.push({
        column: name,
        feature: col.feature,
        label: def ? (col.category ? `${def.label} = ${col.category}` : def.label) : name,
        value: prettyValue(patient, col.feature),
        contribution: w[j] * x[j],
      });
    });
  } else {
    const baseLogit = logit(predictOne(entry.model, x));
    const byFeature = new Map<string, number[]>();
    pre.columns.forEach((c, j) => {
      const arr = byFeature.get(c.feature) ?? [];
      arr.push(j);
      byFeature.set(c.feature, arr);
    });
    byFeature.forEach((cols, key) => {
      const ablated = x.slice();
      for (const j of cols) ablated[j] = 0; // 0 == training mean in standardised space
      const delta = baseLogit - logit(predictOne(entry.model, ablated));
      const def = FEATURE_BY_KEY.get(key);
      perColumn.push({
        column: key,
        feature: key,
        label: def?.label ?? key,
        value: prettyValue(patient, key),
        contribution: delta,
      });
    });
  }

  // aggregate one-hot columns of the same feature
  const agg = new Map<string, Contribution>();
  for (const c of perColumn) {
    const prev = agg.get(c.feature);
    if (!prev || Math.abs(c.contribution) > Math.abs(prev.contribution)) agg.set(c.feature, c);
  }
  const contributions = Array.from(agg.values())
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, topK);

  const baseProbability = Math.min(
    1,
    Math.max(0, applyPlatt(entry.calibration, predictOne(entry.model, new Array(x.length).fill(0)))),
  );

  return {
    method:
      entry.model.kind === "logreg"
        ? "Exact additive log-odds decomposition of the L2 logistic-regression model (weight x standardised value), relative to the training-mean patient. Equivalent to a linear SHAP attribution under feature independence."
        : "Single-feature ablation on the fitted random forest: each feature is reset to its training median/mode and the change in predicted log-odds is recorded. A first-order Shapley approximation, not an exact SHAP value.",
    methodShort: entry.model.kind === "logreg" ? "Linear log-odds attribution" : "Forest ablation attribution",
    baseProbability,
    probability,
    contributions,
  };
}
