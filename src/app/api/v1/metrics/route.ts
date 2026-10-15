import { ensureRun, publicTargetSummary } from "@/lib/ml/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const run = await ensureRun();
    if (!run) return Response.json({ error: "No trained model available." }, { status: 503 });
    const a = run.artifact;
    return Response.json({
      runId: run.id,
      createdAt: a.createdAt,
      datasetName: a.datasetName,
      datasetKind: a.datasetKind,
      nRows: a.nRows,
      seed: a.seed,
      explanationMethod: a.explanationMethod,
      excludedLeakageColumns: a.excludedLeakageColumns,
      targets: Object.fromEntries(Object.entries(a.targets).map(([k, v]) => [k, publicTargetSummary(v)])),
    });
  } catch (err) {
    return Response.json({ error: "Failed to load evaluation results", detail: (err as Error).message }, { status: 500 });
  }
}
