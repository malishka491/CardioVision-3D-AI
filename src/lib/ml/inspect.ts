import { FEATURES, TARGETS, isLeakageColumn, mapTargetValue, resolveColumn, toNumber, type Row } from "./schema";

export interface ColumnReport {
  name: string;
  inferredType: "numeric" | "categorical";
  missing: number;
  missingPct: number;
  unique: number;
  mean?: number;
  min?: number;
  max?: number;
  topValues?: { value: string; count: number }[];
  isLeakage: boolean;
  mappedFeature: string | null;
}

export interface DatasetReport {
  fileName: string;
  nRows: number;
  nColumns: number;
  duplicateRows: number;
  columns: ColumnReport[];
  mappedFeatures: { feature: string; column: string }[];
  missingFeatureColumns: string[];
  extraColumns: string[];
  leakageColumns: string[];
  targets: {
    key: string;
    column: string;
    present: boolean;
    usableRows: number;
    positives: number;
    negatives: number;
    unmappedValues: string[];
    reason?: string;
  }[];
  warnings: string[];
  trainable: boolean;
}

export function inspectDataset(fileName: string, headers: string[], rows: Row[]): DatasetReport {
  const warnings: string[] = [];
  const featureColumn = new Map<string, string>();
  const mappedFeatures: { feature: string; column: string }[] = [];
  const missingFeatureColumns: string[] = [];
  for (const f of FEATURES) {
    const col = resolveColumn(headers, f.name, f.aliases);
    if (col) {
      featureColumn.set(col, f.name);
      mappedFeatures.push({ feature: f.name, column: col });
    } else missingFeatureColumns.push(f.name);
  }

  const columns: ColumnReport[] = headers.map((h) => {
    const values = rows.map((r) => r[h]);
    const missing = values.filter((v) => v === null || v === undefined || String(v).trim() === "").length;
    const present = values.filter((v) => v !== null && String(v).trim() !== "");
    const numeric = present.map((v) => toNumber(v)).filter((v): v is number => v !== null);
    const isNumeric = present.length > 0 && numeric.length / present.length > 0.9;
    const uniqueSet = new Set(present.map((v) => String(v)));
    const counts = new Map<string, number>();
    present.forEach((v) => counts.set(String(v), (counts.get(String(v)) ?? 0) + 1));
    const topValues = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));
    return {
      name: h,
      inferredType: isNumeric ? "numeric" : "categorical",
      missing,
      missingPct: rows.length ? (missing / rows.length) * 100 : 0,
      unique: uniqueSet.size,
      mean: isNumeric && numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : undefined,
      min: isNumeric && numeric.length ? Math.min(...numeric) : undefined,
      max: isNumeric && numeric.length ? Math.max(...numeric) : undefined,
      topValues: isNumeric ? undefined : topValues,
      isLeakage: isLeakageColumn(h),
      mappedFeature: featureColumn.get(h) ?? null,
    };
  });

  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const r of rows) {
    const key = headers.map((h) => String(r[h] ?? "")).join("|");
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  }

  const targetReports = TARGETS.map((t) => {
    const col = resolveColumn(headers, t.column);
    if (!col) {
      return {
        key: t.key,
        column: t.column,
        present: false,
        usableRows: 0,
        positives: 0,
        negatives: 0,
        unmappedValues: [],
        reason: `Column "${t.column}" not found — ${t.shortLabel} prediction cannot be trained. Add a "${t.column}" column with ${t.positiveLabel}/Normal (or 1/0) values.`,
      };
    }
    const mapped = rows.map((r) => mapTargetValue(t, r[col]));
    const unmapped = new Set<string>();
    rows.forEach((r, i) => {
      if (mapped[i] === null && r[col] !== null && String(r[col]).trim() !== "") unmapped.add(String(r[col]));
    });
    const positives = mapped.filter((v) => v === 1).length;
    const negatives = mapped.filter((v) => v === 0).length;
    return {
      key: t.key,
      column: t.column,
      present: true,
      usableRows: positives + negatives,
      positives,
      negatives,
      unmappedValues: Array.from(unmapped).slice(0, 8),
    };
  });

  const leakageColumns = headers.filter((h) => isLeakageColumn(h));
  const extraColumns = headers.filter((h) => !featureColumn.has(h) && !isLeakageColumn(h));

  if (rows.length < 100) warnings.push("Fewer than 100 records — evaluation results will be highly preliminary.");
  if (duplicateRows > 0) warnings.push(`${duplicateRows} duplicate row(s) detected.`);
  if (missingFeatureColumns.length > 0)
    warnings.push(`${missingFeatureColumns.length} expected clinical column(s) are missing; they will be treated as missing and imputed at training time.`);
  for (const tr of targetReports) {
    if (tr.present && tr.usableRows > 0) {
      const minClass = Math.min(tr.positives, tr.negatives);
      if (minClass / tr.usableRows < 0.2) warnings.push(`Class imbalance for ${tr.column}: ${tr.positives} positive / ${tr.negatives} negative. Class weighting is applied during training.`);
      if (tr.unmappedValues.length) warnings.push(`Unrecognised values in ${tr.column}: ${tr.unmappedValues.join(", ")}.`);
    }
  }
  const trainable = targetReports.some((t) => t.present && t.usableRows >= 40 && Math.min(t.positives, t.negatives) >= 8);
  if (!trainable) warnings.push("No target has enough labelled rows (>=40 rows, >=8 per class) to train a model.");

  return {
    fileName,
    nRows: rows.length,
    nColumns: headers.length,
    duplicateRows,
    columns,
    mappedFeatures,
    missingFeatureColumns,
    extraColumns,
    leakageColumns,
    targets: targetReports,
    warnings,
    trainable,
  };
}
