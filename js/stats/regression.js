/**
 * regression.js — Motor de regresión lineal por mínimos cuadrados (OLS).
 *
 * Incluye el álgebra matricial mínima (transpuesta, producto, inversa por
 * Gauss–Jordan) y, sobre ella, el ajuste de modelos simples y múltiples con su
 * inferencia (errores estándar, t y p de cada coeficiente, F global, R² y R²
 * ajustado) y el diagnóstico clásico: valores de apalancamiento (hat),
 * residuos estandarizados y distancia de Cook.
 *
 * Sin librerías externas. Pensado para un número moderado de predictores.
 */

import { studentTCdf, fCdf } from "./distributions.js";

/* ======================= Álgebra matricial ============================= */

/** Transpuesta de una matriz (array de filas). */
function transpose(A) {
  const r = A.length;
  const c = A[0].length;
  const T = Array.from({ length: c }, () => new Array(r));
  for (let i = 0; i < r; i += 1) for (let j = 0; j < c; j += 1) T[j][i] = A[i][j];
  return T;
}

/** Producto de matrices A·B. */
function matMul(A, B) {
  const r = A.length;
  const n = B.length;
  const c = B[0].length;
  const M = Array.from({ length: r }, () => new Array(c).fill(0));
  for (let i = 0; i < r; i += 1) {
    for (let k = 0; k < n; k += 1) {
      const a = A[i][k];
      for (let j = 0; j < c; j += 1) M[i][j] += a * B[k][j];
    }
  }
  return M;
}

/** Producto matriz–vector A·v. */
function matVec(A, v) {
  return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0));
}

/** Inversa de una matriz cuadrada por eliminación de Gauss–Jordan. */
function invert(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col += 1) {
    // Pivoteo parcial.
    let piv = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) throw new Error("Matriz singular: predictores colineales.");
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j += 1) M[col][j] /= d;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = 0; j < 2 * n; j += 1) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(n));
}

/* ======================= Ajuste y diagnóstico ========================== */

/** Cuadrícula equiespaciada de n puntos en [a, b]. */
export function linrange(a, b, n = 100) {
  if (n < 2) return [a];
  const step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => a + i * step);
}

/** Matriz de diseño polinómica [x, x², …, x^grado] (sin intercepto). */
export function polyDesign(xs, degree) {
  return xs.map((x) => Array.from({ length: degree }, (_, d) => x ** (d + 1)));
}

/**
 * Ajusta un modelo lineal y = Xβ + ε por mínimos cuadrados.
 * @param {number[][]} predictors  Filas de predictores SIN intercepto
 * @param {number[]} y
 * @param {string[]} [names]  Nombres de los predictores (para etiquetar)
 * @returns {Object} modelo con coeficientes, inferencia y diagnóstico
 */
export function linearModel(predictors, y, names = []) {
  const n = y.length;
  const k = predictors[0] ? predictors[0].length : 0; // nº de predictores
  const p = k + 1; // parámetros (incluye intercepto)

  // Matriz de diseño con columna de unos.
  const X = predictors.map((row) => [1, ...row]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = invert(XtX);
  const Xty = matVec(Xt, y);
  const beta = matVec(XtXinv, Xty);

  const fitted = matVec(X, beta);
  const residuals = y.map((yi, i) => yi - fitted[i]);

  const sse = residuals.reduce((s, e) => s + e * e, 0);
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const sst = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const ssr = sst - sse;
  const dfRes = Math.max(1, n - p);
  const sigma2 = sse / dfRes;
  const sigma = Math.sqrt(sigma2);

  const r2 = sst > 0 ? 1 - sse / sst : 0;
  const adjR2 = sst > 0 ? 1 - (sse / dfRes) / (sst / (n - 1)) : 0;

  // Inferencia de coeficientes.
  const se = beta.map((_, j) => Math.sqrt(sigma2 * XtXinv[j][j]));
  const tStat = beta.map((b, j) => (se[j] ? b / se[j] : 0));
  const pVal = tStat.map((t) => 2 * (1 - studentTCdf(Math.abs(t), dfRes)));

  // F global.
  const fStat = k > 0 ? (ssr / k) / sigma2 : 0;
  const fP = k > 0 ? 1 - fCdf(fStat, k, dfRes) : 1;

  // Diagnóstico: apalancamiento, residuos estandarizados y Cook.
  const leverage = X.map((xi) => {
    const a = matVec(XtXinv, xi); // XtXinv · xi
    return xi.reduce((s, v, j) => s + v * a[j], 0); // xi · (XtXinv·xi)
  });
  const stdResiduals = residuals.map((e, i) => {
    const den = sigma * Math.sqrt(Math.max(1e-12, 1 - leverage[i]));
    return e / den;
  });
  const cooks = stdResiduals.map((r, i) =>
    ((r * r) / p) * (leverage[i] / Math.max(1e-12, 1 - leverage[i]))
  );

  const coefNames = ["(Intercepto)", ...(names.length ? names : predictors[0] ? predictors[0].map((_, j) => `x${j + 1}`) : [])];

  return {
    n, k, p, dfRes,
    coefficients: beta, coefNames, se, tStat, pVal,
    fitted, residuals, sigma, r2, adjR2, fStat, fP,
    leverage, stdResiduals, cooks, XtXinv,
  };
}

/**
 * Predice la respuesta media y su error estándar en puntos x (regresión
 * simple), para dibujar la banda de confianza.
 * @returns {{ yhat:number[], seMean:number[] }}
 */
export function predictSimple(model, xs) {
  const yhat = xs.map((x) => model.coefficients[0] + model.coefficients[1] * x);
  const seMean = xs.map((x) => {
    const xi = [1, x];
    const a = matVec(model.XtXinv, xi);
    const h = xi.reduce((s, v, j) => s + v * a[j], 0);
    return model.sigma * Math.sqrt(Math.max(0, h));
  });
  return { yhat, seMean };
}
