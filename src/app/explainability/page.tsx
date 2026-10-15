"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { ContributionChart, ImportanceChart } from "@/components/charts";
import { EmptyState, Panel, PageHeader, fmt, pct } from "@/components/ui";
import type { TargetKey } from "@/types/api";

const TARGET_KEYS: TargetKey[] = ["cad", "lad", "lcx", "rca"];

export default function ExplainabilityPage() {
  const { prediction, modelInfo } = useApp();
  const [target, setTarget] = useState<TargetKey>("cad");
  const entry = prediction?.targets[target];
  const info = modelInfo?.targets?.[target];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explainability"
        description="Global feature importance for each trained pipeline and an additive, patient-specific contribution breakdown for the current assessment."
      >
        <div className="flex gap-2">
          {TARGET_KEYS.map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider ${
                target === t ? "border-teal-400/60 bg-teal-400/10 text-teal-200" : "border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </PageHeader>

      <Panel title="Method">
        <p className="text-xs leading-relaxed text-slate-400">
          {modelInfo?.run?.explanationMethod ??
            "Permutation importance (global) with an additive log-odds attribution per patient (local)."}{" "}
          Contributions are <strong>associations learned by the model</strong>, not causal effects, and they describe this model on
          this training distribution only.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={`Global feature importance — ${target.toUpperCase()}`} subtitle="Permutation importance: mean drop in validation ROC-AUC when a feature is shuffled">
          {info?.available ? (
            info.globalImportance.length ? (
              <ImportanceChart items={info.globalImportance} />
            ) : (
              <p className="text-xs text-slate-500">No importance values were produced for this target.</p>
            )
          ) : (
            <p className="text-xs text-amber-300/90">{info?.reason ?? "Model unavailable — nothing to explain."}</p>
          )}
        </Panel>

        <Panel
          title={`Patient-specific explanation — ${target.toUpperCase()}`}
          subtitle="Signed log-odds contribution of each feature for the most recent assessment"
        >
          {!prediction ? (
            <EmptyState title="No assessment loaded" description="Patient-level explanations require a prediction. Run an assessment first.">
              <Link href="/assessment" className="rounded-lg border border-teal-500/50 px-3 py-1.5 text-xs text-teal-200">Open assessment</Link>
            </EmptyState>
          ) : !entry || !entry.available ? (
            <p className="text-xs text-amber-300/90">{entry?.reason ?? "Target model unavailable — no explanation is fabricated."}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="chip border-slate-700">Predicted {pct(entry.probability)}</span>
                <span className="chip border-slate-700">Baseline (training-mean patient) {pct(entry.explanation.baseProbability)}</span>
                <span className="chip border-slate-700">{entry.explanation.methodShort}</span>
              </div>
              <ContributionChart contributions={entry.explanation.contributions} />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Red bars push the predicted log-odds up (towards disease), teal bars push it down. Values are relative to the
                training-mean patient, whose predicted probability is shown above.
              </p>
            </div>
          )}
        </Panel>
      </div>

      {entry?.available && (
        <Panel title="Narrative summary">
          <p className="text-sm leading-relaxed text-slate-300">
            For this record the {target.toUpperCase()} model estimates {pct(entry.probability)} probability (threshold{" "}
            {entry.threshold}, classified as <strong>{entry.predictedLabel}</strong>). The strongest upward contributors are{" "}
            {entry.explanation.contributions.filter((c) => c.contribution > 0).slice(0, 3).map((c) => `${c.label} (${c.value})`).join(", ") || "none"}.
            The strongest downward contributors are{" "}
            {entry.explanation.contributions.filter((c) => c.contribution < 0).slice(0, 3).map((c) => `${c.label} (${c.value})`).join(", ") || "none"}.
            Held-out test ROC-AUC for this target was {fmt(entry.testRocAuc)}.
          </p>
        </Panel>
      )}
    </div>
  );
}
