/**
 * Seeded SYNTHETIC cohort generator.
 *
 * IMPORTANT HONESTY NOTE: these records are *simulated*. They are generated
 * from a hand-written latent risk model that mimics the marginal distributions
 * and risk-factor directions reported for the Z-Alizadeh Sani dataset. They are
 * NOT real patients and NOT the real dataset. Any model trained on them must be
 * labelled "synthetic" everywhere in the UI, and its metrics must never be
 * presented as real-world clinical performance.
 */
import { FEATURES, type Row } from "./schema";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number, mean: number, sd: number) {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const bern = (rand: () => number, p: number) => (rand() < p ? 1 : 0);
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

export const SYNTHETIC_DATASET_NAME = "Synthetic Z-Alizadeh-style cohort (SIMULATED)";

export function generateSyntheticCohort(n = 420, seed = 20260207): Row[] {
  const rand = mulberry32(seed);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const male = bern(rand, 0.58);
    const age = clamp(Math.round(gauss(rand, male ? 57 : 60, 10)), 30, 88);
    const height = clamp(Math.round(gauss(rand, male ? 172 : 159, 8)), 140, 198);
    const weight = clamp(Math.round(gauss(rand, male ? 79 : 72, 13)), 42, 150);
    const bmi = round(weight / (height / 100) ** 2, 1);
    const dm = bern(rand, sigmoid(-2.2 + 0.05 * (bmi - 26) + 0.02 * (age - 55)));
    const htn = bern(rand, sigmoid(-0.9 + 0.035 * (age - 55) + 0.05 * (bmi - 26)));
    const currentSmoker = bern(rand, male ? 0.28 : 0.05);
    const exSmoker = currentSmoker ? 0 : bern(rand, male ? 0.14 : 0.03);
    const fh = bern(rand, 0.17);
    const obesity = bmi >= 30 ? 1 : 0;
    const crf = bern(rand, 0.05);
    const cva = bern(rand, 0.04);
    const thyroid = bern(rand, 0.07);
    const chf = bern(rand, 0.03);
    const dlp = bern(rand, sigmoid(-1.1 + 0.3 * dm));

    const bp = clamp(Math.round(gauss(rand, 126 + 10 * htn, 17)), 85, 210);
    const pr = clamp(Math.round(gauss(rand, 75, 11)), 45, 140);
    const typicalChestPain = bern(rand, sigmoid(-1.3 + 0.02 * (age - 55) + 0.5 * dm + 0.4 * male));
    const atypical = typicalChestPain ? 0 : bern(rand, 0.3);
    const nonanginal = typicalChestPain || atypical ? 0 : bern(rand, 0.2);
    const exertionalCp = bern(rand, 0.1 + 0.25 * typicalChestPain);
    const lowThAng = bern(rand, 0.05 + 0.15 * typicalChestPain);
    const dyspnea = bern(rand, 0.3 + 0.2 * chf);
    const functionClass = dyspnea ? 1 + Math.floor(rand() * 3) : 0;
    const edema = bern(rand, 0.04 + 0.3 * chf);
    const weakPulse = bern(rand, 0.03);
    const lungRales = bern(rand, 0.04 + 0.3 * chf);
    const systolicMurmur = bern(rand, 0.12);
    const diastolicMurmur = bern(rand, 0.04);

    const fbs = clamp(Math.round(gauss(rand, dm ? 165 : 99, dm ? 55 : 18)), 55, 450);
    const cr = round(clamp(gauss(rand, crf ? 2.0 : 1.03, crf ? 0.8 : 0.22), 0.4, 8), 2);
    const tg = clamp(Math.round(gauss(rand, 140 + 30 * dlp, 60)), 40, 700);
    const ldl = clamp(Math.round(gauss(rand, 103 + 18 * dlp, 32)), 25, 280);
    const hdl = clamp(Math.round(gauss(rand, male ? 38 : 45, 10)), 15, 100);
    const bun = clamp(Math.round(gauss(rand, crf ? 32 : 17, 7)), 5, 100);
    const esr = clamp(Math.round(gauss(rand, 19, 14)), 1, 110);
    const hb = round(clamp(gauss(rand, male ? 14.4 : 12.7, 1.6), 7, 19), 1);
    const k = round(clamp(gauss(rand, 4.2, 0.45), 2.6, 6.5), 1);
    const na = Math.round(clamp(gauss(rand, 141, 3.6), 120, 155));
    const wbc = Math.round(clamp(gauss(rand, 7300, 2100), 2600, 20000));
    const neut = Math.round(clamp(gauss(rand, 60, 10), 25, 92));
    const lymph = Math.round(clamp(100 - neut - gauss(rand, 7, 3), 3, 70));
    const plt = Math.round(clamp(gauss(rand, 222, 65), 40, 650));

    // Latent disease burden — drives both ECG/echo findings and angiography.
    const latent =
      -2.35 +
      0.045 * (age - 55) +
      0.75 * male +
      0.85 * typicalChestPain +
      0.55 * dm +
      0.4 * htn +
      0.45 * currentSmoker +
      0.25 * exSmoker +
      0.3 * fh +
      0.25 * dlp +
      0.012 * (ldl - 100) -
      0.02 * (hdl - 42) +
      0.004 * (tg - 140) +
      0.012 * (bp - 125) +
      0.35 * crf +
      0.3 * lowThAng +
      gauss(rand, 0, 0.8);

    const pDisease = sigmoid(latent);
    const stDepression = bern(rand, sigmoid(-3.1 + 2.2 * pDisease));
    const tInversion = bern(rand, sigmoid(-2.3 + 2.4 * pDisease));
    const qWave = bern(rand, sigmoid(-3.5 + 2.0 * pDisease));
    const stElevation = bern(rand, sigmoid(-3.9 + 1.6 * pDisease));
    const lvh = bern(rand, sigmoid(-3.0 + 1.1 * htn + 0.6 * pDisease));
    const poorR = bern(rand, sigmoid(-3.2 + 1.5 * pDisease));
    const bbbRoll = rand();
    const bbb = bbbRoll < 0.05 + 0.05 * pDisease ? "LBBB" : bbbRoll < 0.09 + 0.06 * pDisease ? "RBBB" : "N";
    const rwma = bern(rand, sigmoid(-3.0 + 3.2 * pDisease)) ? 1 + Math.floor(rand() * 4) : 0;
    const ef = Math.round(clamp(gauss(rand, 52 - 7 * pDisease - 3 * (rwma > 0 ? 1 : 0), 7), 15, 70));
    const vhdRoll = rand();
    const vhd = vhdRoll < 0.55 ? "N" : vhdRoll < 0.85 ? "mild" : vhdRoll < 0.96 ? "Moderate" : "Severe";

    // Vessel-specific latents (correlated, with distinct emphases).
    const lLad = latent + 0.9 * stDepression + 0.8 * (rwma > 0 ? 1 : 0) + 0.5 * tInversion + gauss(rand, 0.25, 0.7);
    const lLcx = latent - 0.6 + 0.5 * tInversion + 0.4 * (rwma > 0 ? 1 : 0) + gauss(rand, 0, 0.75);
    const lRca = latent - 0.45 + 0.6 * qWave + 0.4 * stElevation + 0.35 * (pr < 60 ? 1 : 0) + gauss(rand, 0, 0.75);

    const lad = bern(rand, sigmoid(lLad));
    const lcx = bern(rand, sigmoid(lLcx));
    const rca = bern(rand, sigmoid(lRca));
    const cad = lad || lcx || rca ? "Cad" : "Normal";

    const row: Row = {
      Age: age,
      Sex: male ? "Male" : "Fmale",
      Weight: weight,
      Length: height,
      BMI: bmi,
      DM: dm,
      HTN: htn,
      "Current Smoker": currentSmoker,
      "EX-Smoker": exSmoker,
      FH: fh,
      Obesity: obesity,
      CRF: crf,
      CVA: cva,
      "Thyroid Disease": thyroid,
      CHF: chf,
      DLP: dlp,
      BP: bp,
      PR: pr,
      Edema: edema,
      "Weak Peripheral Pulse": weakPulse,
      "Lung rales": lungRales,
      "Systolic Murmur": systolicMurmur,
      "Diastolic Murmur": diastolicMurmur,
      "Typical Chest Pain": typicalChestPain,
      Dyspnea: dyspnea,
      "Function Class": functionClass,
      Atypical: atypical,
      Nonanginal: nonanginal,
      "Exertional CP": exertionalCp,
      "LowTH Ang": lowThAng,
      FBS: fbs,
      CR: cr,
      TG: tg,
      LDL: ldl,
      HDL: hdl,
      BUN: bun,
      ESR: esr,
      HB: hb,
      K: k,
      Na: na,
      WBC: wbc,
      Lymph: lymph,
      Neut: neut,
      PLT: plt,
      "Q Wave": qWave,
      "St Elevation": stElevation,
      "St Depression": stDepression,
      Tinversion: tInversion,
      LVH: lvh,
      "Poor R Progression": poorR,
      BBB: bbb,
      "EF-TTE": ef,
      "Region RWMA": rwma,
      VHD: vhd,
      Cath: cad,
      LAD: lad ? "Stenotic" : "Normal",
      LCX: lcx ? "Stenotic" : "Normal",
      RCA: rca ? "Stenotic" : "Normal",
    };
    rows.push(row);
  }
  return rows;
}

