/**
 * transformer.js — Transformaciones de datos para análisis y gráficos.
 *
 * Operaciones puras (sin estado) que preparan los datos ya tipados para las
 * fases de visualización e inferencia: manejo de perdidos, tablas de
 * frecuencia, agrupación de histogramas, agregación por grupos y conversión de
 * valores. Reutiliza los ayudantes estadísticos del detector para no duplicar
 * lógica.
 */

import {
  isMissing,
  parseNumber,
  numericSummary,
  frequencyTable,
} from "./detector.js";

/**
 * Filtra filas que tengan algún valor perdido en las variables indicadas
 * (eliminación por lista, “listwise deletion”). Informa cuántas se descartaron.
 * @returns {{ rows: Array, removed: number }}
 */
export function dropMissing(rows, varNames) {
  const names = Array.isArray(varNames) ? varNames : [varNames];
  const kept = rows.filter((row) => names.every((v) => !isMissing(row[v])));
  return { rows: kept, removed: rows.length - kept.length };
}

/** Extrae el vector numérico de una variable (descarta perdidos/no numéricos). */
export function numericVector(rows, varName, decimal = ".") {
  return rows
    .map((row) => {
      const v = row[varName];
      return typeof v === "number" ? v : parseNumber(v, decimal);
    })
    .filter((x) => Number.isFinite(x));
}

/** Regla para el número de clases de un histograma. */
function binCount(values, method) {
  const n = values.length;
  if (n < 2) return 1;
  if (method === "sqrt") return Math.ceil(Math.sqrt(n));
  if (method === "fd") {
    // Freedman–Diaconis.
    const s = numericSummary(values);
    const iqr = s.q3 - s.q1;
    if (iqr <= 0) return Math.ceil(Math.sqrt(n));
    const width = (2 * iqr) / Math.cbrt(n);
    return Math.max(1, Math.ceil((s.max - s.min) / width));
  }
  // Sturges (por defecto).
  return Math.ceil(Math.log2(n) + 1);
}

/**
 * Agrupa un vector numérico en clases para un histograma.
 * @param {number[]} values
 * @param {Object} [opts]
 * @param {number} [opts.bins]   Número fijo de clases (tiene prioridad)
 * @param {"sturges"|"sqrt"|"fd"} [opts.method="sturges"]
 * @returns {Array<{x0:number, x1:number, mid:number, count:number}>}
 */
export function binNumeric(values, opts = {}) {
  const xs = values.filter((x) => Number.isFinite(x));
  if (xs.length === 0) return [];
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (min === max) {
    return [{ x0: min, x1: max, mid: min, count: xs.length }];
  }
  const k = opts.bins && opts.bins > 0 ? opts.bins : binCount(xs, opts.method);
  const width = (max - min) / k;
  const bins = Array.from({ length: k }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    mid: min + (i + 0.5) * width,
    count: 0,
  }));
  for (const x of xs) {
    let idx = Math.floor((x - min) / width);
    if (idx >= k) idx = k - 1; // el máximo cae en la última clase
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  return bins;
}

/** Agregadores disponibles para groupBy. */
const AGGREGATORS = {
  mean: (xs) => numericSummary(xs).mean,
  median: (xs) => numericSummary(xs).median,
  sd: (xs) => numericSummary(xs).sd,
  sum: (xs) => xs.reduce((a, b) => a + b, 0),
  min: (xs) => Math.min(...xs),
  max: (xs) => Math.max(...xs),
  count: (xs) => xs.length,
};

/**
 * Agrega una variable numérica por los niveles de una variable de grupo.
 * @param {Array} rows
 * @param {string} byVar     Variable de agrupación (categórica)
 * @param {string} valueVar  Variable numérica a resumir
 * @param {keyof AGGREGATORS} [agg="mean"]
 * @param {string} [decimal="."]
 * @returns {Array<{ group:string, value:number, n:number }>}
 */
export function groupBy(rows, byVar, valueVar, agg = "mean", decimal = ".") {
  const fn = AGGREGATORS[agg] || AGGREGATORS.mean;
  const groups = new Map();
  for (const row of rows) {
    if (isMissing(row[byVar])) continue;
    const key = String(row[byVar]).trim();
    const raw = row[valueVar];
    const num = typeof raw === "number" ? raw : parseNumber(raw, decimal);
    if (!Number.isFinite(num)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(num);
  }
  return [...groups.entries()]
    .map(([group, xs]) => ({ group, value: fn(xs), n: xs.length }))
    .sort((a, b) => a.group.localeCompare(b.group, "es"));
}

/**
 * Tabla de contingencia (frecuencias conjuntas) de dos variables categóricas.
 * @returns {{ rows:string[], cols:string[], matrix:number[][] }}
 */
export function contingencyTable(rows, rowVar, colVar) {
  const rowKeys = new Set();
  const colKeys = new Set();
  const cell = new Map();
  for (const r of rows) {
    if (isMissing(r[rowVar]) || isMissing(r[colVar])) continue;
    const rk = String(r[rowVar]).trim();
    const ck = String(r[colVar]).trim();
    rowKeys.add(rk);
    colKeys.add(ck);
    const key = `${rk}\u0000${ck}`;
    cell.set(key, (cell.get(key) || 0) + 1);
  }
  const rks = [...rowKeys].sort((a, b) => a.localeCompare(b, "es"));
  const cks = [...colKeys].sort((a, b) => a.localeCompare(b, "es"));
  const matrix = rks.map((rk) =>
    cks.map((ck) => cell.get(`${rk}\u0000${ck}`) || 0)
  );
  return { rows: rks, cols: cks, matrix };
}

/** Convierte el valor de una celda al tipo objetivo (para overrides del usuario). */
export function coerceValue(value, toType, decimal = ".") {
  if (isMissing(value)) return null;
  if (toType === "numeric") {
    const n = parseNumber(value, decimal);
    return Number.isFinite(n) ? n : null;
  }
  if (toType === "categorical" || toType === "boolean") {
    return String(value).trim();
  }
  return value;
}

// Reexportar ayudantes de uso común para los módulos de gráficos.
export { numericSummary, frequencyTable };
