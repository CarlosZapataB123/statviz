/**
 * umap.js — Uniform Manifold Approximation and Projection (UMAP).
 *
 * Implementación fiel y autocontenida, pensada para conjuntos pequeños:
 *  1. Vecinos más cercanos y distancias locales (rho, sigma calibrado a log2 k).
 *  2. Conjunto simplicial difuso dirigido y su unión difusa simétrica.
 *  3. Inicialización espectral (autovectores del Laplaciano normalizado), con
 *     respaldo aleatorio reproducible si degenera.
 *  4. Optimización del layout por entropía cruzada con muestreo negativo y la
 *     curva 1/(1 + a·d^{2b}), cuyos a y b se ajustan a min_dist y spread.
 *
 * Reproducible mediante semilla. Reutiliza el RNG y la eigendescomposición de
 * Jacobi del motor multivariado.
 */

import { mulberry32, jacobiEigen, standardizeColumns } from "./multivariate.js";

/* Distancia euclídea al cuadrado. */
function sqDist(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += (a[i] - b[i]) ** 2;
  return s;
}

/**
 * Ajusta los parámetros a, b de la curva 1/(1 + a·d^{2b}) para que aproxime la
 * meseta definida por min_dist y spread (mínimos cuadrados por búsqueda).
 */
export function fitAB(minDist, spread) {
  const xs = [];
  const phi = [];
  for (let i = 0; i <= 60; i += 1) {
    const x = (3 * spread * i) / 60;
    xs.push(x);
    phi.push(x <= minDist ? 1 : Math.exp(-(x - minDist) / spread));
  }
  let best = { a: 1, b: 1, sse: Infinity };
  for (let bi = 0; bi <= 40; bi += 1) {
    const b = 0.3 + (1.7 * bi) / 40;
    for (let ai = 0; ai <= 40; ai += 1) {
      const a = 0.1 * Math.pow(50, ai / 40); // 0.1 … 5 (logarítmico)
      let sse = 0;
      for (let k = 0; k < xs.length; k += 1) {
        const f = 1 / (1 + a * Math.pow(xs[k], 2 * b));
        sse += (f - phi[k]) ** 2;
      }
      if (sse < best.sse) best = { a, b, sse };
    }
  }
  return { a: best.a, b: best.b };
}

/**
 * Conjunto simplicial difuso simétrico (matriz de pesos n×n en [0, 1]).
 * @returns {{ W:number[][], knn:number[][] }}
 */
export function fuzzySimplicialSet(D, k) {
  const n = D.length;
  const knn = [];
  for (let i = 0; i < n; i += 1) {
    const order = D[i].map((d, j) => ({ d, j })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d);
    knn.push(order.slice(0, k));
  }

  const target = Math.log2(Math.max(2, k));
  const B = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    const dists = knn[i].map((o) => o.d);
    const nonzero = dists.filter((d) => d > 0);
    const rho = nonzero.length ? Math.min(...nonzero) : 0;

    // Búsqueda binaria de sigma para igualar la perplejidad objetivo.
    let lo = 0;
    let hi = Infinity;
    let sigma = 1;
    for (let iter = 0; iter < 64; iter += 1) {
      let sum = 0;
      for (const d of dists) sum += Math.exp(-Math.max(0, d - rho) / sigma);
      if (Math.abs(sum - target) < 1e-5) break;
      if (sum > target) { hi = sigma; sigma = (lo + hi) / 2; }
      else { lo = sigma; sigma = hi === Infinity ? sigma * 2 : (lo + hi) / 2; }
    }
    sigma = Math.max(sigma, 1e-3);
    knn[i].forEach((o) => { B[i][o.j] = Math.exp(-Math.max(0, o.d - rho) / sigma); });
  }

  // Unión difusa: w = a + b − a·b.
  const W = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const a = B[i][j];
      const b = B[j][i];
      W[i][j] = a + b - a * b;
    }
  }
  return { W, knn };
}

