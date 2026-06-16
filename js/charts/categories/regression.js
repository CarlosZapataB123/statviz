/**
 * regression.js — Constructores de la categoría Regresión.
 *
 * Ajustan modelos con el motor js/stats/regression.js y los visualizan junto a
 * su diagnóstico:
 *  - linear-reg: dispersión con recta ajustada y banda de confianza de la media.
 *  - multiple-reg: observado frente a predicho, con tabla de coeficientes.
 *  - fitted-curves: comparación de un ajuste lineal y uno polinómico.
 *  - residuals: residuos frente a valores ajustados (linealidad/homogeneidad).
 *  - influence: apalancamiento frente a residuo estandarizado, tamaño = Cook.
 *  - leverage: apalancamiento por observación con umbral.
 *  - reg-diagnostics: gráfico cuantil–cuantil normal de los residuos.
 */

import { num, label } from "../format.js";
import { linearModel, polyDesign, predictSimple, linrange } from "../../stats/regression.js";
import { normalInv, studentTInv } from "../../stats/distributions.js";

/* ----------------------------- Utilidades ------------------------------ */
function pairs(rows, xName, yName) {
  const xs = [];
  const ys = [];
  for (const r of rows) {
    const x = r[xName];
    const y = r[yName];
    if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }
  return { xs, ys };
}

const XY_ROLES = [
  { key: "x", label: "Predictor (X)", accepts: ["numeric"], required: true, hint: "Variable independiente." },
  { key: "y", label: "Respuesta (Y)", accepts: ["numeric"], required: true, hint: "Variable dependiente." },
];

/* =========================== Regresión lineal ========================== */
const linearRegChart = {
  roles: XY_ROLES,
  build(dataset, config) {
    const { xs, ys } = pairs(dataset.rows, config.x, config.y);
    const m = linearModel(xs.map((x) => [x]), ys, [config.x]);
    const gx = linrange(Math.min(...xs), Math.max(...xs), 80);
    const { yhat, seMean } = predictSimple(m, gx);
    const tcrit = studentTInv(0.975, m.dfRes);
    const b0 = m.coefficients[0];
    const b1 = m.coefficients[1];

    return {
      traces: [
        { type: "scatter", mode: "lines", x: gx, y: gx.map((_, i) => yhat[i] - tcrit * seMean[i]),
          line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
        { type: "scatter", mode: "lines", x: gx, y: gx.map((_, i) => yhat[i] + tcrit * seMean[i]),
          line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(110,120,140,0.16)",
          name: "IC 95 % de la media", hoverinfo: "skip" },
        { type: "scatter", mode: "lines", x: gx, y: yhat, name: "Recta ajustada", line: { width: 2 } },
        { type: "scatter", mode: "markers", x: xs, y: ys, name: "Observaciones",
          marker: { size: 7, opacity: 0.75 },
          hovertemplate: `${config.x}=%{x}<br>${config.y}=%{y}<extra></extra>` },
      ],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: true,
      },
      reading: {
        lead: `Recta ajustada: ${config.y} = ${num(b0)} ${b1 >= 0 ? "+" : "−"} ${num(Math.abs(b1))}·${config.x}. El modelo explica el ${num(m.r2 * 100, 1)} % de la varianza (R²); la pendiente es ${m.pVal[1] < 0.05 ? "significativa" : "no significativa"} (p = ${num(m.pVal[1], 3)}).`,
        stats: [
          { k: "Pendiente", v: `${num(b1)} (p=${num(m.pVal[1], 3)})` },
          { k: "Intercepto", v: num(b0) },
          { k: "R²", v: num(m.r2, 3) },
          { k: "Error típico", v: num(m.sigma) },
          { k: "n", v: num(m.n, 0) },
        ],
        notes: [
          "La banda sombreada es el IC al 95 % de la media estimada, no el de las predicciones individuales (más ancho).",
          "Cada unidad de aumento en el predictor cambia la respuesta en la pendiente, en promedio.",
        ],
        cautions: ["La validez de la inferencia exige linealidad, independencia, homocedasticidad y normalidad de los residuos: compruébalas con los gráficos de diagnóstico."],
      },
    };
  },
};

