/**
 * association.js — Constructores de gráficos de asociación y correlación.
 *
 * Dispersión con recta de mínimos cuadrados, burbujas (tercera dimensión por
 * tamaño) y mapa de calor de correlaciones. Incluye ayudantes estadísticos
 * autocontenidos (media, Pearson, Spearman, regresión simple); en la Fase 4 el
 * motor estadístico formal podrá centralizarlos.
 */

import { numericVector, numericSummary } from "../../data/transformer.js";
import { isMissing, parseNumber } from "../../data/detector.js";
import { divergingScale } from "../themes/plotly-themes.js";
import { num, label } from "../format.js";

/* ----------------------------- Utilidades ------------------------------ */
/** Pares (x, y) completos (sin perdidos en ninguna de las dos). */
function pairedXY(rows, xName, yName) {
  const xs = [];
  const ys = [];
  for (const r of rows) {
    const x = typeof r[xName] === "number" ? r[xName] : parseNumber(r[xName], ".");
    const y = typeof r[yName] === "number" ? r[yName] : parseNumber(r[yName], ".");
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }
  return { xs, ys };
}

function mean(a) {
  return a.reduce((s, v) => s + v, 0) / (a.length || 1);
}

/** Coeficiente de correlación de Pearson. */
function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const den = Math.sqrt(sxx * syy);
  return den === 0 ? NaN : sxy / den;
}

/** Rangos con promedio en empates (para Spearman). */
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    const avg = (i + j) / 2 + 1; // rango promedio (base 1)
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

/** Correlación de Spearman (Pearson sobre rangos). */
function spearman(xs, ys) {
  return pearson(ranks(xs), ranks(ys));
}

/** Regresión lineal simple por mínimos cuadrados. */
function linregress(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r = pearson(xs, ys);
  return { slope, intercept, r2: r * r };
}

/** Describe la fuerza de una correlación (Cohen, orientativo). */
function strengthWord(r) {
  const a = Math.abs(r);
  if (a < 0.1) return "prácticamente nula";
  if (a < 0.3) return "débil";
  if (a < 0.5) return "moderada";
  if (a < 0.7) return "considerable";
  return "fuerte";
}

/* ------------------------------ Dispersión ----------------------------- */
const scatter = {
  roles: [
    { key: "x", label: "Eje X", accepts: ["numeric"], required: true, hint: "Variable predictora o independiente." },
    { key: "y", label: "Eje Y", accepts: ["numeric"], required: true, hint: "Variable de respuesta o dependiente." },
    { key: "z", label: "Eje Z (solo 3D)", accepts: ["numeric"], required: false, hint: "Tercera variable; habilita la vista 3D." },
  ],
  build(dataset, config) {
    const { xs, ys } = pairedXY(dataset.rows, config.x, config.y);
    const r = pearson(xs, ys);
    const rho = spearman(xs, ys);
    const reg = linregress(xs, ys);
    const minx = Math.min(...xs);
    const maxx = Math.max(...xs);
    const dir = r >= 0 ? "positiva" : "negativa";

    return {
      traces: [
        { type: "scatter", mode: "markers", x: xs, y: ys, name: "Observaciones",
          marker: { size: 8, opacity: 0.75 },
          hovertemplate: `${config.x}=%{x}<br>${config.y}=%{y}<extra></extra>` },
        { type: "scatter", mode: "lines", x: [minx, maxx],
          y: [reg.intercept + reg.slope * minx, reg.intercept + reg.slope * maxx],
          name: "Ajuste lineal", line: { width: 2, dash: "dot" }, hoverinfo: "skip" },
      ],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: true,
      },
      reading: {
        lead: `Entre “${config.x}” y “${config.y}” se observa una asociación ${dir} ${strengthWord(r)} (r = ${num(r)}). El ajuste lineal explica el ${num(reg.r2 * 100, 1)} % de la varianza (R²).`,
        stats: [
          { k: "n (pares)", v: num(xs.length, 0) },
          { k: "Pearson r", v: num(r) },
          { k: "Spearman ρ", v: num(rho) },
          { k: "R²", v: num(reg.r2) },
          { k: "Pendiente", v: num(reg.slope) },
        ],
        notes: [
          "Spearman (basado en rangos) resiste valores atípicos y relaciones monótonas no lineales; compáralo con Pearson.",
          "La recta es descriptiva: su validez inferencial requiere comprobar los supuestos de la regresión (Fase 4).",
        ],
        cautions: ["Correlación no implica causalidad: una tercera variable podría explicar la relación."],
      },
    };
  },
};

