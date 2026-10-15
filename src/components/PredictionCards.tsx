"use client";

import Link from "next/link";
import { CircleSlash, Clock, Target } from "lucide-react";
import type { PredictionEntry, PredictionResponse } from "@/types/api";
import { VESSEL_META, riskColor, type VesselKey } from "@/lib/constants";
import { Panel, ProbabilityBar, Stat, fmt, pct } from "@/components/ui";
import { useApp } from "@/components/providers";

export function SourceBadge({ prediction }: { prediction: PredictionResponse }) {
  const synthetic = prediction.datasetKind === "synthetic";
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <span className="chip border-teal-500/40 text-teal-300">Trained-model inference (run #{prediction.runId})</span>
      <span className={`chip ${synthetic ? "border-amber-500/40 text-amber-300" : "border-sky-500/40 text-sky-300"}`}>
        Training data: {synthetic ? "SYNTHETIC cohort" : prediction.datasetName}
      </span>
      {prediction.source === "synthetic-demo" && <span className="chip border-amber-500/40 text-amber-300">Synthetic demo patient</span>}
    </div>
  );
}

export function CadCard({ prediction }: { prediction: PredictionResponse }) {
  const cad = prediction.targets.cad;
  return (
    <Panel title="Overall coronary artery disease" subtitle="Model-estimated probability from the trained CAD pipeline">
      {!cad || !cad.available ? (
        <div className="flex items-start gap-2 text-sm text-slate-400">
          <CircleSlash className="mt-0.5 h-4 w-4 text-slate-500" />
          <div>
            <p className="font-medium text-slate-300">Prediction unavailable</p>
            <p className="text-xs text-slate-500">{cad?.reason ?? "No trained CAD model."}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Estimated probability</p>
              <p className="text-4xl font-semibold" style={{ color: riskColor(cad.probability) }}>
                {pct(cad.probability)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Model classification</p>
              <p className="text-xl font-semibold text-slate-100">{cad.predictedLabel}</p>
              <p className="text-[11px] text-slate-500">at threshold {cad.threshold}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock className="h-3.5 w-3.5" /> {new Date(prediction.generatedAt).toLocaleString()}
            </div>
          </div>
          <ProbabilityBar probability={cad.probability} threshold={cad.threshold} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Held-out test ROC-AUC" value={fmt(cad.testRocAuc)} hint="Measured on the untouched test split" />
            <Stat label="Cross-validated AUC" value={cad.cvAucMean !== null ? `${fmt(cad.cvAucMean)} ± ${fmt(cad.cvAucSd, 3)}` : "n/a"} hint="Stratified k-fold, train+val only" />
            <Stat label="Brier score (test)" value={fmt(cad.testBrier)} hint="Lower = better calibrated" />
          </div>
          <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-400">
            This number is the model&apos;s estimated probability, not a measure of certainty. Discrimination (AUC) and calibration
            (Brier score) above describe how the model behaved on held-out data from the same source; performance on a different
            population may be substantially worse. Missing inputs were median/mode imputed from the training set.
          </p>
        </div>
      )}
    </Panel>
  );
}

function VesselCard({ entry, vessel }: { entry: PredictionEntry | undefined; vessel: VesselKey }) {
  const { setSelectedVessel } = useApp();
  const meta = VESSEL_META[vessel];
  return (
    <div className="panel panel-pad">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{meta.short}</p>
          <p className="text-[11px] text-slate-500">{meta.name}</p>
        </div>
        <Target className="h-4 w-4 text-slate-600" />
      </div>
      {!entry || !entry.available ? (
        <p className="mt-4 text-xs text-slate-500">
          <span className="block font-medium text-slate-400">Prediction unavailable</span>
          {entry?.reason ?? "No trained model for this vessel."}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-3xl font-semibold" style={{ color: riskColor(entry.probability) }}>
            {pct(entry.probability)}
          </p>
          <ProbabilityBar probability={entry.probability} threshold={entry.threshold} />
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className="chip border-slate-700">Class: {entry.predictedLabel}</span>
            <span className="chip border-slate-700">Threshold {entry.threshold}</span>
            <span className="chip border-slate-700">Test AUC {fmt(entry.testRocAuc)}</span>
          </div>
          <p className="text-[11px] text-slate-500">Territory: {meta.territory}</p>
          <Link
            href="/anatomy"
            onClick={() => setSelectedVessel(vessel)}
            className="inline-flex rounded-lg border border-teal-500/40 px-3 py-1.5 text-xs text-teal-200 hover:bg-teal-400/10"
          >
            Inspect in 3D view →
          </Link>
        </div>
      )}
    </div>
  );
}

export function VesselCards({ prediction }: { prediction: PredictionResponse }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {(["lad", "lcx", "rca"] as VesselKey[]).map((v) => (
        <VesselCard key={v} vessel={v} entry={prediction.targets[v]} />
      ))}
    </div>
  );
}
