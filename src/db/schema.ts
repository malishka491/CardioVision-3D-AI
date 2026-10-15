import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Trained model runs. The full fitted pipeline (preprocessor + model +
 * calibrator + metrics) is stored as JSON so inference never retrains.
 */
export const trainingRuns = pgTable("training_runs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  datasetName: text("dataset_name").notNull(),
  datasetKind: text("dataset_kind").notNull(), // 'synthetic' | 'uploaded'
  nRows: integer("n_rows").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  artifact: jsonb("artifact").notNull(),
});

/**
 * Prediction audit log. By design this stores NO raw patient feature values —
 * only the model output, the run used, and whether the input was a synthetic
 * demo record.
 */
export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  runId: integer("run_id").notNull(),
  source: text("source").notNull(), // 'user-entered' | 'synthetic-demo'
  predictions: jsonb("predictions").notNull(),
});

/** Dataset upload validation reports (summary statistics only, never rows). */
export const datasetReports = pgTable("dataset_reports", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  fileName: text("file_name").notNull(),
  nRows: integer("n_rows").notNull(),
  report: jsonb("report").notNull(),
});