/** A single clearly-labelled synthetic demonstration patient (feature keys). */
export function syntheticDemoPatient(profile: "low" | "high" = "high"): Record<string, number | string> {
  const base: Record<string, number | string> = {};
  for (const f of FEATURES) base[f.key] = f.default;
  if (profile === "high") {
    Object.assign(base, {
      age: 67, sex: "Male", weight: 88, height: 170, bmi: 30.4, dm: 1, htn: 1,
      currentSmoker: 1, fh: 1, obesity: 1, dlp: 1, bp: 148, pr: 82,
      typicalChestPain: 1, exertionalCp: 1, lowThAng: 1, dyspnea: 1, functionClass: 2,
      fbs: 186, cr: 1.3, tg: 210, ldl: 152, hdl: 31, bun: 24, esr: 32, hb: 13.1,
      wbc: 8900, neut: 69, lymph: 24, plt: 240,
      stDepression: 1, tInversion: 1, qWave: 1, lvh: 1, ef: 40, rwma: 2,
    });
  } else {
    Object.assign(base, {
      age: 44, sex: "Fmale", weight: 62, height: 164, bmi: 23.1, bp: 118, pr: 70,
      fbs: 88, cr: 0.8, tg: 96, ldl: 88, hdl: 58, bun: 13, esr: 9, hb: 13.4,
      wbc: 6200, neut: 52, lymph: 40, plt: 250, ef: 55, rwma: 0, nonanginal: 1,
    });
  }
  return base;
}
