"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { EmptyState, Panel, PageHeader, ProbabilityBar, fmt, pct } from "@/components/ui";
import { vesselRisks } from "@/components/vesselRisks";
import { VESSEL_META, riskColor, type VesselKey } from "@/lib/constants";

const Heart3D = dynamic(() => import("@/components/Heart3D").then((m) => m.Heart3D), {
  ssr: false,
  loading: () => <div className="grid h-[560px] place-items-center rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-500">Initialising 3D renderer…</div>,
});

export default function AnatomyPage() {
  const { prediction, selectedVessel, setSelectedVessel } = useApp();
  const [showTorso, setShowTorso] = useState(true);
  const risks = vesselRisks(prediction);
  const active: VesselKey = selectedVessel ?? "lad";
  const entry = prediction?.targets[active];

  return (
    <div className="space-y-6">
      <PageHeader
        title="3D anatomy explorer"
        description="Interactive schematic torso, heart and coronary tree. Artery colour and label are driven by the model-predicted vessel probability from the most recent assessment."
      >
        <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
          <input type="checkbox" checked={showTorso} onChange={(e) => setShowTorso(e.target.checked)} /> Transparent torso layer
        </label>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Heart3D risks={risks} selected={active} onSelect={setSelectedVessel} showTorso={showTorso} height={560} />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            The scene auto-rotates on a turntable (toggle with the Rotating button; it pauses while you interact and resumes a few
            seconds later) · drag to rotate manually · scroll or pinch to zoom · click an artery (or use the panel) to inspect it ·
            “Reset camera” restores the default view. The heart beats at ~64 bpm for orientation only. This is a clearly-labelled{" "}
            <strong>schematic</strong> representation, not a medically accurate anatomical
            reconstruction. Tabular clinical data supports vessel-level status only — no lesion location, plaque geometry or
            patient-specific blockage is inferred or rendered.
          </p>
        </div>

        <div className="space-y-4">
          <Panel title="Vessel selection" subtitle="Keyboard- and screen-reader-accessible alternative to clicking the 3D mesh">
            <div className="space-y-2">
              {(Object.keys(VESSEL_META) as VesselKey[]).map((v) => {
                const r = risks[v];
                return (
                  <button
                    key={v}
                    onClick={() => setSelectedVessel(v)}
                    aria-pressed={active === v}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active === v ? "border-teal-400/60 bg-teal-400/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-100">
                        {VESSEL_META[v].short} — {VESSEL_META[v].name}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: riskColor(r.probability) }}>
                        {r.available && r.probability !== null ? pct(r.probability) : "n/a"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{VESSEL_META[v].territory}</p>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Selected vessel details">
            {!prediction ? (
              <EmptyState title="No prediction loaded" description="Run an assessment to colour the arteries with model probabilities.">
                <Link href="/assessment" className="rounded-lg border border-teal-500/50 px-3 py-1.5 text-xs text-teal-200">Open assessment</Link>
              </EmptyState>
            ) : !entry || !entry.available ? (
              <p className="text-xs text-amber-300/90">Prediction unavailable for {VESSEL_META[active].short}: {entry?.reason}</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">{entry.label}</p>
                  <p className="text-3xl font-semibold" style={{ color: riskColor(entry.probability) }}>{pct(entry.probability)}</p>
                </div>
                <ProbabilityBar probability={entry.probability} threshold={entry.threshold} />
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <span className="chip border-slate-700">Predicted: {entry.predictedLabel}</span>
                  <span className="chip border-slate-700">Threshold {entry.threshold}</span>
                  <span className="chip border-slate-700">Test AUC {fmt(entry.testRocAuc)}</span>
                  <span className="chip border-slate-700">{entry.modelType === "logreg" ? "Logistic regression" : "Random forest"}</span>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Strongest contributing features</p>
                  <ul className="space-y-1">
                    {entry.explanation.contributions.slice(0, 5).map((c) => (
                      <li key={c.column} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-300">{c.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-500">{c.value}</span>
                          <span className={c.contribution >= 0 ? "text-rose-300" : "text-teal-300"}>
                            {c.contribution >= 0 ? "+" : ""}
                            {c.contribution.toFixed(2)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-slate-500">{entry.explanation.methodShort} · log-odds contributions, associations only.</p>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
