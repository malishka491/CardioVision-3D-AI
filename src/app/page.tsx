"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { CadCard, SourceBadge, VesselCards } from "@/components/PredictionCards";
import { EmptyState, Panel, PageHeader, Spinner, Stat, fmt } from "@/components/ui";
import { vesselRisks } from "@/components/vesselRisks";

const Heart3D = dynamic(() => import("@/components/Heart3D").then((m) => m.Heart3D), {
  ssr: false,
  loading: () => <div className="grid h-[380px] place-items-center rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-500">Initialising 3D renderer…</div>,
});

export default function OverviewPage() {
  const { prediction, modelInfo, loadingModelInfo, selectedVessel, setSelectedVessel } = useApp();
  const targets = modelInfo?.targets ?? {};
  const trained = Object.values(targets).filter((t) => t.available).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview dashboard"
        description="Coronary artery disease and vessel-level stenosis probabilities from locally trained models, with a synchronized 3D coronary view."
      >
        <Link href="/assessment" className="rounded-lg bg-teal-500/90 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400">
          New patient assessment
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel title="Model status" className="lg:col-span-2">
          {loadingModelInfo ? (
            <Spinner label="Reading model registry…" />
          ) : modelInfo?.modelsReady && modelInfo.run ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="Active run" value={`#${modelInfo.run.id}`} hint={new Date(modelInfo.run.createdAt).toLocaleString()} />
                <Stat label="Trained targets" value={`${trained} / 4`} hint="CAD, LAD, LCX, RCA" />
                <Stat label="Training records" value={modelInfo.run.nRows} hint={modelInfo.run.datasetName} />
                <Stat label="Random seed" value={modelInfo.run.seed} hint="Reproducible splits & models" />
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Leakage guard — columns excluded from every input matrix: {modelInfo.run.excludedLeakageColumns.join(", ") || "none present"}.
              </p>
            </div>
          ) : (
            <EmptyState title="No trained model" description="Train a model from the Dataset Explorer (synthetic cohort or your own Z-Alizadeh Sani CSV).">
              <Link href="/dataset" className="rounded-lg border border-teal-500/50 px-3 py-1.5 text-xs text-teal-200">Open Dataset Explorer</Link>
            </EmptyState>
          )}
        </Panel>

        <Panel title="Per-target readiness" className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {["cad", "lad", "lcx", "rca"].map((k) => {
              const t = targets[k];
              return (
                <div key={k} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">{k}</p>
                  {t?.available ? (
                    <>
                      <p className="mt-1 text-[11px] text-teal-300">{t.modelLabel}</p>
                      <p className="text-[11px] text-slate-500">
                        test AUC {fmt(t.test.rocAuc)} · threshold {t.threshold} · n_test {t.nTest}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-amber-300/90">{t?.reason ?? "Unavailable"}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {prediction ? (
        <>
          <SourceBadge prediction={prediction} />
          <CadCard prediction={prediction} />
          <VesselCards prediction={prediction} />
          <Panel title="3D coronary snapshot" subtitle="Schematic model — artery colour encodes the predicted vessel probability">
            <Heart3D risks={vesselRisks(prediction)} selected={selectedVessel} onSelect={setSelectedVessel} showTorso height={380} />
          </Panel>
        </>
      ) : (
        <EmptyState
          title="No assessment yet"
          description="Run a patient assessment (or load the clearly-labelled synthetic demo patient) to populate the risk cards, explanations and 3D vessel colours."
        >
          <Link href="/assessment" className="rounded-lg bg-teal-500/90 px-4 py-2 text-sm font-medium text-slate-950">Go to Patient Assessment</Link>
        </EmptyState>
      )}
    </div>
  );
}
