export const DISCLAIMER =
  "CardioVision 3D is an experimental AI research and educational prototype. Its predictions are not a medical diagnosis and must not be used as a substitute for professional clinical assessment, coronary imaging, or medical advice. Model performance and generalizability may be limited by dataset size, quality, and population differences.";

export const VESSEL_META = {
  lad: { name: "Left Anterior Descending", short: "LAD", territory: "Anterior wall, septum, apex" },
  lcx: { name: "Left Circumflex", short: "LCX", territory: "Lateral wall of the left ventricle" },
  rca: { name: "Right Coronary Artery", short: "RCA", territory: "Inferior wall, right ventricle, AV node" },
} as const;

export type VesselKey = keyof typeof VESSEL_META;

/** Probability -> colour scale (teal / amber / red), with numeric label always shown. */
export function riskColor(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "#64748b";
  if (p < 0.34) return "#14b8a6";
  if (p < 0.67) return "#f59e0b";
  return "#ef4444";
}

export function riskBand(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "Unavailable";
  if (p < 0.34) return "Lower model probability";
  if (p < 0.67) return "Intermediate model probability";
  return "Higher model probability";
}
