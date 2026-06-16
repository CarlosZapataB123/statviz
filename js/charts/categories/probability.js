/**
 * probability.js — Constructores de la categoría Probabilidad.
 *
 * A diferencia de los gráficos descriptivos, estos no dependen de datos sino de
 * PARÁMETROS (media, desviación, grados de libertad, n, p, λ…). Por eso
 * declaran `paramRoles` (controles numéricos) y `dataless: true`. Cada gráfico
 * dibuja la densidad o masa teórica, sombrea el área acumulada hasta un punto k
 * (la CDF hecha visible) e informa media, varianza y P(X ≤ k).
 *
 * Toda la matemática proviene del motor propio js/stats/distributions.js.
 */

import * as D from "../../stats/distributions.js";
import { num } from "../format.js";

/* ----------------------------- Utilidades ------------------------------ */

/** n puntos equiespaciados en [a, b]. */
function linspace(a, b, n = 200) {
  if (n < 2) return [a];
  const step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => a + i * step);
}

/**
 * Ensambla un gráfico continuo: curva de densidad, área sombreada hasta k y
 * línea de referencia en k.
 */
function assembleContinuous({ x, y, k, fk, Fk, xlabel, reading }) {
  const shadeX = [];
  const shadeY = [];
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] <= k) {
      shadeX.push(x[i]);
      shadeY.push(y[i]);
    }
  }
  if (shadeX.length) {
    shadeX.push(k, k);
    shadeY.push(fk, 0);
  }

  return {
    traces: [
      { type: "scatter", mode: "lines", x, y, name: "Densidad", line: { width: 2 },
        hovertemplate: "x = %{x:.3f}<br>f(x) = %{y:.4f}<extra></extra>" },
      { type: "scatter", mode: "lines", x: shadeX, y: shadeY, name: `P(X ≤ ${num(k)})`,
        fill: "tozeroy", fillcolor: "rgba(110,120,140,0.18)",
        line: { width: 0 }, hoverinfo: "skip" },
    ],
    layout: {
      xaxis: { title: { text: xlabel } },
      yaxis: { title: { text: "Densidad" }, rangemode: "tozero" },
      shapes: [{ type: "line", x0: k, x1: k, y0: 0, y1: fk,
        line: { color: "rgba(110,120,140,0.8)", width: 1, dash: "dot" } }],
      showlegend: true,
    },
    reading: { ...reading, stats: [{ k: "P(X ≤ k)", v: num(Fk, 4) }, { k: "P(X > k)", v: num(1 - Fk, 4) }, ...reading.stats] },
  };
}

/** Ensambla un gráfico discreto: masa en barras y referencia en k. */
function assembleDiscrete({ ks, ps, k, pk, Fk, xlabel, reading }) {
  return {
    traces: [
      { type: "bar", x: ks, y: ps, name: "Masa de probabilidad",
        hovertemplate: "k = %{x}<br>P = %{y:.4f}<extra></extra>" },
    ],
    layout: {
      xaxis: { title: { text: xlabel }, dtick: ks.length > 30 ? undefined : 1 },
      yaxis: { title: { text: "Probabilidad" }, rangemode: "tozero" },
      shapes: [{ type: "line", x0: k, x1: k, y0: 0, y1: Math.max(...ps),
        line: { color: "rgba(110,120,140,0.8)", width: 1, dash: "dot" } }],
      showlegend: false,
    },
    reading: { ...reading, stats: [
      { k: `P(X = ${k})`, v: num(pk, 4) },
      { k: "P(X ≤ k)", v: num(Fk, 4) },
      ...reading.stats,
    ] },
  };
}

/* =============================== Normal ================================ */
const normalDist = {
  dataless: true,
  paramRoles: [
    { key: "mu", label: "Media (μ)", type: "number", min: -50, max: 50, step: 0.5, default: 0,
      hint: "Centro de la distribución." },
    { key: "sigma", label: "Desviación (σ)", type: "number", min: 0.1, max: 20, step: 0.1, default: 1,
      hint: "Dispersión: a mayor σ, curva más ancha." },
    { key: "k", label: "Punto k", type: "number", min: -50, max: 50, step: 0.5, default: 1,
      hint: "Se sombrea P(X ≤ k)." },
  ],
  build(_dataset, c) {
    const { mu, sigma, k } = c;
    const x = linspace(mu - 4 * sigma, mu + 4 * sigma, 240);
    const y = x.map((v) => D.normalPdf(v, mu, sigma));
    return assembleContinuous({
      x, y, k, fk: D.normalPdf(k, mu, sigma), Fk: D.normalCdf(k, mu, sigma),
      xlabel: "x",
      reading: {
        lead: `Distribución normal con media ${num(mu)} y desviación ${num(sigma)}. El área sombreada es P(X ≤ ${num(k)}) = ${num(D.normalCdf(k, mu, sigma), 4)}.`,
        stats: [{ k: "Media", v: num(mu) }, { k: "Varianza", v: num(sigma * sigma) }],
        notes: ["Regla 68–95–99.7: aproximadamente esas proporciones caen a 1, 2 y 3 desviaciones de la media.", "Es simétrica y mesocúrtica; sirve de referencia para muchas pruebas paramétricas."],
        cautions: ["Asumir normalidad sin comprobarla puede invalidar inferencias (Fase de inferencia)."],
      },
    });
  },
};

