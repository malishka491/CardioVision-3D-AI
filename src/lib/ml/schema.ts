/**
 * CardioVision 3D — dataset schema definitions.
 *
 * The schema follows the Z-Alizadeh Sani (extension) dataset distributed by the
 * UCI Machine Learning Repository. Column names below match the canonical CSV
 * headers so that a real download can be uploaded directly in the Dataset
 * Explorer. Values are normalised case-insensitively on ingestion.
 */

export type FeatureKind = "numeric" | "binary" | "categorical";

export interface FeatureDef {
  /** canonical column name in the Z-Alizadeh Sani CSV */
  name: string;
  /** stable key used in API payloads / forms */
  key: string;
  label: string;
  kind: FeatureKind;
  group: "demographics" | "vitals" | "labs" | "ecg" | "echo";
  unit?: string;
  min?: number;
  max?: number;
  categories?: string[];
  default: number | string;
  aliases?: string[];
}

export const FEATURES: FeatureDef[] = [
  // ---------------------------------------------------------------- demographics
  { name: "Age", key: "age", label: "Age", kind: "numeric", group: "demographics", unit: "years", min: 18, max: 110, default: 58 },
  { name: "Sex", key: "sex", label: "Sex", kind: "categorical", group: "demographics", categories: ["Male", "Fmale"], default: "Male", aliases: ["Gender"] },
  { name: "Weight", key: "weight", label: "Weight", kind: "numeric", group: "demographics", unit: "kg", min: 30, max: 220, default: 76 },
  { name: "Length", key: "height", label: "Height", kind: "numeric", group: "demographics", unit: "cm", min: 120, max: 220, default: 166, aliases: ["Height"] },
  { name: "BMI", key: "bmi", label: "Body mass index", kind: "numeric", group: "demographics", unit: "kg/m²", min: 12, max: 60, default: 27.6 },
  { name: "DM", key: "dm", label: "Diabetes mellitus", kind: "binary", group: "demographics", default: 0 },
  { name: "HTN", key: "htn", label: "Hypertension", kind: "binary", group: "demographics", default: 0 },
  { name: "Current Smoker", key: "currentSmoker", label: "Current smoker", kind: "binary", group: "demographics", default: 0 },
  { name: "EX-Smoker", key: "exSmoker", label: "Ex-smoker", kind: "binary", group: "demographics", default: 0 },
  { name: "FH", key: "fh", label: "Family history of CAD", kind: "binary", group: "demographics", default: 0 },
  { name: "Obesity", key: "obesity", label: "Obesity", kind: "binary", group: "demographics", default: 0 },
  { name: "CRF", key: "crf", label: "Chronic renal failure", kind: "binary", group: "demographics", default: 0 },
  { name: "CVA", key: "cva", label: "Cerebrovascular accident", kind: "binary", group: "demographics", default: 0 },
  { name: "Airway disease", key: "airwayDisease", label: "Airway disease", kind: "binary", group: "demographics", default: 0 },
  { name: "Thyroid Disease", key: "thyroid", label: "Thyroid disease", kind: "binary", group: "demographics", default: 0 },
  { name: "CHF", key: "chf", label: "Congestive heart failure", kind: "binary", group: "demographics", default: 0 },
  { name: "DLP", key: "dlp", label: "Dyslipidemia", kind: "binary", group: "demographics", default: 0 },

  // --------------------------------------------------------------------- vitals
  { name: "BP", key: "bp", label: "Systolic blood pressure", kind: "numeric", group: "vitals", unit: "mmHg", min: 70, max: 250, default: 129 },
  { name: "PR", key: "pr", label: "Pulse rate", kind: "numeric", group: "vitals", unit: "bpm", min: 35, max: 180, default: 75 },
  { name: "Edema", key: "edema", label: "Peripheral edema", kind: "binary", group: "vitals", default: 0 },
  { name: "Weak Peripheral Pulse", key: "weakPulse", label: "Weak peripheral pulse", kind: "binary", group: "vitals", default: 0 },
  { name: "Lung rales", key: "lungRales", label: "Lung rales", kind: "binary", group: "vitals", default: 0 },
  { name: "Systolic Murmur", key: "systolicMurmur", label: "Systolic murmur", kind: "binary", group: "vitals", default: 0 },
  { name: "Diastolic Murmur", key: "diastolicMurmur", label: "Diastolic murmur", kind: "binary", group: "vitals", default: 0 },
  { name: "Typical Chest Pain", key: "typicalChestPain", label: "Typical chest pain", kind: "binary", group: "vitals", default: 0 },
  { name: "Dyspnea", key: "dyspnea", label: "Dyspnea", kind: "binary", group: "vitals", default: 0 },
  { name: "Function Class", key: "functionClass", label: "NYHA function class", kind: "numeric", group: "vitals", min: 0, max: 4, default: 0 },
  { name: "Atypical", key: "atypical", label: "Atypical chest pain", kind: "binary", group: "vitals", default: 0 },
  { name: "Nonanginal", key: "nonanginal", label: "Non-anginal pain", kind: "binary", group: "vitals", default: 0 },
  { name: "Exertional CP", key: "exertionalCp", label: "Exertional chest pain", kind: "binary", group: "vitals", default: 0 },
  { name: "LowTH Ang", key: "lowThAng", label: "Low-threshold angina", kind: "binary", group: "vitals", default: 0 },

  // ----------------------------------------------------------------------- labs
  { name: "FBS", key: "fbs", label: "Fasting blood sugar", kind: "numeric", group: "labs", unit: "mg/dL", min: 40, max: 500, default: 105 },
  { name: "CR", key: "cr", label: "Creatinine", kind: "numeric", group: "labs", unit: "mg/dL", min: 0.2, max: 10, default: 1.0 },
  { name: "TG", key: "tg", label: "Triglycerides", kind: "numeric", group: "labs", unit: "mg/dL", min: 30, max: 900, default: 140 },
  { name: "LDL", key: "ldl", label: "LDL cholesterol", kind: "numeric", group: "labs", unit: "mg/dL", min: 10, max: 300, default: 103 },
  { name: "HDL", key: "hdl", label: "HDL cholesterol", kind: "numeric", group: "labs", unit: "mg/dL", min: 10, max: 120, default: 41 },
  { name: "BUN", key: "bun", label: "Blood urea nitrogen", kind: "numeric", group: "labs", unit: "mg/dL", min: 3, max: 120, default: 17 },
  { name: "ESR", key: "esr", label: "Erythrocyte sed. rate", kind: "numeric", group: "labs", unit: "mm/h", min: 0, max: 120, default: 19 },
  { name: "HB", key: "hb", label: "Hemoglobin", kind: "numeric", group: "labs", unit: "g/dL", min: 5, max: 20, default: 13.2 },
  { name: "K", key: "k", label: "Potassium", kind: "numeric", group: "labs", unit: "mEq/L", min: 2, max: 7, default: 4.2 },
  { name: "Na", key: "na", label: "Sodium", kind: "numeric", group: "labs", unit: "mEq/L", min: 110, max: 160, default: 141 },
  { name: "WBC", key: "wbc", label: "White blood cells", kind: "numeric", group: "labs", unit: "cells/mL", min: 2000, max: 25000, default: 7500 },
  { name: "Lymph", key: "lymph", label: "Lymphocytes", kind: "numeric", group: "labs", unit: "%", min: 2, max: 80, default: 32 },
  { name: "Neut", key: "neut", label: "Neutrophils", kind: "numeric", group: "labs", unit: "%", min: 20, max: 95, default: 60 },
  { name: "PLT", key: "plt", label: "Platelets", kind: "numeric", group: "labs", unit: "10³/µL", min: 20, max: 800, default: 221 },

  // ------------------------------------------------------------------------ ecg
  { name: "Q Wave", key: "qWave", label: "Pathologic Q wave", kind: "binary", group: "ecg", default: 0 },
  { name: "St Elevation", key: "stElevation", label: "ST elevation", kind: "binary", group: "ecg", default: 0 },
  { name: "St Depression", key: "stDepression", label: "ST depression", kind: "binary", group: "ecg", default: 0 },
  { name: "Tinversion", key: "tInversion", label: "T-wave inversion", kind: "binary", group: "ecg", default: 0 },
  { name: "LVH", key: "lvh", label: "Left ventricular hypertrophy", kind: "binary", group: "ecg", default: 0 },
  { name: "Poor R Progression", key: "poorR", label: "Poor R progression", kind: "binary", group: "ecg", default: 0 },
  { name: "BBB", key: "bbb", label: "Bundle branch block", kind: "categorical", group: "ecg", categories: ["N", "LBBB", "RBBB"], default: "N" },

  // ----------------------------------------------------------------------- echo
  { name: "EF-TTE", key: "ef", label: "Ejection fraction (TTE)", kind: "numeric", group: "echo", unit: "%", min: 10, max: 80, default: 50 },
  { name: "Region RWMA", key: "rwma", label: "Regional wall-motion abnormality", kind: "numeric", group: "echo", min: 0, max: 4, default: 0 },
  { name: "VHD", key: "vhd", label: "Valvular heart disease", kind: "categorical", group: "echo", categories: ["N", "mild", "Moderate", "Severe"], default: "N" },
];