/* ========================== Regresión múltiple ========================= */
const multipleRegChart = {
  roles: [{ key: "y", label: "Respuesta (Y)", accepts: ["numeric"], required: true,
    hint: "Se modela con TODAS las demás variables numéricas como predictores." }],
  build(dataset, config) {
    const predictors = dataset.variables
      .filter((v) => v.storageType === "numeric" && v.name !== config.y)
      .map((v) => v.name);
    if (predictors.length === 0) {
      return { traces: [], reading: { lead: "Se necesitan al menos dos variables numéricas.", stats: [], notes: [], cautions: [] } };
    }
    const rows = dataset.rows.filter(
      (r) => typeof r[config.y] === "number" && predictors.every((p) => typeof r[p] === "number")
    );
    const X = rows.map((r) => predictors.map((p) => r[p]));
    const y = rows.map((r) => r[config.y]);
    const m = linearModel(X, y, predictors);

    const lo = Math.min(...m.fitted, ...y);
    const hi = Math.max(...m.fitted, ...y);

    const coefStats = m.coefNames.slice(1).map((nm, i) => ({
      k: nm, v: `${num(m.coefficients[i + 1])} (p=${num(m.pVal[i + 1], 3)})`,
    }));

    return {
      traces: [
        { type: "scatter", mode: "markers", x: m.fitted, y, name: "Casos",
          marker: { size: 7, opacity: 0.75 },
          hovertemplate: "predicho %{x:.2f}<br>observado %{y:.2f}<extra></extra>" },
        { type: "scatter", mode: "lines", x: [lo, hi], y: [lo, hi], name: "Identidad",
          line: { width: 1.5, dash: "dot" }, hoverinfo: "skip" },
      ],
      layout: {
        xaxis: { title: { text: `${config.y} predicho` } },
        yaxis: { title: { text: `${config.y} observado` } },
        showlegend: true,
      },
      reading: {
        lead: `Modelo de “${config.y}” sobre ${predictors.length} predictores (${predictors.join(", ")}). Explica el ${num(m.r2 * 100, 1)} % de la varianza (R² ajustado ${num(m.adjR2, 3)}); el modelo global es ${m.fP < 0.05 ? "significativo" : "no significativo"} (F, p = ${num(m.fP, 3)}).`,
        stats: [
          { k: "R²", v: num(m.r2, 3) },
          { k: "R² ajustado", v: num(m.adjR2, 3) },
          { k: "p (F global)", v: num(m.fP, 3) },
          ...coefStats,
        ],
        notes: [
          "Cuanto más se acerquen los puntos a la diagonal, mejor predice el modelo.",
          "Cada coeficiente expresa el efecto de su predictor manteniendo constantes los demás.",
          "El R² ajustado penaliza añadir predictores que no aportan.",
        ],
        cautions: ["Predictores muy correlacionados entre sí (multicolinealidad) inflan los errores estándar y vuelven inestables los coeficientes."],
      },
    };
  },
};

/* =========================== Curvas ajustadas ========================== */
const fittedCurvesChart = {
  roles: XY_ROLES,
  paramRoles: [
    { key: "grado", label: "Grado del polinomio", type: "number", min: 2, max: 6, step: 1, default: 3,
      hint: "Grado del ajuste polinómico que se compara con la recta." },
  ],
  build(dataset, config) {
    const { xs, ys } = pairs(dataset.rows, config.x, config.y);
    const degree = Math.round(config.grado ?? 3);
    const lin = linearModel(xs.map((x) => [x]), ys, [config.x]);
    const poly = linearModel(polyDesign(xs, degree), ys);

    const gx = linrange(Math.min(...xs), Math.max(...xs), 120);
    const linY = gx.map((x) => lin.coefficients[0] + lin.coefficients[1] * x);
    const polyY = gx.map((x) => poly.coefficients.reduce((s, b, j) => s + b * (j === 0 ? 1 : x ** j), 0));

    return {
      traces: [
        { type: "scatter", mode: "markers", x: xs, y: ys, name: "Observaciones",
          marker: { size: 7, opacity: 0.7 } },
        { type: "scatter", mode: "lines", x: gx, y: linY, name: "Lineal", line: { width: 2 } },
        { type: "scatter", mode: "lines", x: gx, y: polyY, name: `Polinómico (grado ${degree})`,
          line: { width: 2, dash: "dash" } },
      ],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: true,
      },
      reading: {
        lead: `Comparación de un ajuste lineal (R² = ${num(lin.r2, 3)}) y uno polinómico de grado ${degree} (R² = ${num(poly.r2, 3)}). Un R² mayor en el polinomio no implica un mejor modelo.`,
        stats: [
          { k: "R² lineal", v: num(lin.r2, 3) },
          { k: `R² grado ${degree}`, v: num(poly.r2, 3) },
        ],
        notes: ["Si la curva polinómica apenas mejora a la recta, prefiere la recta por parsimonia.", "Aumentar el grado siempre sube el R², pero a costa de ajustar el ruido."],
        cautions: ["Los polinomios de grado alto oscilan en los extremos (fenómeno de Runge) y extrapolan muy mal."],
      },
    };
  },
};