/* ============================== Binomial =============================== */
const binomialDist = {
  dataless: true,
  paramRoles: [
    { key: "n", label: "Ensayos (n)", type: "number", min: 1, max: 100, step: 1, default: 20,
      hint: "Número de ensayos independientes." },
    { key: "p", label: "Probabilidad (p)", type: "number", min: 0, max: 1, step: 0.01, default: 0.5,
      hint: "Probabilidad de éxito en cada ensayo." },
    { key: "k", label: "Punto k", type: "number", min: 0, max: 100, step: 1, default: 10,
      hint: "Se resalta P(X = k) y P(X ≤ k)." },
  ],
  build(_dataset, c) {
    const n = Math.round(c.n);
    const p = c.p;
    const k = Math.round(c.k);
    const ks = Array.from({ length: n + 1 }, (_, i) => i);
    const ps = ks.map((i) => D.binomPmf(i, n, p));
    return assembleDiscrete({
      ks, ps, k, pk: D.binomPmf(k, n, p), Fk: D.binomCdf(k, n, p),
      xlabel: "Número de éxitos (k)",
      reading: {
        lead: `Binomial con n = ${n} y p = ${num(p)}. El valor más probable ronda np = ${num(n * p)} éxitos.`,
        stats: [{ k: "Media (np)", v: num(n * p) }, { k: "Varianza", v: num(n * p * (1 - p)) }],
        notes: ["Modela el número de éxitos en n ensayos independientes con probabilidad constante.", "Si n es grande y p moderada, se aproxima a una normal; si p es muy pequeña, a una Poisson."],
        cautions: ["Requiere independencia entre ensayos y p constante."],
      },
    });
  },
};

/* =============================== Poisson =============================== */
const poissonDist = {
  dataless: true,
  paramRoles: [
    { key: "lambda", label: "Tasa (λ)", type: "number", min: 0.1, max: 50, step: 0.1, default: 4,
      hint: "Número medio de eventos por intervalo." },
    { key: "k", label: "Punto k", type: "number", min: 0, max: 100, step: 1, default: 4,
      hint: "Se resalta P(X = k) y P(X ≤ k)." },
  ],
  build(_dataset, c) {
    const lambda = c.lambda;
    const k = Math.round(c.k);
    const kMax = Math.max(10, Math.ceil(lambda + 4 * Math.sqrt(lambda) + 5));
    const ks = Array.from({ length: kMax + 1 }, (_, i) => i);
    const ps = ks.map((i) => D.poissonPmf(i, lambda));
    return assembleDiscrete({
      ks, ps, k, pk: D.poissonPmf(k, lambda), Fk: D.poissonCdf(k, lambda),
      xlabel: "Número de eventos (k)",
      reading: {
        lead: `Poisson con tasa λ = ${num(lambda)}. La media y la varianza coinciden (= λ), rasgo distintivo del modelo.`,
        stats: [{ k: "Media (λ)", v: num(lambda) }, { k: "Varianza (λ)", v: num(lambda) }],
        notes: ["Cuenta eventos raros e independientes en un intervalo fijo de tiempo o espacio.", "La igualdad media = varianza permite detectar sobredispersión cuando no se cumple en datos reales."],
        cautions: ["Si la varianza observada supera a la media (sobredispersión), considera un modelo binomial negativo."],
      },
    });
  },
};

