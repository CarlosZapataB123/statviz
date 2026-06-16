/**
 * density.js — Densidad univariada y disposición en enjambre.
 *
 * Estimación de densidad por núcleo gaussiano (KDE 1D) con ancho de banda de
 * Silverman, y cálculo de carriles para gráficos de enjambre (beeswarm), que
 * sustentan ridgeline, beeswarm y raincloud.
 */

/** Cuantil por interpolación lineal sobre el vector ordenado. */
function quantileSorted(sorted, p) {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Ancho de banda de Silverman (regla del pulgar). */
export function silvermanBandwidth(values) {
  const n = values.length;
  if (n < 2) return 1;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) || 0;
  const sorted = [...values].sort((a, b) => a - b);
  const iqr = quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25);
  const sigma = Math.min(sd || Infinity, (iqr / 1.349) || Infinity);
  const s = Number.isFinite(sigma) && sigma > 0 ? sigma : sd || 1;
  return 0.9 * s * Math.pow(n, -1 / 5);
}

/** Cuadrícula de n puntos equiespaciados en [min, max]. */
export function axisGrid(min, max, n = 64) {
  if (n < 2) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + i * step);
}

/** Densidad gaussiana evaluada en cada punto de la rejilla. */
export function kde1d(values, grid, bandwidth) {
  const h = bandwidth || silvermanBandwidth(values);
  const c = 1 / (values.length * h * Math.sqrt(2 * Math.PI));
  return grid.map((x) => {
    let s = 0;
    for (const v of values) {
      const z = (x - v) / h;
      s += Math.exp(-0.5 * z * z);
    }
    return c * s;
  });
}

/**
 * Asigna a cada valor un “carril” entero (0, ±1, ±2…) para un gráfico de
 * enjambre, evitando que se solapen puntos cercanos en el eje de valores.
 * @param {number[]} values
 * @param {number} yBin  separación mínima en el eje de valores
 * @returns {number[]} carril (entero con signo) por punto
 */
export function beeswarmOffsets(values, yBin) {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const placed = [];
  const lane = new Array(values.length).fill(0);
  const candidates = [0];
  for (let k = 1; k < 300; k += 1) { candidates.push(k, -k); }

  for (const { v, i } of order) {
    const used = placed.filter((p) => Math.abs(p.v - v) < yBin).map((p) => p.lane);
    let chosen = 0;
    for (const c of candidates) {
      if (!used.includes(c)) { chosen = c; break; }
    }
    lane[i] = chosen;
    placed.push({ v, lane: chosen });
  }
  return lane;
}
