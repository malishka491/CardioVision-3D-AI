# Model evaluation report

**Scope of this report.** Every number below was produced by `npm run train` in this repository and copied from
the CLI output of the referenced run. Nothing is hand-edited or estimated. The Model Performance page renders
the same artifact live (plus confusion matrices, ROC/PR curves, calibration bins, Wilson CIs and the
candidate-model table).

---

## A. Active run — REAL dataset (UCI Z-Alizadeh Sani extension)

| Item | Value |
| --- | --- |
| Run | #1 (active) |
| Dataset | `data/Z-Alizadeh-sani-dataset.csv` — UCI "extention of Z-Alizadeh sani dataset" (id 411), 303 records, 59 columns, 0 duplicates |
| Targets | `Cath` (CAD/Normal), `LAD`, `LCX`, `RCA` (Stenotic/Normal) |
| Seed | 20260207 |
| Split | stratified 60/20/20 → ≈182 train / 60 val / 61 test per target |
| Cross-validation | 5-fold stratified over train+validation |
| Leakage columns excluded from inputs | `LAD`, `LCX`, `RCA`, `Cath` |

### Held-out test results (thresholds tuned on validation only)

| Target | Selected model | Thr | Accuracy | Precision | Recall | F1 | ROC-AUC | Brier | CV ROC-AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAD | Logistic regression (stronger L2) | 0.70 | 0.869 | 0.973 | 0.837 | 0.900 | **0.943** | 0.095 | 0.902 ± 0.056 |
| LAD | Logistic regression (stronger L2) | 0.44 | 0.738 | 0.700 | 0.972 | 0.814 | **0.856** | 0.168 | 0.815 ± 0.051 |
| LCX | Random forest (balanced, 80 trees) | 0.35 | 0.721 | 0.606 | 0.833 | 0.702 | **0.769** | 0.193 | 0.718 ± 0.097 |
| RCA | Logistic regression (class-weighted) | 0.30 | 0.656 | 0.536 | 0.652 | 0.588 | **0.706** | 0.212 | 0.735 ± 0.055 |

Confusion matrices (test split): CAD tn=17 fp=1 fn=7 tp=36 · LAD tn=10 fp=15 fn=1 tp=35 ·
LCX tn=24 fp=13 fn=4 tp=20 · RCA tn=25 fp=13 fn=8 tp=15.

### Interpretation

- **CAD** discriminates strongly (test AUC 0.943, CV 0.902 ± 0.056), in line with the published literature on
  this dataset. Precision 0.973 at the 0.70 threshold means almost no false-positive CAD calls on this split.
- **Vessel-specific targets are harder**, and get progressively harder from LAD → LCX → RCA — the expected
  pattern, since LAD disease dominates the cohort (58 % prevalence) while RCA labels are scarcer and noisier.
- Sensitivity-weighted thresholds deliberately trade precision for recall on the vessel targets (e.g. LAD
  recall 0.972 at precision 0.700) — a screening-style operating point.
- With only ~61 test records per target, one patient ≈ 1.6 % accuracy; treat all values as **preliminary**,
  single-centre estimates. The CV column is the more stable discrimination estimate.
- These results are from a single fixed seed with no test-set reuse; thresholds, calibration and model
  selection used validation data only.

---

## B. Previous run — SYNTHETIC cohort (run #2, superseded)

Kept for transparency: before the UCI file was fetched, the pipeline was validated end-to-end on the bundled
**simulated** cohort (420 rows). Those numbers (CAD test AUC 0.677, CV 0.729 ± 0.071, etc.) describe the
synthetic generator, not real patients, and are now superseded by section A.

---

## Reproducing

```bash
npx drizzle-kit push
npm run train -- data/Z-Alizadeh-sani-dataset.csv   # section A
npm run evaluate                                     # re-print active-run metrics
npm test                                             # 22 automated checks
```

If `data/Z-Alizadeh-sani-dataset.csv` is missing, follow `data/README.md` (UCI id 411, convert the first
worksheet of the `.xlsx` to CSV). All randomness is seeded; identical input reproduces identical metrics.
