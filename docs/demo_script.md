# Demonstration video script (7–9 minutes)

Recording plan: 1920×1080, dark room UI, browser zoom 100 %, one continuous take per scene.

## Scene 1 — Title & framing (0:00–0:35)
*Screen:* Overview dashboard, sidebar visible.
*Say:* "CardioVision 3D, Track A. An end-to-end clinical decision-support prototype: it trains four models —
overall CAD plus LAD, LCX and RCA stenosis — serves them over a REST API, explains them, and projects the
vessel probabilities onto an interactive 3D coronary view. Everything you will see runs locally."
*Point out:* status chip "Models ready", the amber "Synthetic training data" badge, the permanent disclaimer bar.

## Scene 2 — Honest data story (0:35–1:40)
*Screen:* Dataset Explorer → upload a CSV → validation report.
*Say:* "The intended dataset is Z-Alizadeh Sani, 303 patients. It is not bundled, so the app ships a clearly
labelled synthetic cohort. Upload any compatible CSV and the inspector reports rows, dtypes, missingness,
duplicates, class balance and target availability."
*Point out:* the leakage row — `Cath`, `LAD`, `LCX`, `RCA` flagged **target / excluded**; warnings list.
*Action:* click **Train** and show the new active run id.

## Scene 3 — Training & leakage guard (1:40–2:30)
*Screen:* terminal running `npm run train`.
*Say:* "The same pipeline runs from the CLI: stratified 60/20/20 splits, class weights, candidate models,
validation-tuned thresholds, Platt calibration, 5-fold CV. The input matrix is built only from the 54 declared
clinical features, so angiography columns can never leak."

## Scene 4 — Patient assessment (2:30–3:45)
*Screen:* Patient Assessment.
*Action:* click **Load synthetic demo (higher risk)** → note the amber synthetic banner → **Run prediction**.
*Say:* "Fields are validated client- and server-side with the same schema. The record is marked synthetic so it
can never be mistaken for a real patient."
*Point out:* CAD card — probability, classification at the configured threshold, timestamp, test AUC, CV AUC ±
SD, Brier score, and the note separating probability from certainty.

## Scene 5 — Vessel cards & 3D sync (3:45–5:15)
*Screen:* vessel cards → click "Inspect in 3D view" on LAD.
*Action:* rotate with the mouse, zoom with the scroll wheel, hover an artery, click LCX, press **Reset camera**,
toggle the transparent torso.
*Say:* "Artery colour is driven by the model probability — teal, amber, red — and the number is always shown
next to it. Selection is synchronised between the dashboard, the accessible vessel list and the 3D mesh."
*Point out:* the integrity statement — whole arteries are highlighted; no lesion location is invented.

## Scene 6 — Explainability (5:15–6:30)
*Screen:* Explainability page, switch target CAD → LAD.
*Say:* "Global permutation importance on the left, the patient-specific additive attribution on the right.
SHAP's Python library is unavailable in this runtime, so we implement the exact linear log-odds decomposition
for the logistic models and an ablation attribution for the forest — and we say so in the UI. These are
associations, not causal effects."
*Point out:* the narrative summary sentence.

## Scene 7 — Model performance (6:30–7:40)
*Screen:* Model Performance page.
*Say:* "Nothing here is hardcoded. Accuracy with a Wilson interval, precision, recall, F1, ROC-AUC, Brier,
ROC and precision-recall curves, calibration bins, confusion matrix and the candidate-model comparison — all
read from the saved artifact of the active run."
*Point out:* the amber synthetic-data warning and the small-sample caveat.

## Scene 8 — Safety, tests, close (7:40–8:40)
*Screen:* About & Safety, then terminal `npm test` and `npm run build`.
*Say:* "Uploads stay in memory, the audit log stores probabilities only, no data leaves the machine, and the
disclaimer is always visible. 22 automated tests cover leakage prevention, preprocessing consistency, unseen
categories, metric edge cases, probability bounds, missing targets and request validation. The production build
passes."
*Close:* "CardioVision 3D — honest machine learning, interpretable output, and an anatomy view that never
claims more than the data supports."
