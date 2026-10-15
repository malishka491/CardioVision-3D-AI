/**
 * Prints the evaluation report of the currently ACTIVE saved run (no retraining).
 *
 *   npm run evaluate
 */
import "dotenv/config";
import { getActiveRun } from "@/lib/ml/registry";
import { pool } from "@/db";

const fmt = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(d));

async function main() {
  const run = await getActiveRun();
  if (!run) {
    console.log("No active run found. Run `npm run train` first.");
    await pool.end();
    return;
  }
  const a = run.artifact;
  console.log(`Active run #${run.id} — ${a.datasetName} (${a.datasetKind}), ${a.nRows} rows, seed ${a.seed}`);
  console.log(`Excluded leakage columns: ${a.excludedLeakageColumns.join(", ") || "none"}`);
  console.log(`Explanation method: ${a.explanationMethod}\n`);
  for (const [key, entry] of Object.entries(a.targets)) {
    if (!entry.available) {
      console.log(`[${key.toUpperCase()}] UNAVAILABLE — ${entry.reason}`);
      continue;
    }
    console.log(
      `[${key.toUpperCase()}] ${entry.modelLabel} | thr=${entry.threshold} | TEST acc=${fmt(entry.test.accuracy)} prec=${fmt(entry.test.precision)} rec=${fmt(entry.test.recall)} f1=${fmt(entry.test.f1)} auc=${fmt(entry.test.rocAuc)} brier=${fmt(entry.test.brier)} | CV auc=${fmt(entry.cv.aucMean)}±${fmt(entry.cv.aucSd)}`,
    );
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
});