/* ------------------------------- Burbujas ------------------------------ */
const bubble = {
  roles: [
    { key: "x", label: "Eje X", accepts: ["numeric"], required: true, hint: "Primera variable continua." },
    { key: "y", label: "Eje Y", accepts: ["numeric"], required: true, hint: "Segunda variable continua." },
    { key: "size", label: "Tamaño", accepts: ["numeric"], required: true, hint: "Tercera variable, codificada como área de la burbuja." },
  ],
  build(dataset, config) {
    const rows = dataset.rows.filter(
      (r) => !isMissing(r[config.x]) && !isMissing(r[config.y]) && !isMissing(r[config.size])
    );
    const xs = rows.map((r) => Number(r[config.x]));
    const ys = rows.map((r) => Number(r[config.y]));
    const ss = rows.map((r) => Number(r[config.size]));
    const maxS = Math.max(...ss) || 1;
    const r = pearson(xs, ys);

    return {
      traces: [{
        type: "scatter", mode: "markers", x: xs, y: ys,
        marker: {
          size: ss, sizemode: "area", sizeref: (2 * maxS) / 38 ** 2, sizemin: 4,
          opacity: 0.6, line: { width: 1, color: "rgba(255,255,255,0.5)" },
        },
        customdata: ss,
        hovertemplate: `${config.x}=%{x}<br>${config.y}=%{y}<br>${config.size}=%{customdata}<extra></extra>`,
      }],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: false,
      },
      reading: {
        lead: `Cada burbuja combina tres variables: posición (“${config.x}”, “${config.y}”) y área (“${config.size}”). Entre las dos primeras la correlación es ${strengthWord(r)} (r = ${num(r)}).`,
        stats: [
          { k: "n", v: num(xs.length, 0) },
          { k: "Pearson r (X,Y)", v: num(r) },
          { k: `Máx · ${config.size}`, v: num(maxS) },
        ],
        notes: ["El área (no el diámetro) es proporcional al valor: así la percepción visual no exagera las diferencias."],
        cautions: ["Con muchas burbujas, el solapamiento dificulta la lectura; considera transparencia o un gráfico 3D (Fase 5)."],
      },
    };
  },
};

/* --------------------- Mapa de calor de correlaciones ------------------ */
const corrHeatmap = {
  roles: [], // usa todas las variables numéricas del conjunto
  usesAllNumeric: true,
  build(dataset) {
    const numericVars = dataset.variables
      .filter((v) => v.storageType === "numeric")
      .map((v) => v.name);
    const k = numericVars.length;
    const z = [];
    let best = { a: null, b: null, r: 0 };
    for (let i = 0; i < k; i += 1) {
      const row = [];
      for (let j = 0; j < k; j += 1) {
        const xi = numericVector(dataset.rows, numericVars[i]);
        const xj = numericVector(dataset.rows, numericVars[j]);
        const r = pearson(xi, xj);
        row.push(r);
        if (i < j && Math.abs(r) > Math.abs(best.r)) {
          best = { a: numericVars[i], b: numericVars[j], r };
        }
      }
      z.push(row);
    }

    const annotations = [];
    for (let i = 0; i < k; i += 1) {
      for (let j = 0; j < k; j += 1) {
        annotations.push({
          x: numericVars[j], y: numericVars[i], text: num(z[i][j]),
          showarrow: false, font: { size: 11, color: Math.abs(z[i][j]) > 0.6 ? "#fff" : undefined },
        });
      }
    }

    return {
      traces: [{
        type: "heatmap", z, x: numericVars, y: numericVars,
        zmin: -1, zmax: 1, colorscale: divergingScale(),
        xgap: 2, ygap: 2,
        colorbar: { title: { text: "r" }, thickness: 12, len: 0.8 },
        hovertemplate: "%{y} · %{x}<br>r = %{z:.2f}<extra></extra>",
      }],
      layout: {
        xaxis: { title: { text: "" }, side: "bottom" },
        yaxis: { title: { text: "" }, autorange: "reversed" },
        annotations,
        margin: { l: 90, r: 24, t: 16, b: 90 },
      },
      reading: {
        lead: best.a
          ? `La correlación más intensa es entre “${best.a}” y “${best.b}” (r = ${num(best.r)}, ${strengthWord(best.r)} y ${best.r >= 0 ? "positiva" : "negativa"}).`
          : "Se necesitan al menos dos variables numéricas para estimar correlaciones.",
        stats: [
          { k: "Variables", v: num(k, 0) },
          { k: "Pares", v: num((k * (k - 1)) / 2, 0) },
        ],
        notes: [
          "Las celdas usan la correlación de Pearson; la diagonal es 1 por definición.",
          "El color codifica signo e intensidad: acento para positivas, rojo para negativas.",
        ],
        cautions: ["Las correlaciones altas pueden deberse a variables de confusión; no implican causalidad."],
      },
    };
  },
};

