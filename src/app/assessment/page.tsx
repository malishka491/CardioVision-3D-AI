"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FlaskConical, RotateCcw, Stethoscope } from "lucide-react";
import { FEATURES, GROUP_LABELS, type FeatureDef } from "@/lib/ml/schema";
import { syntheticDemoPatient } from "@/lib/ml/synthetic";
import { patientSchema } from "@/lib/validation";
import { useApp } from "@/components/providers";
import { CadCard, SourceBadge, VesselCards } from "@/components/PredictionCards";
import { ErrorBanner, Panel, PageHeader, Spinner } from "@/components/ui";
import { DISCLAIMER } from "@/lib/constants";
import type { PredictionResponse } from "@/types/api";

type FormValues = Record<string, unknown>;

const defaults: FormValues = Object.fromEntries(FEATURES.map((f) => [f.key, f.default]));

function Field({ def, register, error }: { def: FeatureDef; register: ReturnType<typeof useForm<FormValues>>["register"]; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-slate-400">
        <span>{def.label}</span>
        {def.unit && <span className="text-slate-600">{def.unit}</span>}
      </span>
      {def.kind === "categorical" ? (
        <select className="field-input" {...register(def.key)}>
          {(def.categories ?? []).map((c) => (
            <option key={c} value={c}>
              {c === "Fmale" ? "Female" : c}
            </option>
          ))}
        </select>
      ) : def.kind === "binary" ? (
        <select className="field-input" {...register(def.key, { valueAsNumber: true })}>
          <option value={0}>No</option>
          <option value={1}>Yes</option>
        </select>
      ) : (
        <input className="field-input" type="number" step="any" min={def.min} max={def.max} {...register(def.key, { valueAsNumber: true })} />
      )}
      {error && <span className="mt-1 block text-[11px] text-rose-300">{error}</span>}
    </label>
  );
}

export default function AssessmentPage() {
  const { setPrediction, setPatient, prediction } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"user-entered" | "synthetic-demo">("user-entered");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: defaults, resolver: zodResolver(patientSchema) });

  const grouped = useMemo(() => {
    const map = new Map<string, FeatureDef[]>();
    for (const f of FEATURES) {
      const arr = map.get(f.group) ?? [];
      arr.push(f);
      map.set(f.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ features: values, source }),
      });
      const json = await res.json();
      if (!res.ok) {
        const issues = (json.issues as { field: string; message: string }[] | undefined)?.map((i) => `${i.field}: ${i.message}`).join("; ");
        throw new Error(issues || json.error || `Prediction failed (${res.status})`);
      }
      setPrediction(json as PredictionResponse);
      setPatient(values as Record<string, number | string>);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  });

  const loadDemo = (profile: "high" | "low") => {
    reset(syntheticDemoPatient(profile) as FormValues);
    setSource("synthetic-demo");
    setError(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient assessment"
        description="Enter clinical measurements, submit them to the trained inference pipeline, and review CAD plus vessel-level probabilities."
      >
        <div className="flex flex-wrap gap-2">
          <button onClick={() => loadDemo("high")} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-xs text-amber-200 hover:bg-amber-400/10">
            <FlaskConical className="h-4 w-4" /> Load synthetic demo (higher risk)
          </button>
          <button onClick={() => loadDemo("low")} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-xs text-amber-200 hover:bg-amber-400/10">
            <FlaskConical className="h-4 w-4" /> Synthetic demo (lower risk)
          </button>
          <button
            onClick={() => {
              reset(defaults);
              setSource("user-entered");
              setPrediction(null);
              setPatient(null);
              setError(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </PageHeader>

      {source === "synthetic-demo" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Synthetic demonstration record loaded. These values are simulated for interface testing — they are not a real patient and
          must not be used to claim real-world model performance.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {grouped.map(([group, defs]) => (
          <Panel key={group} title={GROUP_LABELS[group as keyof typeof GROUP_LABELS]}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {defs.map((d) => (
                <Field key={d.key} def={d} register={register} error={errors[d.key]?.message as string | undefined} />
              ))}
            </div>
          </Panel>
        ))}

        {error && <ErrorBanner message={error} />}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500/90 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-60"
          >
            <Stethoscope className="h-4 w-4" /> {submitting ? "Running inference…" : "Run prediction"}
          </button>
          {submitting && <Spinner label="Loading saved pipelines and scoring…" />}
          <span className="text-[11px] text-slate-500">
            Inputs are validated client- and server-side; raw values are never stored in the audit log.
          </span>
        </div>
      </form>

      {prediction && (
        <div className="space-y-4">
          <SourceBadge prediction={prediction} />
          <CadCard prediction={prediction} />
          <VesselCards prediction={prediction} />
          <FeatureSummary prediction={prediction} />
          <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">{DISCLAIMER}</p>
        </div>
      )}
    </div>
  );
}

function FeatureSummary({ prediction }: { prediction: PredictionResponse }) {
  const [target, setTarget] = useState<string>("cad");
  const entry = prediction.targets[target];
  const contributions = entry && entry.available ? entry.explanation.contributions : [];
  const byFeature = new Map(contributions.map((c) => [c.feature, c.contribution]));
  const { patient } = useApp();

  return (
    <Panel
      title="Patient feature summary"
      subtitle="Submitted values with the model-specific contribution for the selected target (log-odds, association not causation)"
      action={
        <select className="field-input w-auto" value={target} onChange={(e) => setTarget(e.target.value)}>
          {["cad", "lad", "lcx", "rca"].map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(GROUP_LABELS).map(([group, label]) => (
          <div key={group} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
            <div className="space-y-1">
              {FEATURES.filter((f) => f.group === group).map((f) => {
                const value = patient?.[f.key];
                const contribution = byFeature.get(f.key);
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-slate-400">{f.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate-200">
                        {value === undefined || value === "" ? "—" : f.kind === "binary" ? (Number(value) === 1 ? "Yes" : "No") : String(value)}
                        {f.unit ? ` ${f.unit}` : ""}
                      </span>
                      {contribution !== undefined && (
                        <span className={contribution >= 0 ? "text-rose-300" : "text-teal-300"}>
                          {contribution >= 0 ? "+" : ""}
                          {contribution.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
