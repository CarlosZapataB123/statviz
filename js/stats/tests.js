/**
 * tests.js — Utilidades de estadística inferencial.
 *
 * Funciones que alimentan los gráficos de inferencia: resúmenes por grupo con
 * error estándar, intervalos de confianza basados en la t de Student,
 * combinación por varianza inversa (meta-análisis), y construcción de curvas
 * ROC y de precisión–recall con sus áreas. Se apoya en el motor de
 * distribuciones para los valores críticos.
 */

import { studentTInv } from "./distributions.js";

/** Media aritmética. */
function avg(a) {
  return a.reduce((s, v) => s + v, 0) / (a.length || 1);
}

/** Desviación típica muestral (n − 1). */
function sdSample(a) {
  const n = a.length;
  if (n < 2) return 0;
  const m = avg(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
}

/**
 * Resúmenes por grupo de una variable numérica.
 * @returns {Array<{group:string,n:number,mean:number,sd:number,se:number}>}
 */
export function groupStats(rows, valueVar, groupVar) {
  const groups = new Map();
  for (const r of rows) {
    const v = r[valueVar];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const key = groupVar ? String(r[groupVar] ?? "—").trim() : "Total";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  return [...groups.entries()]
    .map(([group, xs]) => {
      const sd = sdSample(xs);
      return { group, n: xs.length, mean: avg(xs), sd, se: xs.length ? sd / Math.sqrt(xs.length) : 0 };
    })
    .sort((a, b) => a.group.localeCompare(b.group, "es"));
}

/**
 * Intervalo de confianza de una media (t de Student).
 * @returns {{lo:number, hi:number, half:number, tcrit:number}}
 */
export function meanCI(mean, se, n, conf = 0.95) {
  const df = Math.max(1, n - 1);
  const tcrit = studentTInv(1 - (1 - conf) / 2, df);
  const half = tcrit * se;
  return { lo: mean - half, hi: mean + half, half, tcrit };
}

/**
 * Combinación por varianza inversa (modelo de efectos fijos).
 * @param {number[]} estimates
 * @param {number[]} ses
 * @returns {{estimate:number, se:number, lo:number, hi:number}}
 */
export function pooledIV(estimates, ses, conf = 0.95) {
  let wsum = 0;
  let wx = 0;
  for (let i = 0; i < estimates.length; i += 1) {
    const w = 1 / (ses[i] * ses[i]);
    if (!Number.isFinite(w)) continue;
    wsum += w;
    wx += w * estimates[i];
  }
  const estimate = wsum ? wx / wsum : NaN;
  const se = wsum ? Math.sqrt(1 / wsum) : NaN;
  const z = studentTInv(1 - (1 - conf) / 2, 1e6); // ≈ normal para gl grandes
  return { estimate, se, lo: estimate - z * se, hi: estimate + z * se };
}

/**
 * Curva ROC y AUC por el método de barrido de umbrales.
 * @param {number[]} scores  Puntuaciones del clasificador
 * @param {boolean[]} positive  Etiqueta positiva por caso
 * @returns {{points:Array<{fpr:number,tpr:number}>, auc:number}}
 */
export function rocCurve(scores, positive) {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
  const P = positive.filter(Boolean).length;
  const N = positive.length - P;
  const points = [{ fpr: 0, tpr: 0 }];
  let tp = 0;
  let fp = 0;
  for (const i of idx) {
    if (positive[i]) tp += 1;
    else fp += 1;
    points.push({ fpr: N ? fp / N : 0, tpr: P ? tp / P : 0 });
  }
  // AUC por regla del trapecio sobre (fpr, tpr).
  let auc = 0;
  for (let k = 1; k < points.length; k += 1) {
    auc += ((points[k].fpr - points[k - 1].fpr) * (points[k].tpr + points[k - 1].tpr)) / 2;
  }
  return { points, auc };
}

/**
 * Curva de precisión–recall y precisión media (AP).
 * @returns {{points:Array<{recall:number,precision:number}>, ap:number, prevalence:number}}
 */
export function prCurve(scores, positive) {
  const idx = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
  const P = positive.filter(Boolean).length;
  const points = [];
  let tp = 0;
  let fp = 0;
  let ap = 0;
  let prevRecall = 0;
  for (const i of idx) {
    if (positive[i]) tp += 1;
    else fp += 1;
    const precision = tp + fp ? tp / (tp + fp) : 1;
    const recall = P ? tp / P : 0;
    points.push({ recall, precision });
    ap += (recall - prevRecall) * precision;
    prevRecall = recall;
  }
  return { points, ap, prevalence: positive.length ? P / positive.length : 0 };
}

/** Determina la categoría "positiva" como la de mayor puntuación media. */
export function positiveLevelByScore(rows, scoreVar, outcomeVar) {
  const byLevel = new Map();
  for (const r of rows) {
    const s = r[scoreVar];
    if (typeof s !== "number" || !Number.isFinite(s)) continue;
    const lv = String(r[outcomeVar] ?? "—").trim();
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(s);
  }
  let best = null;
  let bestMean = -Infinity;
  for (const [lv, xs] of byLevel) {
    const m = avg(xs);
    if (m > bestMean) {
      bestMean = m;
      best = lv;
    }
  }
  return best;
}
