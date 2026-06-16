/**
 * timeseries.js — Utilidades para series temporales.
 *
 * Ordenación de una serie por su índice temporal y función de autocorrelación
 * (ACF) muestral, que sustenta los gráficos de autocorrelación, de retardo y
 * estacional.
 */

/** Compara dos valores de índice (numérico si ambos lo son; si no, texto). */
function compareIndex(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b), "es");
}

/**
 * Devuelve los valores numéricos de una serie ordenados por su índice temporal.
 * Si no se indica índice, conserva el orden de las filas.
 * @returns {{ index: Array, values: number[] }}
 */
export function orderByTime(rows, timeVar, valueVar) {
  const pairs = rows
    .map((r) => ({ t: timeVar ? r[timeVar] : null, v: r[valueVar] }))
    .filter((p) => typeof p.v === "number" && Number.isFinite(p.v));
  if (timeVar) pairs.sort((a, b) => compareIndex(a.t, b.t));
  return { index: pairs.map((p) => p.t), values: pairs.map((p) => p.v) };
}

/**
 * Función de autocorrelación muestral hasta maxLag.
 * r_k = Σ (y_t − ȳ)(y_{t+k} − ȳ) / Σ (y_t − ȳ)²
 * @returns {Array<{lag:number, r:number}>}  incluye el retardo 0 (r = 1)
 */
export function acf(values, maxLag) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / (n || 1);
  let denom = 0;
  for (const v of values) denom += (v - mean) ** 2;
  const out = [];
  const top = Math.min(maxLag, n - 1);
  for (let k = 0; k <= top; k += 1) {
    let num = 0;
    for (let t = 0; t < n - k; t += 1) num += (values[t] - mean) * (values[t + k] - mean);
    out.push({ lag: k, r: denom > 0 ? num / denom : 0 });
  }
  return out;
}
