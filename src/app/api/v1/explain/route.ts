import { z } from "zod";
import { ensureRun, isTrained } from "@/lib/ml/registry";
import { explainPatient } from "@/lib/ml/explain";
import { patientSchema, formatZodError } from "@/lib/validation";
import { TARGET_BY_KEY } from "@/lib/ml/schema";

export const dynamic = "force-dynamic";

const schema = z.object({
  target: z.enum(["cad", "lad", "lcx", "rca"]),
  features: patientSchema,
  topK: z.coerce.number().min(3).max(30).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", issues: formatZodError(parsed.error) }, { status: 422 });
  }
  const run = await ensureRun();
  if (!run) return Response.json({ error: "No trained model available." }, { status: 503 });
  const entry = run.artifact.targets[parsed.data.target];
  if (!isTrained(entry)) {
    return Response.json(
      { error: `No trained model for target "${parsed.data.target}".`, reason: entry?.available === false ? entry.reason : undefined },
      { status: 404 },
    );
  }
  const explanation = explainPatient(entry, parsed.data.features as Record<string, number | string>, parsed.data.topK ?? 12);
  return Response.json({
    target: parsed.data.target,
    label: TARGET_BY_KEY.get(parsed.data.target)?.label,
    runId: run.id,
    globalImportance: entry.globalImportance,
    explanation,
  });
}
