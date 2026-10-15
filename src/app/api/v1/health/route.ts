import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getActiveRun } from "@/lib/ml/registry";
import { TARGETS } from "@/lib/ml/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const status: Record<string, unknown> = {
    service: "CardioVision 3D API",
    version: "v1",
    timestamp: new Date().toISOString(),
  };
  try {
    await db.execute(sql`select 1`);
    status.database = "ok";
  } catch {
    return Response.json({ ...status, database: "unavailable", modelsReady: false }, { status: 503 });
  }
  try {
    const run = await getActiveRun();
    status.modelsReady = !!run;
    status.activeRunId = run?.id ?? null;
    status.datasetKind = run?.artifact.datasetKind ?? null;
    status.datasetName = run?.artifact.datasetName ?? null;
    status.targets = Object.fromEntries(
      TARGETS.map((t) => [t.key, run ? run.artifact.targets[t.key]?.available === true : false]),
    );
  } catch {
    status.modelsReady = false;
    status.targets = Object.fromEntries(TARGETS.map((t) => [t.key, false]));
  }
  return Response.json(status);
}
