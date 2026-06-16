/**
 * distributions.js — Motor de distribuciones de probabilidad (sin librerías).
 *
 * Implementa las funciones especiales necesarias (logaritmo de la función
 * gamma por la aproximación de Lanczos, función de error, gamma incompleta
 * regularizada y beta incompleta regularizada) y, sobre ellas, la función de
 * densidad/masa, la de distribución acumulada y los cuantiles de las
 * distribuciones de uso común en investigación: Normal, t de Student,
 * ji-cuadrado, F, Exponencial, Weibull, Gamma, Beta, Binomial y Poisson.
 *
 * Precisión: la función de error usa la aproximación de Abramowitz–Stegun
 * (error < 1.5e-7); las series y fracciones continuas siguen el esquema clásico
 * de Numerical Recipes. Suficiente para graficar y para valores p en
 * investigación aplicada.
 *
 * Convención de parámetros:
 *   Exponencial(rate λ) · Weibull(forma k, escala λ) · Gamma(forma k, escala θ)
 *   Beta(α, β) · Binomial(n, p) · Poisson(λ)
 */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/* ===================== Funciones especiales ============================ */

/** Logaritmo de la función gamma (Lanczos, g = 7). */
export function lgammaFn(x) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflexión: Γ(x)Γ(1−x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgammaFn(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Función gamma (para argumentos positivos en el uso de este módulo). */
export function gammaFn(x) {
  return Math.exp(lgammaFn(x));
}

/** Función de error (Abramowitz–Stegun 7.1.26). */
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Gamma incompleta regularizada inferior P(a, x) por serie. */
function gserP(a, x) {
  if (x <= 0) return 0;
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 0; n < 500; n += 1) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgammaFn(a));
}

/** Gamma incompleta regularizada superior Q(a, x) por fracción continua. */
function gcfQ(a, x) {
  const tiny = 1e-30;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgammaFn(a)) * h;
}

/** Gamma incompleta regularizada inferior P(a, x). */
export function regGammaP(a, x) {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  return x < a + 1 ? gserP(a, x) : 1 - gcfQ(a, x);
}

/** Gamma incompleta regularizada superior Q(a, x) = 1 − P(a, x). */
export function regGammaQ(a, x) {
  return 1 - regGammaP(a, x);
}

/** Fracción continua para la beta incompleta (Lentz). */
function betacf(a, b, x) {
  const tiny = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 500; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

/** Beta incompleta regularizada I_x(a, b). */
export function incBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lgammaFn(a + b) - lgammaFn(a) - lgammaFn(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Inversa genérica por bisección de una CDF monótona. */
function inverseByBisection(cdf, p, lo, hi, iters = 200) {
  if (p <= 0) return lo;
  if (p >= 1) return hi;
  let a = lo;
  let b = hi;
  for (let i = 0; i < iters; i += 1) {
    const m = 0.5 * (a + b);
    if (cdf(m) < p) a = m;
    else b = m;
  }
  return 0.5 * (a + b);
}

/* ============================ Normal =================================== */
export function normalPdf(x, mu = 0, sigma = 1) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI);
}
export function normalCdf(x, mu = 0, sigma = 1) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}
/** Cuantil normal (algoritmo de Acklam, error ≈ 1e-9). */
export function normalInv(p, mu = 0, sigma = 1) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q;
  let r;
  let z;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    q = p - 0.5;
    r = q * q;
    z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return mu + sigma * z;
}

/* ========================= t de Student ================================ */
export function studentTPdf(x, v) {
  const c = Math.exp(lgammaFn((v + 1) / 2) - lgammaFn(v / 2)) / Math.sqrt(v * Math.PI);
  return c * Math.pow(1 + (x * x) / v, -(v + 1) / 2);
}
export function studentTCdf(x, v) {
  const xx = v / (v + x * x);
  const ib = 0.5 * incBeta(xx, v / 2, 0.5);
  return x > 0 ? 1 - ib : ib;
}
export function studentTInv(p, v) {
  return inverseByBisection((t) => studentTCdf(t, v), p, -1e6, 1e6);
}

/* ========================== Ji-cuadrado ================================ */
export function chiSqPdf(x, k) {
  if (x <= 0) return 0;
  return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - lgammaFn(k / 2));
}
export function chiSqCdf(x, k) {
  if (x <= 0) return 0;
  return regGammaP(k / 2, x / 2);
}
export function chiSqInv(p, k) {
  return inverseByBisection((x) => chiSqCdf(x, k), p, 0, 1e7);
}

/* ================================ F ==================================== */
export function fPdf(x, d1, d2) {
  if (x <= 0) return 0;
  const num = Math.sqrt(Math.pow(d1 * x, d1) * Math.pow(d2, d2) / Math.pow(d1 * x + d2, d1 + d2));
  return num / (x * Math.exp(lgammaFn(d1 / 2) + lgammaFn(d2 / 2) - lgammaFn((d1 + d2) / 2)));
}
export function fCdf(x, d1, d2) {
  if (x <= 0) return 0;
  const xx = (d1 * x) / (d1 * x + d2);
  return incBeta(xx, d1 / 2, d2 / 2);
}
export function fInv(p, d1, d2) {
  return inverseByBisection((x) => fCdf(x, d1, d2), p, 0, 1e7);
}

/* ============================ Exponencial ============================== */
export function expPdf(x, rate = 1) {
  return x < 0 ? 0 : rate * Math.exp(-rate * x);
}
export function expCdf(x, rate = 1) {
  return x < 0 ? 0 : 1 - Math.exp(-rate * x);
}
export function expInv(p, rate = 1) {
  return -Math.log(1 - p) / rate;
}

/* ============================== Weibull ================================ */
export function weibullPdf(x, k, lambda) {
  if (x < 0) return 0;
  return (k / lambda) * Math.pow(x / lambda, k - 1) * Math.exp(-Math.pow(x / lambda, k));
}
export function weibullCdf(x, k, lambda) {
  if (x < 0) return 0;
  return 1 - Math.exp(-Math.pow(x / lambda, k));
}

/* =============================== Gamma ================================= */
export function gammaPdf(x, k, theta) {
  if (x <= 0) return 0;
  return Math.exp((k - 1) * Math.log(x) - x / theta - k * Math.log(theta) - lgammaFn(k));
}
export function gammaCdf(x, k, theta) {
  if (x <= 0) return 0;
  return regGammaP(k, x / theta);
}

/* ================================ Beta ================================= */
export function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp(
    (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (lgammaFn(a) + lgammaFn(b) - lgammaFn(a + b))
  );
}
export function betaCdf(x, a, b) {
  return incBeta(x, a, b);
}

/* ============================== Binomial =============================== */
export function binomPmf(k, n, p) {
  if (k < 0 || k > n) return 0;
  const lchoose = lgammaFn(n + 1) - lgammaFn(k + 1) - lgammaFn(n - k + 1);
  return Math.exp(lchoose + k * Math.log(p) + (n - k) * Math.log(1 - p));
}
export function binomCdf(k, n, p) {
  const K = Math.floor(k);
  let sum = 0;
  for (let i = 0; i <= K; i += 1) sum += binomPmf(i, n, p);
  return Math.min(1, sum);
}

/* =============================== Poisson =============================== */
export function poissonPmf(k, lambda) {
  if (k < 0) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - lgammaFn(k + 1));
}
export function poissonCdf(k, lambda) {
  const K = Math.floor(k);
  let sum = 0;
  for (let i = 0; i <= K; i += 1) sum += poissonPmf(i, lambda);
  return Math.min(1, sum);
}
