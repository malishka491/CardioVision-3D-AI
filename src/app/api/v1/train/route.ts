import { parseCsv } from "@/lib/ml/schema";
import { trainArtifact } from "@/lib/ml/train";
import { publicTargetSummary, saveRun, syntheticRows } from "@/lib/ml/registry";
import { SYNTHETIC_DATASET_NAME } from "@/lib/ml/synthetic";
import { inspectDataset } from "@/lib/ml/inspect";
import { readCsvFromRequest } from "@/lib/upload";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let headers: string[];
  let rows: ReturnType<typeof parseCsv>["rows"];
  let datasetName: string;
  let datasetKind: "synthetic" | "uploaded";

  if (contentType.includes("application/json")) {
    let body: { mode?: string; csv?: string; fileName?: string; datasetName?: string };
    try {
      body = (await request.clone().json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (body.mode === "synthetic" || !body.csv) {
      const syn = syntheticRows();
      headers = syn.headers;
      rows = syn.rows;
      datasetName = SYNTHETIC_DATASET_NAME;
      datasetKind = "synthetic";
    } else {
      const parsed = parseCsv(body.csv);
      headers = parsed.headers;
      rows = parsed.rows;
      datasetName = body.datasetName ?? body.fileName ?? "Uploaded dataset";
      datasetKind = "uploaded";
    }
  } else {
    const result = await readCsvFromRequest(request);
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    const parsed = parseCsv(result.text);
    headers = parsed.headers;
    rows = parsed.rows;
    datasetName = result.fileName;
    datasetKind = "uploaded";
  }

  if (rows.length === 0) return Response.json({ error: "No rows available for training." }, { status: 422 });
  if (rows.length > 20000) return Response.json({ error: "Dataset too large for this prototype (limit 20,000 rows)." }, { status: 413 });

  const report = inspectDataset(datasetName, headers, rows);
  if (!report.trainable) {
    return Response.json(
      { error: "Dataset does not contain any trainable target.", report },
      { status: 422 },
    );
  }

  try {
    const artifact = trainArtifact(headers, rows, { datasetName, datasetKind });
    const run = await saveRun(artifact, true);
    return Response.json({
      runId: run.id,
      createdAt: artifact.createdAt,
      datasetName: artifact.datasetName,
      datasetKind: artifact.datasetKind,
      nRows: artifact.nRows,
      targets: Object.fromEntries(Object.entries(artifact.targets).map(([k, v]) => [k, publicTargetSummary(v)])),
    });
  } catch (err) {
    return Response.json({ error: "Training failed", detail: (err as Error).message }, { status: 500 });
  }
}
