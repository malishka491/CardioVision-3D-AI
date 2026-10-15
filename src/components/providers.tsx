"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ModelInfo, PredictionResponse } from "@/types/api";
import type { VesselKey } from "@/lib/constants";

interface AppState {
  modelInfo: ModelInfo | null;
  modelInfoError: string | null;
  loadingModelInfo: boolean;
  refreshModelInfo: () => Promise<void>;
  prediction: PredictionResponse | null;
  setPrediction: (p: PredictionResponse | null) => void;
  patient: Record<string, number | string> | null;
  setPatient: (p: Record<string, number | string> | null) => void;
  selectedVessel: VesselKey | null;
  setSelectedVessel: (v: VesselKey | null) => void;
}

const Ctx = createContext<AppState | null>(null);

const STORAGE_KEY = "cardiovision3d.session.v1";

export function AppProvider({ children }: { children: ReactNode }) {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelInfoError, setModelInfoError] = useState<string | null>(null);
  const [loadingModelInfo, setLoadingModelInfo] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [patient, setPatient] = useState<Record<string, number | string> | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<VesselKey | null>("lad");

  const refreshModelInfo = useCallback(async () => {
    setLoadingModelInfo(true);
    setModelInfoError(null);
    try {
      const res = await fetch("/api/v1/model-info", { cache: "no-store" });
      if (!res.ok) throw new Error(`Model metadata request failed (${res.status})`);
      setModelInfo((await res.json()) as ModelInfo);
    } catch (err) {
      setModelInfoError((err as Error).message);
    } finally {
      setLoadingModelInfo(false);
    }
  }, []);


  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshModelInfo();
    }, 0);

    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          prediction?: PredictionResponse;
          patient?: Record<string, number | string>;
        };
       window.setTimeout(() => {
  if (parsed.prediction) setPrediction(parsed.prediction);
  if (parsed.patient) setPatient(parsed.patient);
}, 0);
      }
    } catch {
      /* ignore corrupted session cache */
    }

    return () => window.clearTimeout(timer);
  }, [refreshModelInfo]);


  useEffect(() => {
    try {
      if (prediction) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ prediction, patient }));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage may be unavailable */
    }
  }, [prediction, patient]);

  const value = useMemo<AppState>(
    () => ({
      modelInfo,
      modelInfoError,
      loadingModelInfo,
      refreshModelInfo,
      prediction,
      setPrediction,
      patient,
      setPatient,
      selectedVessel,
      setSelectedVessel,
    }),
    [modelInfo, modelInfoError, loadingModelInfo, refreshModelInfo, prediction, patient, selectedVessel],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
