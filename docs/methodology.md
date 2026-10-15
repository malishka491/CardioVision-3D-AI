# Methodology — CardioVision 3D

## 1. Problem framing

Four independent binary classification problems are learned from the same tabular clinical record:

| Target | Question | Source column |
| --- | --- | --- |
| CAD | Does this patient have coronary artery disease on angiography? | `Cath` |
| LAD | Is the left anterior descending artery stenotic? | `LAD` |
| LCX | Is the left circumflex artery stenotic? | `LCX` |
| RCA | Is the right coronary artery stenotic? | `RCA` |

Each target gets its **own** preprocessing fit, model selection, calibration and decision threshold. A target
with insufficient or absent labels is reported as *unavailable*; no labels are ever invented.

## 2. Leakage control

`src/lib/ml/schema.ts` declares `LEAKAGE_COLUMNS = [cath, lad, lcx, rca, cad, target, label, class, …]`.
The design makes leakage structurally impossible: the input matrix is built **only** from the declared
`FEATURES` list (54 clinical variables), which is disjoint from the target columns. The dataset inspector also
reports every leakage column it detects, and a unit test asserts that no encoded column name starts with a
target name.

## 3. Preprocessing

1. **Type coercion** — `Y/N`, `Yes/No`, `True/False`, blank/`NA`/`?` are normalised; invalid numerics become
   missing rather than silently 0.
2. **Imputation** — numeric/binary: training-split **median**; categorical: training-split **mode**.
3. **Encoding** — categoricals (`Sex`, `BBB`, `VHD`) are one-hot encoded against the declared level list, so an
   unseen level simply yields an all-zero block instead of crashing.
4. **Scaling** — z-score standardisation using the training mean/SD (SD floored at 1e-8).

All statistics are fitted on the training split only and re-fitted inside every cross-validation fold.

## 4. Splitting & resampling

- Stratified **60 / 20 / 20** train / validation / test split with a fixed seed (`20260207`).
- Stratified **k-fold cross-validation** (k ≤ 5, reduced automatically when the minority class is small) over
  train + validation. The test split is never used for selection, tuning or calibration.
- Class imbalance is handled with **class weights** (`n / 2·n_class`) inside the training split — no resampling
  across split boundaries, so no information leaks between folds.

## 5. Candidate models

| Candidate | Description |
| --- | --- |
| `logreg_l2` | Logistic regression, L2 = 0.05, class-weighted, batch gradient descent (800 iterations) |
| `logreg_strong` | Logistic regression, L2 = 0.30 (stronger shrinkage for the small-sample regime) |
| `random_forest` | 80 bootstrap CART trees, Gini impurity, depth ≤ 6, `mtry = √p`, class-weighted leaves |

Selection is by **validation ROC-AUC** with a small tie-break bonus for the interpretable linear model
(clinical-risk consideration: prefer the simpler, auditable model unless the complex one is clearly better).
Gradient boosting was deliberately omitted — with ~300 rows it overfits and offers no measurable benefit over a
depth-limited forest.

## 6. Calibration & thresholds

- **Platt (sigmoid) calibration** is fitted on the validation predictions and applied at inference.
- The **decision threshold** maximises a sensitivity-weighted Youden criterion
  (`1.15 · sensitivity + specificity`) on the validation split, reflecting the higher cost of a missed stenosis.
- Calibration quality is reported with the **Brier score** and 5-bin reliability points on the **test** split.

## 7. Evaluation

Accuracy (with Wilson 95% CI), precision, recall/sensitivity, specificity, F1, ROC-AUC, average precision,
Brier score, confusion matrix, ROC curve, PR curve, calibration bins, and cross-validated AUC ± SD.
Undefined metrics (single-class split, no positive predictions) return `null` with an explanatory note instead
of crashing or silently printing 0.

## 8. Explainability

- **Global** — permutation importance: mean drop in validation ROC-AUC over 3 shuffles per feature.
- **Local, logistic regression** — exact additive decomposition `wⱼ · zⱼ` of the predicted log-odds relative to
  the training-mean patient (equals linear SHAP under feature independence).
- **Local, random forest** — single-feature ablation: reset the feature to its training median/mode and record
  the change in predicted log-odds (first-order Shapley approximation, labelled as such).

The UI states the method used and warns that contributions are associations, not causal effects.

## 9. Persistence & inference

`trainArtifact()` produces a JSON artifact (preprocessor state + model parameters + calibrator + thresholds +
feature schema + metrics + importances + run configuration) stored in `training_runs.artifact`. Prediction
requests **load** the active artifact (cached in process) and score the patient — training never happens inside
a prediction request.

## 10. 3D visualisation integrity

Vessel probabilities colour whole arteries (teal < 34 %, amber 34–66 %, red ≥ 67 %) and are always accompanied
by the numeric value, so the interface does not depend on colour perception. Because tabular data cannot
localise a lesion, **no** blockage geometry, plaque volume or lesion position is rendered.
