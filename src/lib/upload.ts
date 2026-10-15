/**
 * Safe CSV intake. Uploaded clinical files are parsed in memory only — nothing
 * is written to disk or to any public directory, and raw rows are never
 * persisted or logged.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export interface CsvPayload {
  text: string;
  fileName: string;
}

export async function readCsvFromRequest(request: Request): Promise<CsvPayload | { error: string; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return { error: "No file field found in the upload.", status: 400 };
      if (file.size === 0) return { error: "Uploaded file is empty.", status: 422 };
      if (file.size > MAX_UPLOAD_BYTES) return { error: "File exceeds the 8 MB upload limit.", status: 413 };
      const name = file.name || "upload.csv";
      if (!/\.(csv|txt)$/i.test(name)) return { error: "Only .csv files are accepted.", status: 415 };
      return { text: await file.text(), fileName: name };
    }
    const body = (await request.json()) as { csv?: unknown; fileName?: unknown };
    if (typeof body.csv !== "string" || body.csv.trim() === "") {
      return { error: "Expected multipart file upload or a JSON body with a non-empty `csv` string.", status: 400 };
    }
    if (body.csv.length > MAX_UPLOAD_BYTES) return { error: "Payload exceeds the 8 MB limit.", status: 413 };
    return { text: body.csv, fileName: typeof body.fileName === "string" ? body.fileName.slice(0, 120) : "pasted.csv" };
  } catch {
    return { error: "Unable to read the uploaded payload.", status: 400 };
  }
}
