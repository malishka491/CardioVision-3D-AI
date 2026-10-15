# Dataset — CardioVision 3D

## Intended source

**Z-Alizadeh Sani dataset (extension)** — UCI Machine Learning Repository, ~303 patients, 55 attributes,
collected at Shaheed Rajaei Cardiovascular Center. Attributes span demographics, symptoms/examination,
laboratory results, ECG findings and echocardiography; outcomes are angiographic (`Cath`) with vessel-level
labels (`LAD`, `LCX`, `RCA`).

The project bundle includes `data/Z-Alizadeh-sani-dataset.csv` (303 records, 59 columns). It is used for first-run model bootstrap when no active trained model exists. See [`../data/README.md`](../data/README.md) for details.

## Schema expected by the application

54 feature columns in five groups (demographics & history, vitals & examination, laboratory, ECG, echo) plus the
four target columns. The authoritative list lives in `src/lib/ml/schema.ts` (`FEATURES`, `TARGETS`); the form,
validation schema, preprocessing and dataset mapper are all generated from it.

Column matching is tolerant: case, spaces, underscores and hyphens are ignored, and `Length`/`Height` and
`Sex`/`Gender` are accepted aliases.

## Validation performed on upload

`POST /api/v1/dataset/validate` returns:

- record and column counts, duplicate-row count;
- per-column inferred dtype, missing count and %, distinct values, mean/min/max or top categories;
- which columns were mapped to features, which are ignored, which are **leakage** columns;
- per-target availability: usable rows, positives/negatives, unmapped values and the reason a target cannot be
  trained;
- warnings for small samples, duplicates, imbalance and missing expected columns;
- a `trainable` flag (a target needs ≥ 40 labelled rows with ≥ 8 per class).

File safety: `.csv`/`.txt` only, ≤ 8 MB, ≤ 20,000 rows, parsed in memory, never written to disk or a public
directory. Only the aggregate report is persisted (`dataset_reports`).

## Synthetic fallback cohort

`src/lib/ml/synthetic.ts` generates 420 **simulated** records from a seeded latent risk model: risk factors
(age, sex, diabetes, hypertension, smoking, lipids, blood pressure, renal function) drive a latent disease
score, which in turn drives ECG/echo findings and three correlated vessel-level latents. Marginals and
risk-factor directions were chosen to resemble published descriptions of the real cohort.

This cohort exists so that every screen (training, metrics, explanations, 3D colouring) is demonstrable without
patient data. It is labelled **SYNTHETIC** in the sidebar, the Overview, the prediction badges, the Performance
page and the API responses, and its metrics must never be presented as clinical evidence.

## Class balance (synthetic cohort, seed 20260207)

Reported live on the Dataset Explorer page after validation; for the bundled generator the CAD positive rate is
roughly 0.6–0.65, with LAD ≈ 0.45, LCX ≈ 0.31 and RCA ≈ 0.31 — intentionally imbalanced to exercise the
class-weighting and threshold-tuning code paths.
