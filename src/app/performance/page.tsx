"use client";

import { useEffect, useState } from "react";
import { CalibrationChart, ConfusionMatrixView, PrChart, RocChart } from "@/components/charts";
import { ErrorBanner, Panel, PageHeader, Spinner, Stat, fmt, pct } from "@/components/ui";
import type { MetricsResponse, TargetInfo } from "@/types/api";

function TargetBlock({ info }: { info: TargetInfo }) {
  if (!info.available) {
    return (
      <Panel title={`${info.key.toUpperCase()} — unavailable`}>
        <p className="text-xs text-amber-300/90">{info.reason}</p>
      </Panel>
    );
  }
  return (
    <Panel
      title={`${info.key.toUpperCase()} — ${info.label}`}
      subtitle={`${info.modelLabel} · selected on validation ROC-AUC · decision threshold ${info.threshold} tuned on validation only`}
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Test accuracy" value={pct(info.test.accuracy)} hint={info.test.accuracyCi95 ? `95% CI ${pct(info.test.accuracyCi95[0], 0)}–${pct(info.test.accuracyCi95[1], 0)}` : undefined} />
        <Stat label="Precision" value={fmt(info.test.precision)} />
        <Stat label="Recall" value={fmt(info.test.recall)} />
        <Stat label="F1" value={fmt(info.test.f1)} />
        <Stat label="ROC-AUC" value={fmt(info.test.rocAuc)} />
        <Stat label="Brier" value={fmt(info.test.brier)} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Stat label="CV ROC-AUC" value={info.cv.aucMean !== null ? `${fmt(info.cv.aucMean)} ± ${fmt(info.cv.aucSd)}` : "n/a"} hint={`${info.cv.folds}-fold stratified`} />
        <Stat label="Split sizes" value={`${info.nTrain}/${info.nVal}/${info.nTest}`} hint="train / val / test" />
        <Stat label="Prevalence" value={pct(info.prevalence)} hint="positive class share" />
        <Stat label="Specificity" value={fmt(info.test.specificity)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">ROC curve (test split)</p>
          <RocChart metrics={info.test} label={info.key.toUpperCase()} />
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Precision-recall curve (test split)</p>
          <PrChart metrics={info.test} />
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Calibration (predicted vs observed, test split)</p>
          <CalibrationChart metrics={info.test} />
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Confusion matrix @ threshold {info.threshold}</p>
          <ConfusionMatrixView metrics={info.test} />
          <div className="mt-3 space-y-1 text-[11px] text-slate-500">
            {info.test.notes.map((n) => (
              <p key={n}>• {n}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Candidate models (validation)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1">Model</th>
                <th>Validation ROC-AUC</th>
                <th>Validation F1</th>
                <th>Selected</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {info.candidates.map((c) => (
                <tr key={c.name} className="border-t border-slate-800">
                  <td className="py-1">{c.name}</td>
                  <td>{fmt(c.valAuc)}</td>
                  <td>{fmt(c.valF1)}</td>
                  <td>{c.selected ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

export default function PerformancePage() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/metrics", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
        setData(json as MetricsResponse);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model performance"
        description="Evaluation computed by the training pipeline on held-out data. Nothing on this page is hardcoded — all values come from the saved artifact of the active run."
      />
      {loading && <Spinner label="Loading saved evaluation results…" />}
      {error && <ErrorBanner message={error} />}
      {data && (
        <>
          <Panel title="Run provenance">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Run" value={`#${data.runId}`} hint={new Date(data.createdAt).toLocaleString()} />
              <Stat label="Dataset" value={data.datasetKind === "synthetic" ? "SYNTHETIC" : "Uploaded"} hint={data.datasetName} />
              <Stat label="Records" value={data.nRows} />
              <Stat label="Seed" value={data.seed} />
            </div>
            {data.datasetKind === "synthetic" && (
              <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                These metrics were produced on a <strong>simulated</strong> cohort generated by this application. They demonstrate
                that the pipeline works end-to-end; they are <strong>not</strong> evidence of real-world clinical performance. Upload
                the real Z-Alizadeh Sani CSV in the Dataset Explorer to retrain and re-evaluate.
              </p>
            )}
            {data.nRows < 500 && (
              <p className="mt-2 text-[11px] text-slate-500">Small-sample warning: results are preliminary and confidence intervals are wide.</p>
            )}
          </Panel>
          {["cad", "lad", "lcx", "rca"].map((k) => data.targets[k] && <TargetBlock key={k} info={data.targets[k]} />)}
        </>
      )}
    </div>
  );
}
