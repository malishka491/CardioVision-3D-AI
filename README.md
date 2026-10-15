# CardioVision 3D — AI-Powered Cardiovascular Risk Prediction & Visualization

**Multimodal AI Hackathon 2026 — Track A: Cardiovascular Risk Visualization & Prediction**

CardioVision 3D is an end-to-end, locally-run clinical **decision-support prototype**. It trains four binary
classifiers from tabular clinical data (overall CAD, LAD, LCX and RCA stenosis), serves them through a versioned
REST API, explains every prediction, and maps the vessel-level probabilities onto an interactive 3D coronary
schematic.

> **Clinical disclaimer** — CardioVision 3D is an experimental AI research and educational prototype. Its
> predictions are not a medical diagnosis and must not be used as a substitute for professional clinical
> assessment, coronary imaging, or medical advice. Model performance and generalizability may be limited by
> dataset size, quality, and population differences.

---

## 1. Implementation note (important, read first)

The original brief proposed a **Vite + React frontend with a Python/FastAPI backend**. This workspace is a
**Next.js (App Router) + TypeScript + PostgreSQL** sandbox with **no Python runtime**. Rather than ship a
non-runnable Python skeleton, the whole stack was implemented natively in TypeScript:

| Brief | Implemented here | Why |
| --- | --- | --- |
| Vite + React + Tailwind + R3F | Next.js 16 App Router + React 19 + Tailwind 4 + React Three Fiber / drei | Same React/Three stack, single process |
| FastAPI REST API | Next.js Route Handlers under `/api/v1/*` | Same REST contract, same paths |
| Pydantic validation | **Zod** schemas (`src/lib/validation.ts`) | Equivalent structured validation + 422 errors |
| scikit-learn pipelines | Hand-written, dependency-free estimators (`src/lib/ml/models.ts`): L2 logistic regression, balanced random forest, Platt calibration | No Python available; fully auditable TS implementations |
| joblib model files | Fitted pipelines serialised to JSON in PostgreSQL (`training_runs.artifact`) | Models are saved once and **loaded** for inference, never retrained per request |
| SHAP | Permutation importance (global) + exact additive log-odds attribution / forest ablation (local) | SHAP is a Python library; the alternative is documented and **labelled in the UI** |
| pytest | **Vitest** (`tests/pipeline.test.ts`, 22 tests) | Same coverage targets |
| Swagger UI | `docs/api.md` + `GET /api/v1/model-info` self-describing metadata | No FastAPI autodocs without Python |

Everything else in the brief — leakage control, stratified splits, calibration, threshold tuning, honest metrics,
3D interaction, optional synthetic demo mode, privacy safeguards — is implemented as specified.

---

## 2. Main features

- **Four independent target pipelines**: CAD (`Cath`), LAD, LCX, RCA — each with its own preprocessing, model
  selection, calibrated probabilities and validation-tuned threshold.
- **Hard leakage guard**: `Cath`, `LAD`, `LCX`, `RCA` (plus aliases) can never enter a model input matrix.
- **Dataset Explorer**: CSV upload, schema mapping, dtype inference, missingness, duplicates, class balance,
  target availability, warnings, and one-click retraining.
- **Patient Assessment**: 54-field validated clinical form, synthetic demo patients, end-to-end inference.
- **3D Anatomy Explorer**: rotate / zoom / reset, hover highlight, click-to-inspect arteries, transparent torso
  toggle, accessible vessel list, probability-driven colour + numeric labels.
- **Explainability**: global permutation importance and signed per-patient contributions with narrative summary.
- **Model Performance**: accuracy (with Wilson 95% CI), precision, recall, specificity, F1, ROC-AUC, PR curve,
  Brier score, calibration bins, confusion matrix, cross-validated AUC ± SD, candidate-model table.
- **Honesty guarantees**: nothing is hardcoded; unavailable targets render “Prediction unavailable”; synthetic
  training data is labelled everywhere it is used.

---

## 3. Architecture