export const FEATURE_BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));
export const FEATURE_BY_NAME = new Map(FEATURES.map((f) => [f.name.toLowerCase(), f]));

export const GROUP_LABELS: Record<FeatureDef["group"], string> = {
  demographics: "Demographics & history",
  vitals: "Vital signs & examination",
  labs: "Laboratory measurements",
  ecg: "ECG findings",
  echo: "Echocardiographic findings",
};

export type TargetKey = "cad" | "lad" | "lcx" | "rca";

export interface TargetDef {
  key: TargetKey;
  column: string;
  label: string;
  shortLabel: string;
  positiveLabel: string;
  /** values (lowercased) that map to the positive class */
  positiveValues: string[];
  negativeValues: string[];
}

export const TARGETS: TargetDef[] = [
  {
    key: "cad",
    column: "Cath",
    label: "Overall coronary artery disease",
    shortLabel: "CAD",
    positiveLabel: "CAD",
    positiveValues: ["cad", "1", "yes", "positive", "stenotic"],
    negativeValues: ["normal", "0", "no", "negative"],
  },
  {
    key: "lad",
    column: "LAD",
    label: "Left anterior descending stenosis",
    shortLabel: "LAD",
    positiveLabel: "Stenotic",
    positiveValues: ["stenotic", "1", "yes", "positive", "cad"],
    negativeValues: ["normal", "0", "no", "negative"],
  },
  {
    key: "lcx",
    column: "LCX",
    label: "Left circumflex stenosis",
    shortLabel: "LCX",
    positiveLabel: "Stenotic",
    positiveValues: ["stenotic", "1", "yes", "positive", "cad"],
    negativeValues: ["normal", "0", "no", "negative"],
  },
  {
    key: "rca",
    column: "RCA",
    label: "Right coronary artery stenosis",
    shortLabel: "RCA",
    positiveLabel: "Stenotic",
    positiveValues: ["stenotic", "1", "yes", "positive", "cad"],
    negativeValues: ["normal", "0", "no", "negative"],
  },
];