/* ============================ Exponencial ============================== */
const exponentialDist = {
  dataless: true,
  paramRoles: [
    { key: "rate", label: "Tasa (λ)", type: "number", min: 0.05, max: 10, step: 0.05, default: 1,
      hint: "Tasa de ocurrencia; la media es 1/λ." },
    { key: "k", label: "Punto k", type: "number", min: 0, max: 100, step: 0.1, default: 1,
      hint: "Se sombrea P(X ≤ k)." },
  ],
  build(_dataset, c) {
    const { rate, k } = c;
    const hi = D.expInv(0.995, rate);
    const x = linspace(0, hi, 240);
    const y = x.map((v) => D.expPdf(v, rate));
    return assembleContinuous({
      x, y, k, fk: D.expPdf(k, rate), Fk: D.expCdf(k, rate),
      xlabel: "Tiempo hasta el evento",
      reading: {
        lead: `Exponencial con tasa λ = ${num(rate)} (media 1/λ = ${num(1 / rate)}). Modela el tiempo de espera hasta el siguiente evento.`,
        stats: [{ k: "Media", v: num(1 / rate) }, { k: "Varianza", v: num(1 / (rate * rate)) }],
        notes: ["Carece de memoria: la probabilidad de esperar más no depende de lo ya esperado.", "Es el tiempo entre eventos de un proceso de Poisson."],
        cautions: ["La falta de memoria es una suposición fuerte; muchos procesos reales no la cumplen."],
      },
    });
  },
};

/* ============================== Weibull ================================ */
const weibullDist = {
  dataless: true,
  paramRoles: [
    { key: "shape", label: "Forma (k)", type: "number", min: 0.2, max: 10, step: 0.1, default: 1.5,
      hint: "k<1 riesgo decreciente; k=1 constante; k>1 creciente." },
    { key: "scale", label: "Escala (λ)", type: "number", min: 0.1, max: 20, step: 0.1, default: 1,
      hint: "Estira la distribución a lo largo del eje." },
    { key: "k", label: "Punto x", type: "number", min: 0, max: 100, step: 0.1, default: 1,
      hint: "Se sombrea P(X ≤ x)." },
  ],
  build(_dataset, c) {
    const shape = c.shape;
    const scale = c.scale;
    const k = c.k;
    const hi = scale * Math.pow(-Math.log(0.005), 1 / shape);
    const x = linspace(0, hi, 240);
    const y = x.map((v) => D.weibullPdf(v, shape, scale));
    const mean = scale * D.gammaFn(1 + 1 / shape);
    const variance = scale * scale * (D.gammaFn(1 + 2 / shape) - D.gammaFn(1 + 1 / shape) ** 2);
    return assembleContinuous({
      x, y, k, fk: D.weibullPdf(k, shape, scale), Fk: D.weibullCdf(k, shape, scale),
      xlabel: "x",
      reading: {
        lead: `Weibull con forma k = ${num(shape)} y escala λ = ${num(scale)}. La forma gobierna si el riesgo crece, decrece o es constante con el tiempo.`,
        stats: [{ k: "Media", v: num(mean) }, { k: "Varianza", v: num(variance) }],
        notes: ["Muy usada en fiabilidad y análisis de supervivencia.", "Con k = 1 se reduce a la exponencial; con k ≈ 3.6 se aproxima a la normal."],
        cautions: ["Estimar k y λ a partir de pocos datos es inestable; usa intervalos de confianza."],
      },
    });
  },
};

/* =============================== Gamma ================================= */
const gammaDist = {
  dataless: true,
  paramRoles: [
    { key: "shape", label: "Forma (k)", type: "number", min: 0.2, max: 20, step: 0.1, default: 2,
      hint: "Número de eventos esperados (en su interpretación de espera)." },
    { key: "scale", label: "Escala (θ)", type: "number", min: 0.1, max: 20, step: 0.1, default: 1,
      hint: "Escala temporal de cada evento." },
    { key: "k", label: "Punto x", type: "number", min: 0, max: 200, step: 0.1, default: 2,
      hint: "Se sombrea P(X ≤ x)." },
  ],
  build(_dataset, c) {
    const shape = c.shape;
    const scale = c.scale;
    const k = c.k;
    const mean = shape * scale;
    const sd = Math.sqrt(shape) * scale;
    const hi = Math.max(mean + 4 * sd, scale);
    const x = linspace(1e-3, hi, 240);
    const y = x.map((v) => D.gammaPdf(v, shape, scale));
    return assembleContinuous({
      x, y, k, fk: D.gammaPdf(k, shape, scale), Fk: D.gammaCdf(k, shape, scale),
      xlabel: "x",
      reading: {
        lead: `Gamma con forma k = ${num(shape)} y escala θ = ${num(scale)} (media kθ = ${num(mean)}). Generaliza la exponencial al tiempo de espera de k eventos.`,
        stats: [{ k: "Media (kθ)", v: num(mean) }, { k: "Varianza (kθ²)", v: num(shape * scale * scale) }],
        notes: ["Con k = 1 es exponencial; con k entero es una Erlang.", "Es la conjugada del parámetro de tasa en inferencia bayesiana."],
        cautions: ["Sensible a la asimetría; la media puede no representar bien el centro."],
      },
    });
  },
};

