import { db } from "@/db";
import { assessments } from "@/db/schema";
import { ensureRun, isTrained } from "@/lib/ml/registry";
import { predictWithTarget } from "@/lib/ml/train";
import { explainPatient } from "@/lib/ml/explain";
import { TARGETS } from "@/lib/ml/schema";
import { formatZodError, predictRequestSchema, requiredMissing } from "@/lib/validation";
import { DISCLAIMER } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = predictRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", issues: formatZodError(parsed.error) }, { status: 422 });
  }
  const { features, source } = parsed.data;
  const missing = requiredMissing(features as Record<string, unknown>);
  if (missing.length > 0) {
    return Response.json({ error: "Missing required clinical inputs", missing }, { status: 422 });
  }

  let run;
  try {
    run = await ensureRun();
  } catch {
    return Response.json({ error: "Model registry unavailable. Train a model before requesting predictions." }, { status: 503 });
  }
  if (!run) {
    return Response.json({ error: "No trained model available. Use the Dataset Explorer to train one." }, { status: 503 });
  }

  const targets: Record<string, unknown> = {};
  for (const t of TARGETS) {
    const entry = run.artifact.targets[t.key];
    if (!isTrained(entry)) {
      targets[t.key] = {
        key: t.key,
        label: t.label,
        shortLabel: t.shortLabel,
        available: false,
        reason: entry?.available === false ? entry.reason : `No trained model for ${t.shortLabel}.`,
      };
      continue;
    }
    const { probability, predicted } = predictWithTarget(entry, features as Record<string, number | string>);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      return Response.json({ error: `Model produced an invalid probability for ${t.shortLabel}.` }, { status: 500 });
    }
    const explanation = explainPatient(entry, features as Record<string, number | string>, 10);
    targets[t.key] = {
      key: t.key,
      label: t.label,
      shortLabel: t.shortLabel,
      available: true,
      probability,
      predicted,
      predictedLabel: predicted === 1 ? t.positiveLabel : "Normal",
      threshold: entry.threshold,
      modelLabel: entry.modelLabel,
      modelType: entry.modelType,
      testRocAuc: entry.test.rocAuc,
      testBrier: entry.test.brier,
      cvAucMean: entry.cv.aucMean,
      cvAucSd: entry.cv.aucSd,
      prevalence: entry.prevalence,
      explanation,
    };
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    runId: run.id,
    generatedAt,
    source,
    inferenceMode: "trained-model" as const,
    datasetKind: run.artifact.datasetKind,
    datasetName: run.artifact.datasetName,
    explanationMethod: run.artifact.explanationMethod,
    targets,
    disclaimer: DISCLAIMER,
  };

  // Audit log stores model output only — never the submitted clinical values.
  try {
    await db.insert(assessments).values({
      runId: run.id,
      source,
      predictions: Object.fromEntries(
        Object.entries(targets).map(([k, v]) => [k, { probability: (v as { probability?: number }).probability ?? null }]),
      ),
    });
  } catch {
    // audit logging must never block a prediction
  }

  return Response.json(payload);
}
