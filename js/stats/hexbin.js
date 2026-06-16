/**
 * hexbin.js — Binning hexagonal de una nube de puntos.
 *
 * Asigna cada punto (x, y) a la celda hexagonal más cercana de una rejilla y
 * cuenta cuántos caen en cada una, para representar la densidad de un diagrama
 * de dispersión saturado. El binning se hace en un espacio normalizado [0, 1]²
 * y los centros se devuelven en las coordenadas originales.
 */

/** Centro hexagonal (en espacio normalizado) más cercano a (x, y). */
function nearestHexCenter(x, y, dx, dy) {
  let pj = Math.round(y / dy);
  let px = x / dx - (pj & 1 ? 0.5 : 0);
  let pi = Math.round(px);
  const py1 = y / dy - pj;

  if (Math.abs(py1) * 3 > 1) {
    const px1 = px - pi;
    const pi2 = pi + (px < pi ? -1 : 1) / 2;
    const pj2 = pj + (y / dy < pj ? -1 : 1);
    const px2 = x / dx - (pj2 & 1 ? 0.5 : 0);
    const d1 = px1 * px1 + py1 * py1;
    const d2 = (px2 - pi2) ** 2 + (y / dy - pj2) ** 2;
    if (d2 < d1) { pi = Math.round(px2 - (pi2 % 1)); pj = pj2; }
  }
  const cx = (pi + (pj & 1 ? 0.5 : 0)) * dx;
  const cy = pj * dy;
  return { cx, cy, key: `${pi}:${pj}` };
}

/**
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {number} nx  nº aproximado de hexágonos a lo ancho
 * @returns {{ cells: Array<{x:number,y:number,count:number}>, max:number }}
 *          centros en coordenadas de datos y conteo por celda
 */
export function hexbin(xs, ys, nx = 18) {
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const w = xMax - xMin || 1;
  const h = yMax - yMin || 1;

  const radius = 1 / nx;
  const dx = radius * Math.sqrt(3);
  const dy = radius * 1.5;

  const bins = new Map();
  for (let i = 0; i < xs.length; i += 1) {
    const nxq = (xs[i] - xMin) / w;
    const nyq = (ys[i] - yMin) / h;
    const { cx, cy, key } = nearestHexCenter(nxq, nyq, dx, dy);
    const b = bins.get(key) || { cx, cy, count: 0 };
    b.count += 1;
    bins.set(key, b);
  }

  let max = 0;
  const cells = [...bins.values()].map((b) => {
    max = Math.max(max, b.count);
    return { x: xMin + b.cx * w, y: yMin + b.cy * h, count: b.count };
  });
  return { cells, max };
}
