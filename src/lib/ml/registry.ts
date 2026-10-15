import { desc, eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { trainingRuns } from "@/db/schema";
import { trainArtifact, type Artifact, type TargetArtifact, type TargetEntry } from "./train";
import { generateSyntheticCohort, SYNTHETIC_DATASET_NAME } from "./synthetic";
import { parseCsv } from "./schema";
import type { Row } from "./schema";

export interface LoadedRun {
  id: number;
  createdAt: string;
  artifact: Artifact;
}

const cache = new Map<number, Artifact>();
let bootstrapping: Promise<LoadedRun | null> | null = null;

export async function getActiveRun(): Promise<LoadedRun | null> {
  const rows = await db.select().from(trainingRuns).where(eq(trainingRuns.isActive, true)).orderBy(desc(trainingRuns.id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const artifact = (cache.get(row.id) ?? (row.artifact as Artifact)) as Artifact;
  cache.set(row.id, artifact);
  return { id: row.id, createdAt: row.createdAt.toISOString(), artifact };
}

export async function listRuns() {
  const rows = await db.select().from(trainingRuns).orderBy(desc(trainingRuns.id)).limit(20);
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    datasetName: r.datasetName,
    datasetKind: r.datasetKind,
    nRows: r.nRows,
    isActive: r.isActive,
  }));
}

export async function saveRun(artifact: Artifact, activate = true): Promise<LoadedRun> {
  if (activate) {
    await db.update(trainingRuns).set({ isActive: false });
  }
  const inserted = await db
    .insert(trainingRuns)
    .values({
      datasetName: artifact.datasetName,
      datasetKind: artifact.datasetKind,
      nRows: artifact.nRows,
      isActive: activate,
      artifact,
    })
    .returning({ id: trainingRuns.id, createdAt: trainingRuns.createdAt });
  const row = inserted[0];
  cache.set(row.id, artifact);
  return { id: row.id, createdAt: row.createdAt.toISOString(), artifact };
}

export function syntheticRows(): { headers: string[]; rows: Row[] } {
  const rows = generateSyntheticCohort(420);
  const headers = Object.keys(rows[0] ?? {});
  return { headers, rows };
}

/**
 * Train on the bundled real Track A CSV if no active model exists.
 * Synthetic records are intentionally not used as the first-run default.
 */
export async function ensureRun(): Promise<LoadedRun | null> {
  const existing = await getActiveRun();
  if (existing) return existing;
  if (!bootstrapping) {
    bootstrapping = (async () => {
      const datasetPath = path.join(process.cwd(), "data", "Z-Alizadeh-sani-dataset.csv");
      if (!fs.existsSync(datasetPath)) {
        throw new Error(
          `Track A dataset not found at ${datasetPath}. Restore data/Z-Alizadeh-sani-dataset.csv and train the model.`,
        );
      }
      const csv = fs.readFileSync(datasetPath, "utf8");
      const { headers, rows } = parseCsv(csv);
      if (rows.length === 0) throw new Error("The bundled Track A CSV contains no data rows.");
      const artifact = trainArtifact(headers, rows, {
        datasetName: "UCI Extension of Z-Alizadeh Sani Dataset (Track A real data)",
        datasetKind: "uploaded",
      });
      return saveRun(artifact, true);
    })().finally(() => {
      bootstrapping = null;
    });
  }
  return bootstrapping;
}

export function isTrained(entry: TargetEntry | undefined): entry is TargetArtifact {
  return !!entry && entry.available === true;
}

/** Strips the heavy fitted parameters so metadata can be sent to the browser. */
export function publicTargetSummary(entry: TargetEntry) {
  if (!entry.available) return entry;
  return {
    key: entry.key,
    label: entry.label,
    available: true as const,
    modelType: entry.modelType,
    modelLabel: entry.modelLabel,
    threshold: entry.threshold,
    prevalence: entry.prevalence,
    nTrain: entry.nTrain,
    nVal: entry.nVal,
    nTest: entry.nTest,
    candidates: entry.candidates,
    cv: entry.cv,
    validation: entry.validation,
    test: entry.test,
    globalImportance: entry.globalImportance,
  };
}

export type PublicTargetSummary = ReturnType<typeof publicTargetSummary>;