/* =============================== Residuos ============================== */
const residualsChart = {
  roles: XY_ROLES,
  build(dataset, config) {
    const { xs, ys } = pairs(dataset.rows, config.x, config.y);
    const m = linearModel(xs.map((x) => [x]), ys, [config.x]);
    return {
      traces: [{ type: "scatter", mode: "markers", x: m.fitted, y: m.residuals,
        marker: { size: 7, opacity: 0.75 },
        hovertemplate: "ajustado %{x:.2f}<br>residuo %{y:.2f}<extra></extra>" }],
      layout: {
        xaxis: { title: { text: "Valores ajustados" } },
        yaxis: { title: { text: "Residuos" } },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0,
          line: { color: "rgba(110,120,140,0.8)", width: 1, dash: "dash" } }],
        showlegend: false,
      },
      reading: {
        lead: `Residuos frente a valores ajustados. Lo deseable es una nube sin patrón en torno a cero; cualquier estructura señala un problema del modelo.`,
        stats: [{ k: "Error típico", v: num(m.sigma) }, { k: "n", v: num(m.n, 0) }],
        notes: [
          "Una curvatura indica relación no lineal (prueba un término polinómico).",
          "Un abanico que se abre o cierra indica heterocedasticidad (varianza no constante).",
        ],
        cautions: ["Patrones claros invalidan los errores estándar y los valores p del modelo lineal."],
      },
    };
  },
};

/* =============================== Influencia ============================ */
const influenceChart = {
  roles: XY_ROLES,
  build(dataset, config) {
    const { xs, ys } = pairs(dataset.rows, config.x, config.y);
    const m = linearModel(xs.map((x) => [x]), ys, [config.x]);
    const hThresh = (2 * m.p) / m.n;
    const maxCook = Math.max(...m.cooks, 1e-6);
    const flagged = m.leverage.filter((h, i) => h > hThresh || Math.abs(m.stdResiduals[i]) > 2).length;

    return {
      traces: [{
        type: "scatter", mode: "markers", x: m.leverage, y: m.stdResiduals,
        marker: { size: m.cooks, sizemode: "area", sizeref: (2 * maxCook) / 36 ** 2, sizemin: 4,
          opacity: 0.6, line: { width: 1, color: "rgba(255,255,255,0.5)" } },
        customdata: m.cooks,
        hovertemplate: "apalancamiento %{x:.3f}<br>residuo est. %{y:.2f}<br>Cook %{customdata:.3f}<extra></extra>",
      }],
      layout: {
        xaxis: { title: { text: "Apalancamiento (hat)" }, rangemode: "tozero" },
        yaxis: { title: { text: "Residuo estandarizado" } },
        shapes: [
          { type: "line", yref: "paper", x0: hThresh, x1: hThresh, y0: 0, y1: 1,
            line: { color: "rgba(110,120,140,0.6)", width: 1, dash: "dot" } },
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: 2, y1: 2, line: { color: "rgba(110,120,140,0.5)", width: 1, dash: "dot" } },
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: -2, y1: -2, line: { color: "rgba(110,120,140,0.5)", width: 1, dash: "dot" } },
        ],
        showlegend: false,
      },
      reading: {
        lead: `Gráfico de influencia: cada punto combina apalancamiento (eje X), residuo estandarizado (eje Y) y distancia de Cook (área). ${flagged} observación(es) superan algún umbral de atención.`,
        stats: [
          { k: "Umbral apalancamiento", v: num(hThresh, 3) },
          { k: "Cook máx.", v: num(Math.max(...m.cooks), 3) },
          { k: "n", v: num(m.n, 0) },
        ],
        notes: [
          "Alto apalancamiento = valor X extremo; residuo grande = mal ajustado. Lo verdaderamente influyente combina ambos (Cook elevada).",
          "Una regla habitual marca apalancamientos por encima de 2p/n y residuos estandarizados fuera de ±2.",
        ],
        cautions: ["No elimines casos influyentes de forma automática: investiga si son errores o información legítima."],
      },
    };
  },
};