```mermaid
flowchart TD
    subgraph Browser["Browser — React 19 / Next.js App Router"]
        OV[Overview dashboard]
        AN[3D Anatomy Explorer<br/>React Three Fiber]
        AS[Patient Assessment<br/>react-hook-form + Zod]
        EX[Explainability]
        PF[Model Performance]
        DS[Dataset Explorer]
        AB[About & Safety]
        CTX[(AppProvider<br/>shared prediction +<br/>vessel selection state)]
    end

    subgraph API["Next.js Route Handlers — /api/v1"]
        H[GET /health]
        MI[GET /model-info]
        PR[POST /predict]
        EXP[POST /explain]
        ME[GET /metrics]
        TR[POST /train]
        DV[POST /dataset/validate]
    end

    subgraph ML["TypeScript ML core — src/lib/ml"]
        SCH[schema.ts<br/>features, targets, leakage list, CSV parser]
        INS[inspect.ts<br/>dataset report]
        PRE[models.ts<br/>impute, one-hot, scale]
        MOD[models.ts<br/>logistic regression / random forest / Platt]
        TRN[train.ts<br/>stratified split, CV, threshold, metrics]
        EXL[explain.ts<br/>permutation + additive attribution]
        SYN[synthetic.ts<br/>labelled simulated cohort]
    end

    DB[(PostgreSQL via Drizzle<br/>training_runs · assessments · dataset_reports)]

    OV & AN & AS & EX & PF & DS --> CTX
    CTX --> MI & PR & ME
    DS --> DV & TR
    EX --> EXP
    PR & EXP & ME & MI --> DB
    TR --> TRN --> DB
    TRN --> PRE & MOD & SCH
    DV --> INS
    PR --> EXL
    TR -. no CSV .-> SYN
```

---

## 4. Technology stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, React Three Fiber + drei + three,
  Recharts, lucide-react, react-hook-form + @hookform/resolvers, Zod.
- **Backend**: Next.js Route Handlers (Node runtime), Zod validation, Drizzle ORM, PostgreSQL.
- **ML**: custom TypeScript implementations — median/mode imputation, one-hot encoding, z-score scaling,
  L2 logistic regression (class-weighted), balanced random forest (CART/Gini), Platt calibration,
  permutation importance.
- **Testing**: Vitest.

---

## 5. Supported dataset & target columns

**Z-Alizadeh Sani (extension)** dataset — UCI Machine Learning Repository, ~303 records, 55 clinical features.

| Target | Column | Positive label | Negative label |
| --- | --- | --- | --- |
| Overall CAD | `Cath` | `Cad` | `Normal` |
| LAD stenosis | `LAD` | `Stenotic` | `Normal` |
| LCX stenosis | `LCX` | `Stenotic` | `Normal` |
| RCA stenosis | `RCA` | `Stenotic` | `Normal` |

`1/0`, `Yes/No` and `Positive/Negative` encodings are also accepted. Feature columns are matched
case/space/underscore-insensitively (`EX-Smoker`, `ex smoker`, `EX_Smoker` all match). Missing expected columns
are reported and imputed; **missing targets are reported as unavailable and never invented.**

### Dataset acquisition

The dataset is **not bundled** (licensing + privacy). Download it yourself:

1. UCI (**extension** version, includes LAD/LCX/RCA): <https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset>
   or a legitimate Kaggle mirror of the same file. The original (id 412) lacks the vessel columns.
2. Convert the `.xlsx` to CSV if needed (keep the original header row).
3. Save it as `data/Z-Alizadeh-sani-dataset.csv` (the `data/` directory is git-ignored).

If it is absent, the app falls back to a **clearly-labelled synthetic cohort** generated in
`src/lib/ml/synthetic.ts` so every screen is still demonstrable. In this workspace the extension file has
already been fetched from UCI, converted to CSV and used to train the active run (see
`docs/model_evaluation.md`); the CSV lives in `data/` which is git-ignored.

---

## 6. Setup

### Prerequisites

- Node.js 20+ (22 recommended)
- PostgreSQL 14+ running locally