export const TARGET_BY_KEY = new Map(TARGETS.map((t) => [t.key, t]));

/**
 * Columns that directly leak a coronary angiography result. These are *never*
 * allowed into the model input matrix for any target.
 */
export const LEAKAGE_COLUMNS = [
  "cath",
  "lad",
  "lcx",
  "rca",
  "cad",
  "cath result",
  "cathresult",
  "target",
  "label",
  "class",
  "num_vessels",
  "vessel count",
  "stenosis",
];

export function isLeakageColumn(column: string): boolean {
  const c = column.trim().toLowerCase();
  return LEAKAGE_COLUMNS.includes(c);
}

export type Row = Record<string, string | number | null>;

/** Minimal, dependency-free RFC4180-ish CSV parser. */
export function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  const rows: Row[] = nonEmpty.slice(1).map((r) => {
    const obj: Row = {};
    headers.forEach((h, idx) => {
      const raw = (r[idx] ?? "").trim();
      obj[h] = raw === "" ? null : raw;
    });
    return obj;
  });
  return { headers, rows };
}

export function resolveColumn(headers: string[], wanted: string, aliases: string[] = []): string | null {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_.-]/g, "");
  const want = [wanted, ...aliases].map(norm);
  for (const h of headers) if (want.includes(norm(h))) return h;
  return null;
}

export function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const v = value.trim().toLowerCase();
  if (v === "" || v === "na" || v === "n/a" || v === "null" || v === "?") return null;
  if (["y", "yes", "true", "positive"].includes(v)) return 1;
  if (["n", "no", "false", "negative"].includes(v)) return 0;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function mapTargetValue(target: TargetDef, raw: string | number | null): 0 | 1 | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "") return null;
  if (target.positiveValues.includes(v)) return 1;
  if (target.negativeValues.includes(v)) return 0;
  return null;
}