/* =============================== Leverage ============================== */
const leverageChart = {
  roles: XY_ROLES,
  build(dataset, config) {
    const { xs, ys } = pairs(dataset.rows, config.x, config.y);
    const m = linearModel(xs.map((x) => [x]), ys, [config.x]);
    const idx = m.leverage.map((_, i) => i + 1);
    const hThresh = (2 * m.p) / m.n;
    const over = m.leverage.filter((h) => h > hThresh).length;
    return {
      traces: [{ type: "bar", x: idx, y: m.leverage,
        hovertemplate: "obs %{x}<br>hat %{y:.3f}<extra></extra>" }],
      layout: {
        xaxis: { title: { text: "Observación" } },
        yaxis: { title: { text: "Apalancamiento (hat)" }, rangemode: "tozero" },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: hThresh, y1: hThresh,
          line: { color: "rgba(110,120,140,0.8)", width: 1, dash: "dash" } }],
        showlegend: false,
      },
      reading: {
        lead: `Apalancamiento de cada observación. El promedio es p/n = ${num(m.p / m.n, 3)}; ${over} caso(s) superan el umbral de 2p/n = ${num(hThresh, 3)}.`,
        stats: [
          { k: "Umbral (2p/n)", v: num(hThresh, 3) },
          { k: "Por encima", v: num(over, 0) },
          { k: "n", v: num(m.n, 0) },
        ],
        notes: ["El apalancamiento mide cuán atípico es un caso en los predictores, con independencia de su respuesta.", "Su suma siempre es igual al número de parámetros del modelo."],
        cautions: ["Un apalancamiento alto solo es problemático si además el caso está mal ajustado (mira la influencia)."],
      },
    };
  },
};

/* ===================== Diagnóstico: Q–Q normal ========================= */
const diagnosticsChart = {
  roles: XY_ROLES,
  build(dataset, config) {
    const { xs, ys } = pairs(dataset.rows, config.x, config.y);
    const m = linearModel(xs.map((x) => [x]), ys, [config.x]);
    const sorted = [...m.stdResiduals].sort((a, b) => a - b);
    const n = sorted.length;
    const theo = sorted.map((_, i) => normalInv((i + 0.5) / n));
    const lo = Math.min(theo[0], sorted[0]);
    const hi = Math.max(theo[n - 1], sorted[n - 1]);
    return {
      traces: [
        { type: "scatter", mode: "markers", x: theo, y: sorted, name: "Residuos",
          marker: { size: 7, opacity: 0.75 },
          hovertemplate: "teórico %{x:.2f}<br>observado %{y:.2f}<extra></extra>" },
        { type: "scatter", mode: "lines", x: [lo, hi], y: [lo, hi], name: "Referencia",
          line: { width: 1.5, dash: "dot" }, hoverinfo: "skip" },
      ],
      layout: {
        xaxis: { title: { text: "Cuantiles teóricos (normal)" } },
        yaxis: { title: { text: "Residuos estandarizados (ordenados)" } },
        showlegend: true,
      },
      reading: {
        lead: `Gráfico cuantil–cuantil: compara los residuos estandarizados con los cuantiles de una normal. Si los residuos son normales, los puntos siguen la recta de referencia.`,
        stats: [{ k: "n", v: num(n, 0) }, { k: "Error típico", v: num(m.sigma) }],
        notes: [
          "Desviaciones en los extremos (forma de S o de coma) indican colas pesadas o asimetría.",
          "Es la comprobación visual de la normalidad de los residuos, uno de los supuestos del modelo.",
        ],
        cautions: ["Con muestras pequeñas, ligeras desviaciones son esperables; no sobreinterpretes."],
      },
    };
  },
};