### Windows PowerShell

```powershell
git clone <your-repo-url> cardiovision-3d
cd cardiovision-3d
npm install

Copy-Item .env.example .env
# edit .env and set DATABASE_URL, e.g.
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

npx drizzle-kit push        # create training_runs / assessments / dataset_reports
npm run train               # train on the synthetic cohort (or pass a CSV path)
npm run dev                 # http://localhost:3000
```

### macOS / Linux (bash)

```bash
npm install
cp .env.example .env
npx drizzle-kit push
npm run train
npm run dev
```

### Production

```bash
npm run build
npm run start
```

---

## 7. Model training & evaluation commands

```bash
# Train every available target on the SYNTHETIC cohort and activate the run
npm run train

# Train on the real dataset (Windows PowerShell)
npm run train -- data\Z-Alizadeh-sani-dataset.csv
# bash
npm run train -- data/Z-Alizadeh-sani-dataset.csv

# Print the evaluation report of the active saved run (no retraining)
npm run evaluate

# Automated tests (leakage, preprocessing, metrics, inference, explanations, validation)
npm test

# Type generation / type check / production build
npx next typegen
npm run typecheck
npm run build
```

Training is also available in the UI: **Dataset Explorer → upload CSV → validate → Train**, or
**Retrain on synthetic cohort**. Both paths call `POST /api/v1/train` and activate the new run.

### Reproducing evaluation results

All randomness is seeded (`seed = 20260207`, stored in the artifact and shown on the Performance page):
stratified 60/20/20 split, stratified k-fold CV, bootstrap sampling and permutation importance all derive from
that seed. Re-running `npm run train` on the same input reproduces the same numbers; the Performance page always
renders the metrics stored in the active artifact, never hardcoded values.

---

## 8. Using the application

1. **Dataset Explorer** — upload your CSV, read the schema/missingness/class-balance report, click **Train**.
2. **Patient Assessment** — fill the form (or load a clearly-marked synthetic demo patient) → **Run prediction**.
3. **Overview** — CAD probability, vessel cards, timestamp, data-source badge, 3D snapshot.
4. **3D Anatomy Explorer** — rotate/zoom/reset, click LAD/LCX/RCA (or use the accessible panel) to inspect
   probability, threshold, predicted class and the strongest contributing features.
5. **Explainability** — switch target, compare global importance with the patient-specific attribution.
6. **Model Performance** — ROC, PR, calibration, confusion matrix, CV AUC, candidate-model comparison.
7. **About & Safety** — methodology, provenance, limitations, disclaimer.

---

## 9. API

Base path `/api/v1` (plus the platform health probe `GET /api/health`). Full request/response contracts:
[`docs/api.md`](docs/api.md).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | API, database and per-target model readiness |
| GET | `/api/v1/model-info` | feature schema, thresholds, metrics, leakage policy, run history |
| POST | `/api/v1/predict` | CAD + vessel probabilities with per-target explanations |
| POST | `/api/v1/explain` | explanation for one target (global + local) |
| GET | `/api/v1/metrics` | saved evaluation results of the active run |
| POST | `/api/v1/train` | train on an uploaded CSV or the synthetic cohort |
| POST | `/api/v1/dataset/validate` | dataset inspection + validation report |

CORS: the API is served from the same origin as the UI, so no cross-origin configuration is required. To expose
it to another origin, add the headers in `next.config.ts` for the `/api/:path*` matcher.

---

## 10. Extending the project

**Add or replace a model**: implement `train*` / `predict*` in `src/lib/ml/models.ts`, add it to the
`candidateDefs` array in `src/lib/ml/train.ts`, and (if it is not linear) extend the local-attribution branch in
`src/lib/ml/explain.ts`. Serialisation is automatic because every model is a plain JSON object.

**Add a clinical feature**: append a `FeatureDef` to `FEATURES` in `src/lib/ml/schema.ts` (name = exact CSV
header, key, label, kind, group, unit, min/max, default). The form, Zod schema, preprocessing, explanations and
dataset mapping all derive from that single list. Retrain afterwards.

