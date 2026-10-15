/**
 * CLI training script.
 *
 *   npm run train                      # train on the bundled real Track A dataset
 *   npm run train -- data/Z-Alizadeh-sani-dataset.csv
 *
 * Fits all available target pipelines, prints the evaluation report and stores
 * the artifact in PostgreSQL as the new active run.
 */
import "dotenv/config";
import fs from "node:fs";
import { parseCsv } from "@/lib/ml/schema";
import { inspectDataset } from "@/lib/ml/inspect";
import { trainArtifact } from "@/lib/ml/train";
import { saveRun } from "@/lib/ml/registry";
import { pool } from "@/db";

const fmt = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(d));

async function main() {
  const file = process.argv[2] ?? "data/Z-Alizadeh-sani-dataset.csv";
  let headers: string[];
  let rows: ReturnType<typeof parseCsv>["rows"];
  const datasetName = file;
  const datasetKind: "uploaded" = "uploaded";

  if (!fs.existsSync(file)) {
    throw new Error(`Dataset file not found: ${file}. Supply the Track A CSV path explicitly if it is stored elsewhere.`);
  }
  const parsed = parseCsv(fs.readFileSync(file, "utf8"));
  headers = parsed.headers;
  rows = parsed.rows;
  console.log(`Training on dataset file: ${file}`);

  const report = inspectDataset(datasetName, headers, rows);
  console.log(`\nDataset: ${datasetName}\n  rows=${report.nRows} cols=${report.nColumns} duplicates=${report.duplicateRows}`);
  console.log(`  leakage columns excluded from inputs: ${report.leakageColumns.join(", ") || "none"}`);
  report.warnings.forEach((w) => console.log(`  ! ${w}`));
  if (!report.trainable) throw new Error("No trainable target in this dataset.");

  const artifact = trainArtifact(headers, rows, { datasetName, datasetKind });
  for (const [key, entry] of Object.entries(artifact.targets)) {
    if (!entry.available) {
      console.log(`\n[${key.toUpperCase()}] UNAVAILABLE — ${entry.reason}`);
      continue;
    }
    console.log(`\n[${key.toUpperCase()}] ${entry.modelLabel}`);
    console.log(`  split train/val/test = ${entry.nTrain}/${entry.nVal}/${entry.nTest}, prevalence=${fmt(entry.prevalence)}`);
    console.log(`  threshold (validation-tuned) = ${entry.threshold}`);
    console.log(`  CV ROC-AUC = ${fmt(entry.cv.aucMean)} ± ${fmt(entry.cv.aucSd)} (${entry.cv.folds} folds)`);
    console.log(
      `  TEST  acc=${fmt(entry.test.accuracy)} prec=${fmt(entry.test.precision)} rec=${fmt(entry.test.recall)} f1=${fmt(entry.test.f1)} auc=${fmt(entry.test.rocAuc)} brier=${fmt(entry.test.brier)}`,
    );
    const cm = entry.test.confusion;
    console.log(`  confusion: tn=${cm.tn} fp=${cm.fp} fn=${cm.fn} tp=${cm.tp}`);
    entry.test.notes.forEach((n) => console.log(`  note: ${n}`));
  }

  const run = await saveRun(artifact, true);
  console.log(`\nSaved artifact as active run #${run.id}.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
});
