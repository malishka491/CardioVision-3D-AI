import { ensureRun, publicTargetSummary, listRuns } from "@/lib/ml/registry";
import { FEATURES, GROUP_LABELS, LEAKAGE_COLUMNS, TARGETS } from "@/lib/ml/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const run = await ensureRun();
    const runs = await listRuns();
    if (!run) {
      return Response.json(
        {
          modelsReady: false,
          message: "No trained model is available. Train a model from the Dataset Explorer.",
          features: FEATURES,
          groups: GROUP_LABELS,
          targets: {},
          runs,
        },
        { status: 200 },
      );
    }
    const a = run.artifact;
    return Response.json({
      modelsReady: true,
      run: {
        id: run.id,
        createdAt: a.createdAt,
        datasetName: a.datasetName,
        datasetKind: a.datasetKind,
        nRows: a.nRows,
        seed: a.seed,
        featureColumnsUsed: a.featureColumnsUsed,
        missingFeatureColumns: a.missingFeatureColumns,
        excludedLeakageColumns: a.excludedLeakageColumns,
        explanationMethod: a.explanationMethod,
      },
      leakagePolicy: LEAKAGE_COLUMNS,
      features: FEATURES,
      groups: GROUP_LABELS,
      targetDefs: TARGETS,
      targets: Object.fromEntries(Object.entries(a.targets).map(([k, v]) => [k, publicTargetSummary(v)])),
      runs,
    });
  } catch (err) {
    return Response.json({ error: "Failed to load model metadata", detail: (err as Error).message }, { status: 500 });
  }
}
