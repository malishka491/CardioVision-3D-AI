"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Contribution } from "@/lib/ml/explain";
import type { MetricSet } from "@/lib/ml/metrics";

const axis = { stroke: "#64748b", fontSize: 11 };
const tooltipStyle = {
  background: "#0b1220",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

export function RocChart({ metrics, label }: { metrics: MetricSet; label: string }) {
  if (!metrics.rocCurve.length) {
    return <p className="text-xs text-slate-500">ROC curve undefined — the evaluation split contains a single class.</p>;
  }
  const data = metrics.rocCurve.map((p) => ({ ...p, diag: p.fpr }));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 6, right: 10, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={axis} tickFormatter={(v: number) => v.toFixed(1)} />
        <YAxis type="number" domain={[0, 1]} tick={axis} tickFormatter={(v: number) => v.toFixed(1)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v ?? ""))} />
        <Line type="monotone" dataKey="tpr" name={`${label} ROC`} stroke="#2dd4bf" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="diag" name="Chance" stroke="#475569" dot={false} strokeDasharray="4 4" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PrChart({ metrics }: { metrics: MetricSet }) {
  if (!metrics.prCurve.length) return <p className="text-xs text-slate-500">Precision-recall curve undefined (no positive cases).</p>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={metrics.prCurve} margin={{ top: 6, right: 10, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis dataKey="recall" type="number" domain={[0, 1]} tick={axis} tickFormatter={(v: number) => v.toFixed(1)} />
        <YAxis type="number" domain={[0, 1]} tick={axis} tickFormatter={(v: number) => v.toFixed(1)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v ?? ""))} />
        <Line type="monotone" dataKey="precision" name="Precision" stroke="#38bdf8" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CalibrationChart({ metrics }: { metrics: MetricSet }) {
  if (!metrics.calibration.length) return <p className="text-xs text-slate-500">Not enough samples for a calibration plot.</p>;
  const data = metrics.calibration.map((c) => ({ ...c, ideal: c.predicted }));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <ScatterChart margin={{ top: 6, right: 12, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis dataKey="predicted" type="number" domain={[0, 1]} tick={axis} name="Predicted" tickFormatter={(v: number) => v.toFixed(1)} />
        <YAxis dataKey="observed" type="number" domain={[0, 1]} tick={axis} name="Observed" tickFormatter={(v: number) => v.toFixed(1)} />
        <ZAxis dataKey="count" range={[40, 220]} name="n" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v ?? ""))} />
        <Scatter data={data} fill="#2dd4bf" name="Calibration bins" />
        <Scatter data={[{ predicted: 0, observed: 0 }, { predicted: 1, observed: 1 }]} line={{ stroke: "#475569", strokeDasharray: "4 4" }} fill="transparent" name="Ideal" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function ContributionChart({ contributions }: { contributions: Contribution[] }) {
  const data = contributions
    .slice()
    .reverse()
    .map((c) => ({ name: c.label.length > 28 ? `${c.label.slice(0, 27)}…` : c.label, value: Number(c.contribution.toFixed(4)), raw: c.value }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 110 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={axis} />
        <YAxis type="category" dataKey="name" tick={{ ...axis, fontSize: 10 }} width={150} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, _n: unknown, p: unknown) => {
          const val = typeof v === "number" ? v : 0;
          const raw = (p as { payload?: { raw?: string } } | undefined)?.payload?.raw ?? "";
          return [`${val > 0 ? "+" : ""}${val} log-odds`, raw];
        }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? "#f97362" : "#2dd4bf"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ImportanceChart({ items }: { items: { feature: string; importance: number }[] }) {
  const data = items
    .slice(0, 12)
    .reverse()
    .map((c) => ({ name: c.feature, value: Number(c.importance.toFixed(4)) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 90 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={axis} />
        <YAxis type="category" dataKey="name" tick={{ ...axis, fontSize: 10 }} width={130} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${typeof v === "number" ? v : 0} AUC drop`, "Permutation importance"]} />
        <Bar dataKey="value" fill="#38bdf8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClassBalanceChart({ data }: { data: { name: string; positive: number; negative: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={axis} />
        <YAxis tick={axis} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="positive" stackId="a" fill="#f97362" name="Positive" radius={[4, 4, 0, 0]} />
        <Bar dataKey="negative" stackId="a" fill="#2dd4bf" name="Negative" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConfusionMatrixView({ metrics }: { metrics: MetricSet }) {
  const { tn, fp, fn, tp } = metrics.confusion;
  const cells = [
    { label: "True negative", value: tn, tone: "text-teal-300" },
    { label: "False positive", value: fp, tone: "text-amber-300" },
    { label: "False negative", value: fn, tone: "text-rose-300" },
    { label: "True positive", value: tp, tone: "text-teal-300" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{c.label}</p>
          <p className={`mt-1 text-xl font-semibold ${c.tone}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