**Add a target**: add a `TargetDef` to `TARGETS`, add the column name to `LEAKAGE_COLUMNS`, retrain.

**Anatomical asset attribution**: no third-party 3D asset is bundled. The torso/heart/coronary tree is a
procedurally generated **schematic** authored for this project from Three.js primitives and Catmull-Rom tube
curves. To use a licensed anatomical model, drop `heart.glb` into `public/models/`, load it with `useGLTF`
inside `src/components/Heart3D.tsx` in place of `HeartBody`, keep the vessel colour mapping, and record the
asset licence/attribution here and on the About page.

---

## 11. Privacy & clinical safety

- No real patient data is required to run or demo the application.
- Uploaded CSVs are parsed **in memory only** — never written to disk or to `public/`; only aggregate reports are
  persisted (`dataset_reports`).
- The prediction audit log (`assessments`) stores probabilities + run id only — **never** the submitted clinical
  values; nothing patient-identifying is logged or returned in error messages.
- Uploads are limited to `.csv`/`.txt`, 8 MB and 20,000 rows; malformed files are rejected with 4xx errors.
- No external network calls, no API keys, no secrets in code (`DATABASE_URL` comes from `.env`).
- The app never issues diagnosis, treatment, medication or emergency-care advice; colour bands are model
  probability bands, not validated clinical risk categories.

---

## 12. Known limitations & troubleshooting

**Limitations**

- Small-sample regime (~303 real / 420 synthetic rows): wide confidence intervals, preliminary metrics.
- Tabular data supports **vessel-level status only** — no lesion location, geometry or plaque burden is inferred
  or rendered.
- Single-centre source data; generalisability to other populations is unknown.
- Attributions are associations, not causal effects, and are unstable under correlated features.
- Estimators are compact TypeScript implementations; results may differ slightly from scikit-learn.
- The 3D heart is schematic, not an anatomical reconstruction.

**Troubleshooting**

| Symptom | Fix |
| --- | --- |
| `DATABASE_URL is required` | create `.env` from `.env.example` |
| Status chip shows “No trained model” | run `npm run train` or use Dataset Explorer → Retrain |
| `relation "training_runs" does not exist` | run `npx drizzle-kit push` |
| Training rejects the CSV | check the Dataset Explorer report: targets need ≥40 labelled rows and ≥8 per class |
| 3D canvas blank | update GPU drivers / enable WebGL; the rest of the app still works |
| `npm run train -- file.csv` not found | pass a path relative to the project root; keep the original header row |

---

## 13. Project structure

```
.
├── src/
│   ├── app/                     # pages + API route handlers
│   │   ├── page.tsx             # Overview dashboard
│   │   ├── anatomy/             # 3D Anatomy Explorer
│   │   ├── assessment/          # Patient Assessment workflow
│   │   ├── explainability/      # Global + local explanations
│   │   ├── performance/         # Evaluation dashboard
│   │   ├── dataset/             # Dataset upload / validation / training
│   │   ├── about/               # Methodology, provenance, safety
│   │   └── api/
│   │       ├── health/          # platform probe
│   │       └── v1/              # health, model-info, predict, explain, metrics, train, dataset/validate
│   ├── components/              # AppShell, providers, Heart3D, charts, cards, ui primitives
│   ├── lib/
│   │   ├── ml/                  # schema, synthetic, models, train, metrics, explain, inspect, registry
│   │   ├── validation.ts        # Zod request schemas
│   │   ├── upload.ts            # safe CSV intake
│   │   └── constants.ts         # disclaimer, vessel metadata, colour scale
│   ├── db/                      # Drizzle client + schema
│   └── types/                   # shared API types
├── scripts/                     # train.ts, evaluate.ts (CLI)
├── tests/                       # Vitest suite
├── docs/                        # methodology, dataset, model_evaluation, demo_script, api
├── data/README.md               # dataset acquisition instructions (data itself git-ignored)
└── .env.example
```
