import { z } from "zod";
import { FEATURES } from "@/lib/ml/schema";

/** Zod schema generated from the declared clinical feature set. */
export const patientSchema = z
  .object(
    Object.fromEntries(
      FEATURES.map((f) => {
        if (f.kind === "categorical") {
          const cats = f.categories ?? [];
          return [f.key, z.enum(cats as [string, ...string[]]).optional()];
        }
        let s = z.coerce.number({ message: `${f.label} must be numeric` });
        if (f.min !== undefined) s = s.min(f.min, `${f.label} must be >= ${f.min}${f.unit ? ` ${f.unit}` : ""}`);
        if (f.max !== undefined) s = s.max(f.max, `${f.label} must be <= ${f.max}${f.unit ? ` ${f.unit}` : ""}`);
        if (f.kind === "binary") s = z.coerce.number().min(0).max(1);
        return [f.key, s.optional()];
      }),
    ) as Record<string, z.ZodTypeAny>,
  )
  .strict();

export const predictRequestSchema = z.object({
  features: patientSchema,
  source: z.enum(["user-entered", "synthetic-demo"]).default("user-entered"),
});

export type PatientInput = z.infer<typeof patientSchema>;

export function requiredMissing(features: Record<string, unknown>): string[] {
  const required = ["age", "sex", "bp", "pr", "fbs", "ldl", "hdl", "ef"];
  return required.filter((k) => features[k] === undefined || features[k] === null || features[k] === "");
}

export function formatZodError(err: z.ZodError): { field: string; message: string }[] {
  return err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}
