"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Boxes,
  BrainCircuit,
  Database,
  GaugeCircle,
  HeartPulse,
  Info,
  LayoutDashboard,
  Menu,
  ShieldAlert,
  X,
} from "lucide-react";
import { DISCLAIMER } from "@/lib/constants";
import { useApp } from "@/components/providers";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/anatomy", label: "3D Anatomy Explorer", icon: Boxes },
  { href: "/assessment", label: "Patient Assessment", icon: HeartPulse },
  { href: "/explainability", label: "Explainability", icon: BrainCircuit },
  { href: "/performance", label: "Model Performance", icon: GaugeCircle },
  { href: "/dataset", label: "Dataset Explorer", icon: Database },
  { href: "/about", label: "About & Safety", icon: Info },
];

function StatusIndicator() {
  const [health, setHealth] = useState<{ ok: boolean; label: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/v1/health", { cache: "no-store" });
        const json = (await res.json()) as { modelsReady?: boolean; database?: string };
        if (!alive) return;
        setHealth({
          ok: res.ok && !!json.modelsReady,
          label: !res.ok ? "API degraded" : json.modelsReady ? "Models ready" : "No trained model",
        });
      } catch {
        if (alive) setHealth({ ok: false, label: "API offline" });
      }
    };
    void check();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const color = health === null ? "bg-slate-500" : health.ok ? "bg-teal-400" : "bg-amber-400";
  return (
    <div className="chip border-slate-700 bg-slate-900/70 text-slate-300">
      <span className={`h-2 w-2 rounded-full ${color} ${health?.ok ? "animate-pulse" : ""}`} />
      {health?.label ?? "Checking status…"}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { modelInfo } = useApp();
  const datasetKind = modelInfo?.run?.datasetKind;

  return (
    <div className="min-h-screen text-slate-200">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 border-r border-slate-800/80 bg-slate-950/95 backdrop-blur transition-transform lg:static lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col p-5">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400/30 to-sky-500/20 ring-1 ring-teal-400/40">
                  <Activity className="h-5 w-5 text-teal-300" />
                </span>
                <span>
                  <span className="block text-base font-semibold tracking-tight text-white">CardioVision 3D</span>
                  <span className="block text-[11px] uppercase tracking-[0.18em] text-teal-300/80">Track A · Hackathon 2026</span>
                </span>
              </Link>
              <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-7 flex-1 space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      active ? "bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-3 border-t border-slate-800 pt-4 text-xs text-slate-500">
              <StatusIndicator />
              {datasetKind && (
                <div className={`chip ${datasetKind === "synthetic" ? "border-amber-500/40 text-amber-300" : "border-teal-500/40 text-teal-300"}`}>
                  {datasetKind === "synthetic" ? "Synthetic training data" : "Uploaded dataset"}
                </div>
              )}
              <p className="leading-relaxed">Research & education prototype. Not a medical device.</p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/80 px-4 py-3 backdrop-blur lg:px-8">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-amber-200/90">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="truncate">Experimental AI prototype — predictions are not a medical diagnosis.</span>
            </div>
            <StatusIndicator />
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>

          <footer className="border-t border-slate-800/80 px-4 py-5 text-[11px] leading-relaxed text-slate-500 lg:px-8">
            {DISCLAIMER}
          </footer>
        </div>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}
