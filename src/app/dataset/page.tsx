"use client";

import { useRef, useState } from "react";
import { Database, Play, Upload } from "lucide-react";
import { ClassBalanceChart } from "@/components/charts";
import { ErrorBanner, Panel, PageHeader, Spinner, Stat } from "@/components/ui";
import { useApp } from "@/components/providers";
import type { DatasetReport } from "@/types/api";

export default function DatasetPage() {
  const { modelInfo, refreshModelInfo } = useApp();
  const [report, setReport] = useState<DatasetReport | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trainMessage, setTrainMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validate = async (text: string, name: string) => {
    setBusy("Validating dataset…");
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/v1/dataset/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv: text, fileName: name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Validation failed (${res.status})`);
      setReport(json.report as DatasetReport);
      setCsv(text);
      setFileName(name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File) => {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Only .csv files are accepted.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("File exceeds the 8 MB limit.");
      return;
    }
    await validate(await file.text(), file.name);
  };

  const train = async (mode: "synthetic" | "uploaded") => {
    setBusy(mode === "synthetic" ? "Training on the synthetic cohort…" : "Training on the uploaded dataset…");
    setError(null);
    setTrainMessage(null);
    try {
      const res = await fetch("/api/v1/train", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "synthetic" ? { mode: "synthetic" } : { csv, fileName, datasetName: fileName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Training failed (${res.status})`);
      const trained = Object.values(json.targets as Record<string, { available: boolean }>).filter((t) => t.available).length;
      setTrainMessage(`Run #${json.runId} trained on ${json.nRows} records — ${trained}/4 targets available. This run is now active.`);
      await refreshModelInfo();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dataset explorer"
        description="Upload the Z-Alizadeh Sani CSV (or any compatible file), inspect its schema, missingness and class balance, then retrain the four target pipelines."
      />

      <Panel title="Upload & validate" subtitle="Files are parsed in memory only — rows are never written to disk or to a public directory">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-teal-500/50 px-4 py-2 text-sm text-teal-200 hover:bg-teal-400/10">
            <Upload className="h-4 w-4" /> Choose CSV file
          </button>
          <button onClick={() => train("synthetic")} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-400/10">
            <Database className="h-4 w-4" /> Retrain on synthetic cohort
          </button>
          {report?.trainable && csv && (
            <button onClick={() => train("uploaded")} className="inline-flex items-center gap-2 rounded-lg bg-teal-500/90 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400">
              <Play className="h-4 w-4" /> Train on {fileName}
            </button>
          )}
          {busy && <Spinner label={busy} />}
        </div>
        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
        {trainMessage && <p className="mt-3 rounded-lg border border-teal-500/40 bg-teal-500/10 p-3 text-xs text-teal-200">{trainMessage}</p>}
        {modelInfo?.run && (
          <p className="mt-3 text-[11px] text-slate-500">
            Active run #{modelInfo.run.id} · {modelInfo.run.datasetName} · {modelInfo.run.nRows} records · seed {modelInfo.run.seed}
          </p>
        )}
      </Panel>

      {report && (
        <>
          <Panel title="Dataset summary" subtitle={report.fileName}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Records" value={report.nRows} />
              <Stat label="Columns" value={report.nColumns} />
              <Stat label="Duplicate rows" value={report.duplicateRows} />
              <Stat label="Trainable" value={report.trainable ? "Yes" : "No"} />
            </div>
            {report.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-[11px] text-amber-300/90">
                {report.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-500">
              Leakage columns detected and excluded from all model inputs: {report.leakageColumns.join(", ") || "none"}.
            </p>
            {report.missingFeatureColumns.length > 0 && (
              <p className="mt-1 text-[11px] text-slate-500">Expected clinical columns not found: {report.missingFeatureColumns.join(", ")}.</p>
            )}
          </Panel>

          <Panel title="Target availability & class distribution">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                {report.targets.map((t) => (
                  <div key={t.key} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
                    <p className="font-semibold text-slate-200">
                      {t.key.toUpperCase()} <span className="text-slate-500">({t.column})</span>
                    </p>
                    {t.present ? (
                      <p className="mt-1 text-slate-400">
                        {t.usableRows} usable rows · {t.positives} positive / {t.negatives} negative
                        {t.unmappedValues.length > 0 && ` · unmapped values: ${t.unmappedValues.join(", ")}`}
                      </p>
                    ) : (
                      <p className="mt-1 text-amber-300/90">{t.reason}</p>
                    )}
                  </div>
                ))}
              </div>
              <ClassBalanceChart
                data={report.targets.filter((t) => t.present).map((t) => ({ name: t.key.toUpperCase(), positive: t.positives, negative: t.negatives }))}
              />
            </div>
          </Panel>

          <Panel title="Column inspection" subtitle="Inferred type, missingness and distinct values">
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-950/95 text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">Column</th>
                    <th className="pr-3">Type</th>
                    <th className="pr-3">Missing</th>
                    <th className="pr-3">Unique</th>
                    <th className="pr-3">Mean</th>
                    <th className="pr-3">Min</th>
                    <th className="pr-3">Max</th>
                    <th className="pr-3">Role</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {report.columns.map((c) => (
                    <tr key={c.name} className="border-t border-slate-800/70">
                      <td className="py-1 pr-3">{c.name}</td>
                      <td className="pr-3 text-slate-500">{c.inferredType}</td>
                      <td className="pr-3">{c.missing} ({c.missingPct.toFixed(1)}%)</td>
                      <td className="pr-3">{c.unique}</td>
                      <td className="pr-3">{c.mean !== undefined ? c.mean.toFixed(2) : "—"}</td>
                      <td className="pr-3">{c.min !== undefined ? c.min : "—"}</td>
                      <td className="pr-3">{c.max !== undefined ? c.max : "—"}</td>
                      <td className="pr-3">
                        {c.isLeakage ? <span className="text-rose-300">target / excluded</span> : c.mappedFeature ? <span className="text-teal-300">feature</span> : <span className="text-slate-500">ignored</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
