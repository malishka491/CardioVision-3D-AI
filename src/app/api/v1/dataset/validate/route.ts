import { db } from "@/db";
import { datasetReports } from "@/db/schema";
import { inspectDataset } from "@/lib/ml/inspect";
import { parseCsv } from "@/lib/ml/schema";
import { readCsvFromRequest } from "@/lib/upload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const result = await readCsvFromRequest(request);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  const { headers, rows } = parseCsv(result.text);
  if (headers.length === 0 || rows.length === 0) {
    return Response.json({ error: "The uploaded file contains no parsable CSV rows." }, { status: 422 });
  }
  if (rows.length > 20000) {
    return Response.json({ error: "Dataset too large for this prototype (limit 20,000 rows)." }, { status: 413 });
  }

  const report = inspectDataset(result.fileName, headers, rows);
  try {
    await db.insert(datasetReports).values({ fileName: report.fileName, nRows: report.nRows, report });
  } catch {
    // report persistence is best-effort only
  }
  return Response.json({ report });
}