/* ================================ Beta ================================= */
const betaDist = {
  dataless: true,
  paramRoles: [
    { key: "alpha", label: "Alfa (α)", type: "number", min: 0.2, max: 20, step: 0.1, default: 2,
      hint: "Pseudo-éxitos; desplaza la masa hacia 1." },
    { key: "beta", label: "Beta (β)", type: "number", min: 0.2, max: 20, step: 0.1, default: 2,
      hint: "Pseudo-fracasos; desplaza la masa hacia 0." },
    { key: "k", label: "Punto x", type: "number", min: 0, max: 1, step: 0.01, default: 0.5,
      hint: "Se sombrea P(X ≤ x)." },
  ],
  build(_dataset, c) {
    const a = c.alpha;
    const b = c.beta;
    const k = c.k;
    const x = linspace(1e-3, 1 - 1e-3, 240);
    const y = x.map((v) => D.betaPdf(v, a, b));
    const mean = a / (a + b);
    const variance = (a * b) / ((a + b) ** 2 * (a + b + 1));
    return assembleContinuous({
      x, y, k, fk: D.betaPdf(k, a, b), Fk: D.betaCdf(k, a, b),
      xlabel: "Proporción (0–1)",
      reading: {
        lead: `Beta con α = ${num(a)} y β = ${num(b)}. Definida en [0, 1], es el modelo natural de proporciones y probabilidades.`,
        stats: [{ k: "Media", v: num(mean, 4) }, { k: "Varianza", v: num(variance, 4) }],
        notes: ["α = β da simetría; α > β sesga hacia 1 y β > α hacia 0.", "Es la conjugada de la binomial: actualiza creencias sobre una probabilidad."],
        cautions: ["Con α, β < 1 la densidad se dispara en los extremos; interprétala con cuidado."],
      },
    });
  },
};

/* ====================== Distribuciones comparadas ====================== */
const distCompare = {
  dataless: true,
  paramRoles: [
    { key: "v1", label: "t — gl bajos", type: "number", min: 1, max: 50, step: 1, default: 3,
      hint: "Grados de libertad de la primera t (colas pesadas)." },
    { key: "v2", label: "t — gl altos", type: "number", min: 1, max: 100, step: 1, default: 10,
      hint: "Grados de libertad de la segunda t." },
  ],
  build(_dataset, c) {
    const v1 = Math.round(c.v1);
    const v2 = Math.round(c.v2);
    const x = linspace(-5, 5, 240);
    return {
      traces: [
        { type: "scatter", mode: "lines", x, y: x.map((v) => D.normalPdf(v, 0, 1)),
          name: "Normal(0,1)", line: { width: 2 } },
        { type: "scatter", mode: "lines", x, y: x.map((v) => D.studentTPdf(v, v1)),
          name: `t (gl=${v1})`, line: { width: 2, dash: "dash" } },
        { type: "scatter", mode: "lines", x, y: x.map((v) => D.studentTPdf(v, v2)),
          name: `t (gl=${v2})`, line: { width: 2, dash: "dot" } },
      ],
      layout: {
        xaxis: { title: { text: "x" } },
        yaxis: { title: { text: "Densidad" }, rangemode: "tozero" },
        showlegend: true,
      },
      reading: {
        lead: `La t de Student tiene colas más pesadas que la normal: con pocos grados de libertad (gl = ${v1}) son notables; al aumentar (gl = ${v2}) la t se aproxima a la normal.`,
        stats: [{ k: "Normal — varianza", v: "1" }, { k: `t(${v1}) — varianza`, v: v1 > 2 ? num(v1 / (v1 - 2)) : "∞" }, { k: `t(${v2}) — varianza`, v: v2 > 2 ? num(v2 / (v2 - 2)) : "∞" }],
        notes: ["Las colas pesadas de la t explican por qué sus valores críticos son mayores con muestras pequeñas.", "Cuando gl → ∞, la t converge a la normal estándar."],
        cautions: ["Usar la normal en lugar de la t con muestras pequeñas subestima la incertidumbre."],
      },
    };
  },
};

/* ------------------------------ Exportación ---------------------------- */
export const probabilityBuilders = {
  "normal-dist": normalDist,
  "binomial-dist": binomialDist,
  "poisson-dist": poissonDist,
  "exponential-dist": exponentialDist,
  "weibull-dist": weibullDist,
  "gamma-dist": gammaDist,
  "beta-dist": betaDist,
  "dist-compare": distCompare,
};
