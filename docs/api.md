# API reference — `/api/v1`

All endpoints are same-origin Next.js route handlers running on the Node runtime. Requests and responses are
JSON unless stated. Errors use standard status codes and never echo submitted clinical values.

## `GET /api/health`
Platform probe. `200 {"ok":true}` when the database responds.

## `GET /api/v1/health`
```json
{ "service":"CardioVision 3D API","version":"v1","timestamp":"…","database":"ok",
  "modelsReady":true,"activeRunId":2,"datasetKind":"synthetic",
  "targets":{"cad":true,"lad":true,"lcx":true,"rca":true} }
```
`503` when the database is unreachable.

## `GET /api/v1/model-info`
Returns the feature schema (`FeatureDef[]`), group labels, target definitions, leakage policy, active-run
provenance (dataset, seed, excluded columns, explanation method), per-target metadata (model, threshold,
prevalence, split sizes, candidates, CV, validation + test metrics, global importance) and the run history.
Bootstraps a synthetic run if none exists.

## `POST /api/v1/predict`
```jsonc
{ "features": { "age": 67, "sex": "Male", "bp": 148, "ef": 40, "...": "…" },
  "source": "user-entered" }          // or "synthetic-demo"
```
Responses:
- `200` — `{ runId, generatedAt, source, inferenceMode:"trained-model", datasetKind, datasetName,
  explanationMethod, targets: { cad|lad|lcx|rca }, disclaimer }`.
  Each target is either `{available:true, probability, predicted, predictedLabel, threshold, modelLabel,
  modelType, testRocAuc, testBrier, cvAucMean, cvAucSd, prevalence, explanation}` or
  `{available:false, reason}` — never a fabricated value.
- `400` malformed JSON · `422` validation failure (`issues[]`) or missing required inputs (`missing[]`)
  · `503` no trained model · `500` non-finite probability (fails loudly rather than guessing).

Required inputs: `age, sex, bp, pr, fbs, ldl, hdl, ef`. Unknown fields are rejected (strict schema).

## `POST /api/v1/explain`
```jsonc
{ "target": "lad", "features": { … }, "topK": 12 }
```
`200` → `{ target, label, runId, globalImportance[], explanation { method, methodShort, baseProbability,
probability, contributions[] } }`. `404` when that target has no trained model.

## `GET /api/v1/metrics`
Saved evaluation of the active run: per-target validation and test `MetricSet` (accuracy + Wilson CI,
precision, recall, specificity, F1, ROC-AUC, PR-AUC, Brier, confusion matrix, ROC/PR curves, calibration bins,
notes), CV summary and candidate comparison.

## `POST /api/v1/train`
- JSON `{ "mode":"synthetic" }` — retrain on the labelled synthetic cohort.
- JSON `{ "csv":"…","fileName":"…" }` or `multipart/form-data` with a `file` field — train on an upload.

`200` → `{ runId, createdAt, datasetName, datasetKind, nRows, targets }` and the run becomes active.
`413` too large · `422` no trainable target (returns the validation report) · `500` training failure.

## `POST /api/v1/dataset/validate`
Same payload options as `/train`. `200` → `{ report }` (see `docs/dataset.md`).
`413`/`415`/`422` for oversized, wrong-type or unparsable files.

## CORS
The UI and API share an origin, so no CORS headers are required. To call the API from another origin, add an
`async headers()` entry for `/api/:path*` in `next.config.ts` with an explicit allow-list — never `*` for a
clinical prototype.
