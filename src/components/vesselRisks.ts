import type { PredictionResponse } from "@/types/api";
import type { VesselKey } from "@/lib/constants";
import type { VesselRisk } from "@/components/Heart3D";

export function vesselRisks(prediction: PredictionResponse | null): Record<VesselKey, VesselRisk> {
  const build = (k: VesselKey): VesselRisk => {
    const entry = prediction?.targets[k];
    if (!entry || !entry.available) return { probability: null, available: false };
    return { probability: entry.probability, available: true };
  };
  return { lad: build("lad"), lcx: build("lcx"), rca: build("rca") };
}