/** Inicialización espectral (Laplaciano normalizado); respaldo aleatorio. */
function spectralInit(W, dims, rng) {
  const n = W.length;
  try {
    const deg = W.map((row) => row.reduce((s, v) => s + v, 0));
    const inv = deg.map((d) => (d > 0 ? 1 / Math.sqrt(d) : 0));
    // L_sym = I − D^{-1/2} W D^{-1/2}
    const L = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) - inv[i] * W[i][j] * inv[j])
    );
    const { values, vectors } = jacobiEigen(L);
    // Autovectores de los menores autovalores no triviales (al final del orden).
    const Y = [];
    for (let i = 0; i < n; i += 1) {
      const row = [];
      for (let d = 0; d < dims; d += 1) row.push(vectors[n - 2 - d][i]);
      Y.push(row);
    }
    const maxAbs = Math.max(...Y.flat().map(Math.abs), 1e-9);
    if (!Number.isFinite(maxAbs)) throw new Error("init no finita");
    return Y.map((r) => r.map((v) => (v / maxAbs) * 10 + (rng() - 0.5) * 1e-3));
  } catch {
    return Array.from({ length: n }, () => Array.from({ length: dims }, () => (rng() - 0.5) * 20));
  }
}

/**
 * Proyección UMAP a `dims` dimensiones.
 * @param {number[][]} M  matriz de datos (filas = casos)
 * @returns {number[][]} coordenadas n×dims
 */
export function umap(M, { nNeighbors = 8, minDist = 0.1, spread = 1, nEpochs = 300, seed = 42, negativeSamples = 5, dims = 2 } = {}) {
  const { Z } = standardizeColumns(M);
  const n = Z.length;
  const k = Math.min(nNeighbors, n - 1);
  const rng = mulberry32(seed);

  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) { const d = Math.sqrt(sqDist(Z[i], Z[j])); D[i][j] = D[j][i] = d; }

  const { W } = fuzzySimplicialSet(D, k);
  const { a, b } = fitAB(minDist, spread);
  const Y = spectralInit(W, dims, rng);

  // Aristas (triángulo superior con peso) y su frecuencia de muestreo.
  const edges = [];
  let maxW = 0;
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) if (W[i][j] > 0) { edges.push({ i, j, w: W[i][j] }); maxW = Math.max(maxW, W[i][j]); }
  const eps = edges.map((e) => maxW / e.w); // epochs por muestra
  const nextSample = eps.slice();
  const epsNeg = eps.map((v) => v / negativeSamples);
  const nextNeg = epsNeg.slice();

  const clamp = (x) => Math.max(-4, Math.min(4, x));
  const initialAlpha = 1.0;

  for (let epoch = 0; epoch < nEpochs; epoch += 1) {
    const alpha = initialAlpha * (1 - epoch / nEpochs);
    for (let e = 0; e < edges.length; e += 1) {
      if (nextSample[e] > epoch) continue;
      const { i, j } = edges[e];
      const yi = Y[i];
      const yj = Y[j];
      let d2 = 0;
      for (let d = 0; d < dims; d += 1) d2 += (yi[d] - yj[d]) ** 2;

      // Gradiente atractivo.
      if (d2 > 0) {
        let coeff = (-2 * a * b * Math.pow(d2, b - 1)) / (1 + a * Math.pow(d2, b));
        for (let d = 0; d < dims; d += 1) {
          const g = clamp(coeff * (yi[d] - yj[d]));
          yi[d] += alpha * g;
          yj[d] -= alpha * g;
        }
      }
      nextSample[e] += eps[e];

      // Muestreo negativo (gradiente repulsivo).
      const nNeg = Math.floor((epoch - nextNeg[e]) / epsNeg[e]);
      for (let p = 0; p < nNeg; p += 1) {
        const kk = Math.floor(rng() * n);
        if (kk === i) continue;
        const yk = Y[kk];
        let dn = 0;
        for (let d = 0; d < dims; d += 1) dn += (yi[d] - yk[d]) ** 2;
        for (let d = 0; d < dims; d += 1) {
          let g;
          if (dn > 0) g = clamp((2 * b) / ((0.001 + dn) * (1 + a * Math.pow(dn, b))) * (yi[d] - yk[d]));
          else g = 4;
          yi[d] += alpha * g;
        }
      }
      if (nNeg > 0) nextNeg[e] += nNeg * epsNeg[e];
    }
  }

  // Centrar.
  for (let d = 0; d < dims; d += 1) {
    let m = 0;
    for (let i = 0; i < n; i += 1) m += Y[i][d];
    m /= n;
    for (let i = 0; i < n; i += 1) Y[i][d] -= m;
  }
  return Y;
}