/* ------------------------------ Exportación ---------------------------- */
/* ---------------------- Variantes 3D (modo 3D) ------------------------- */
/** Figura mínima con un aviso, cuando faltan dimensiones para el 3D. */
function note3d(msg) {
  return {
    traces: [{ type: "scatter", x: [0], y: [0], mode: "markers", marker: { opacity: 0 }, hoverinfo: "skip" }],
    layout: { xaxis: { visible: false }, yaxis: { visible: false }, annotations: [{ xref: "paper", yref: "paper", x: 0.5, y: 0.5, showarrow: false, text: msg }] },
    reading: { lead: msg, stats: [], notes: [], cautions: [] },
  };
}

scatter.build3d = (dataset, config) => {
  const nums = dataset.variables.filter((v) => v.storageType === "numeric").map((v) => v.name);
  const zVar = config.z || nums.find((n) => n !== config.x && n !== config.y);
  if (!zVar) return note3d("La vista 3D necesita una tercera variable numérica.");
  const rows = dataset.rows.filter((r) => !isMissing(r[config.x]) && !isMissing(r[config.y]) && !isMissing(r[zVar]));
  const xs = rows.map((r) => Number(r[config.x]));
  const ys = rows.map((r) => Number(r[config.y]));
  const zs = rows.map((r) => Number(r[zVar]));
  return {
    traces: [{ type: "scatter3d", mode: "markers", x: xs, y: ys, z: zs, name: "Observaciones",
      marker: { size: 4, opacity: 0.8 },
      hovertemplate: `${config.x}=%{x}<br>${config.y}=%{y}<br>${zVar}=%{z}<extra></extra>` }],
    layout: { scene: { xaxis: { title: { text: config.x } }, yaxis: { title: { text: config.y } }, zaxis: { title: { text: zVar } } }, showlegend: false },
    reading: {
      lead: `Dispersión tridimensional de “${config.x}”, “${config.y}” y “${zVar}” sobre ${rows.length} casos. Gira la escena para descubrir relaciones que un plano oculta.`,
      stats: [{ k: "n", v: num(rows.length, 0) }, { k: "Ejes", v: `${config.x}, ${config.y}, ${zVar}` }],
      notes: ["La tercera dimensión revela estructuras (planos, curvas, cúmulos) invisibles en 2D.", "La rotación es esencial: una sola vista puede engañar por la perspectiva."],
      cautions: ["Sin interacción, el 3D puede ser más confuso que dos gráficos 2D bien elegidos."],
    },
  };
};

bubble.build3d = (dataset, config) => {
  const rows = dataset.rows.filter((r) => !isMissing(r[config.x]) && !isMissing(r[config.y]) && !isMissing(r[config.size]));
  const xs = rows.map((r) => Number(r[config.x]));
  const ys = rows.map((r) => Number(r[config.y]));
  const zs = rows.map((r) => Number(r[config.size]));
  return {
    traces: [{ type: "scatter3d", mode: "markers", x: xs, y: ys, z: zs, name: "Casos",
      marker: { size: 4, opacity: 0.8, color: zs, colorscale: [[0, "#8d9ce4"], [1, "#1f2f8f"]], showscale: false },
      hovertemplate: `${config.x}=%{x}<br>${config.y}=%{y}<br>${config.size}=%{z}<extra></extra>` }],
    layout: { scene: { xaxis: { title: { text: config.x } }, yaxis: { title: { text: config.y } }, zaxis: { title: { text: config.size } } }, showlegend: false },
    reading: {
      lead: `Las tres variables de la burbuja (“${config.x}”, “${config.y}”, “${config.size}”) pasan a ser los tres ejes de una dispersión 3D, sin recurrir al tamaño para codificar la tercera.`,
      stats: [{ k: "n", v: num(rows.length, 0) }, { k: "Ejes", v: `${config.x}, ${config.y}, ${config.size}` }],
      notes: ["Llevar la tercera variable a un eje real evita la distorsión perceptiva del área de las burbujas."],
      cautions: ["El 3D exige rotar para leerse bien; en estático, una matriz de dispersión puede ser más clara."],
    },
  };
};

export const associationBuilders = {
  scatter,
  bubble,
  "corr-heatmap": corrHeatmap,
};

// Exponer ayudantes por si otras fases los reutilizan.
export { pearson, spearman, linregress };