multipleRegChart.build3d = (dataset, config) => {
  const predictors = dataset.variables
    .filter((v) => v.storageType === "numeric" && v.name !== config.y)
    .map((v) => v.name);
  if (predictors.length < 2) {
    return {
      traces: [{ type: "scatter", x: [0], y: [0], mode: "markers", marker: { opacity: 0 }, hoverinfo: "skip" }],
      layout: { xaxis: { visible: false }, yaxis: { visible: false }, annotations: [{ xref: "paper", yref: "paper", x: 0.5, y: 0.5, showarrow: false, text: "La vista 3D necesita al menos dos predictores numéricos." }] },
      reading: { lead: "La vista 3D del plano de regresión requiere dos predictores numéricos además de la respuesta.", stats: [], notes: [], cautions: [] },
    };
  }
  const [p1, p2] = predictors.slice(0, 2);
  const rows = dataset.rows.filter((r) => typeof r[config.y] === "number" && typeof r[p1] === "number" && typeof r[p2] === "number");
  const X = rows.map((r) => [r[p1], r[p2]]);
  const y = rows.map((r) => r[config.y]);
  const m = linearModel(X, y, [p1, p2]);
  const [b0, b1, b2] = m.coefficients;

  const x1s = rows.map((r) => r[p1]);
  const x2s = rows.map((r) => r[p2]);
  const g1 = linrange(Math.min(...x1s), Math.max(...x1s), 12);
  const g2 = linrange(Math.min(...x2s), Math.max(...x2s), 12);
  const surface = g2.map((v2) => g1.map((v1) => b0 + b1 * v1 + b2 * v2));

  return {
    traces: [
      { type: "surface", x: g1, y: g2, z: surface, opacity: 0.55, showscale: false,
        colorscale: [[0, "#8d9ce4"], [1, "#1f2f8f"]], name: "Plano ajustado", hoverinfo: "skip" },
      { type: "scatter3d", mode: "markers", x: x1s, y: x2s, z: y, name: "Observaciones",
        marker: { size: 4, opacity: 0.85, color: "#e0823d" },
        hovertemplate: `${p1}=%{x}<br>${p2}=%{y}<br>${config.y}=%{z}<extra></extra>` },
    ],
    layout: { scene: { xaxis: { title: { text: p1 } }, yaxis: { title: { text: p2 } }, zaxis: { title: { text: config.y } } }, showlegend: true },
    reading: {
      lead: `Plano de regresión de “${config.y}” sobre “${p1}” y “${p2}”: ${config.y} = ${num(b0)} ${b1 >= 0 ? "+" : "−"} ${num(Math.abs(b1))}·${p1} ${b2 >= 0 ? "+" : "−"} ${num(Math.abs(b2))}·${p2}. Este modelo de dos predictores explica el ${num(m.r2 * 100, 1)} % de la varianza.`,
      stats: [
        { k: `Coef. ${p1}`, v: `${num(b1)} (p=${num(m.pVal[1], 3)})` },
        { k: `Coef. ${p2}`, v: `${num(b2)} (p=${num(m.pVal[2], 3)})` },
        { k: "R² (2 predictores)", v: num(m.r2, 3) },
      ],
      notes: [
        "Los puntos son las observaciones; el plano es la predicción del modelo. La distancia vertical de cada punto al plano es su residuo.",
        "Es un corte de dos predictores del modelo múltiple completo; gira la escena para juzgar el ajuste.",
      ],
      cautions: ["Con más de dos predictores, el ajuste real vive en más dimensiones de las que un plano puede mostrar."],
    },
  };
};

/* ------------------------------ Exportación ---------------------------- */
export const regressionBuilders = {
  "linear-reg": linearRegChart,
  "multiple-reg": multipleRegChart,
  "fitted-curves": fittedCurvesChart,
  residuals: residualsChart,
  influence: influenceChart,
  leverage: leverageChart,
  "reg-diagnostics": diagnosticsChart,
};
