/**
 * inference.js — Constructores de la categoría Inferencia.
 *
 * Visualizan resultados inferenciales calculados sobre los datos con el módulo
 * js/stats/tests.js (que a su vez usa el motor de distribuciones):
 *  - conf-interval: medias con intervalo de confianza por grupo.
 *  - forest: tamaños de efecto con IC y combinación por varianza inversa.
 *  - funnel: dispersión efecto–precisión para detectar asimetría/sesgo.
 *  - volcano: tamaño de efecto frente a significación (−log10 p).
 *  - roc: sensibilidad frente a 1−especificidad, con AUC.
 *  - pr-curve: precisión frente a exhaustividad, con AP.
 */

import { num, label } from "../format.js";
import {
  groupStats,
  meanCI,
  pooledIV,
  rocCurve,
  prCurve,
  positiveLevelByScore,
} from "../../stats/tests.js";

/** Filtra filas con todas las claves numéricas presentes y finitas. */
function rowsWith(rows, numericKeys, otherKeys = []) {
  return rows.filter(
    (r) =>
      numericKeys.every((k) => typeof r[k] === "number" && Number.isFinite(r[k])) &&
      otherKeys.every((k) => r[k] != null && String(r[k]).trim() !== "")
  );
}

const NEG_LOG10 = (p) => -Math.log10(Math.max(p, 1e-300));

/* ===================== Intervalos de confianza ========================= */
const confIntervalChart = {
  roles: [
    { key: "y", label: "Variable numérica", accepts: ["numeric"], required: true,
      hint: "Variable de la que se estima la media." },
    { key: "group", label: "Agrupar por (opcional)", accepts: ["categorical"], required: false,
      hint: "Estima un intervalo por cada grupo." },
  ],
  build(dataset, config) {
    const gs = groupStats(dataset.rows, config.y, config.group);
    const cis = gs.map((g) => ({ ...g, ci: meanCI(g.mean, g.se, g.n) }));
    return {
      traces: [{
        type: "scatter", mode: "markers", x: cis.map((g) => g.group),
        y: cis.map((g) => g.mean),
        error_y: { type: "data", array: cis.map((g) => g.ci.half), visible: true, thickness: 1.4 },
        marker: { size: 9 },
        hovertemplate: "%{x}<br>media %{y:.2f}<extra></extra>",
      }],
      layout: {
        xaxis: { title: { text: config.group || "" } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: false,
      },
      reading: {
        lead: `Media de “${config.y}”${config.group ? ` por “${config.group}”` : ""} con intervalo de confianza al 95 %. El intervalo acota el rango plausible de la media poblacional, no la dispersión de los datos.`,
        stats: cis.map((g) => ({ k: `${g.group} (n=${g.n})`, v: `${num(g.mean)}  [${num(g.ci.lo)}, ${num(g.ci.hi)}]` })),
        notes: [
          "El IC se calcula con la t de Student y crece cuanto menor es n o mayor la variabilidad.",
          "Que dos intervalos se solapen no equivale a una prueba formal de diferencia (usa t o ANOVA).",
        ],
        cautions: ["El IC al 95 % no significa “95 % de probabilidad de contener la media”: es una afirmación sobre el procedimiento a largo plazo."],
      },
    };
  },
};

/* ============================ Forest plot ============================== */
const forestChart = {
  roles: [
    { key: "study", label: "Estudio / subgrupo", accepts: ["categorical"], required: true,
      hint: "Etiqueta de cada estimación." },
    { key: "estimate", label: "Estimación", accepts: ["numeric"], required: true,
      hint: "Tamaño del efecto de cada estudio." },
    { key: "lower", label: "IC inferior", accepts: ["numeric"], required: true,
      hint: "Límite inferior del intervalo." },
    { key: "upper", label: "IC superior", accepts: ["numeric"], required: true,
      hint: "Límite superior del intervalo." },
  ],
  build(dataset, config) {
    const rows = rowsWith(dataset.rows, [config.estimate, config.lower, config.upper], [config.study]);
    const labels = rows.map((r) => String(r[config.study]));
    const est = rows.map((r) => r[config.estimate]);
    const lo = rows.map((r) => r[config.lower]);
    const hi = rows.map((r) => r[config.upper]);
    const se = rows.map((_, i) => (hi[i] - lo[i]) / (2 * 1.96));
    const pooled = pooledIV(est, se);

    const yLabels = [...labels, "Global (efectos fijos)"];
    const significant = rows.filter((_, i) => lo[i] > 0 || hi[i] < 0).length;

    return {
      traces: [
        {
          type: "scatter", mode: "markers", name: "Estudios",
          y: labels, x: est,
          error_x: { type: "data", symmetric: false,
            array: est.map((e, i) => hi[i] - e), arrayminus: est.map((e, i) => e - lo[i]),
            visible: true, thickness: 1.2 },
          marker: { size: 8, symbol: "square" },
          hovertemplate: "%{y}<br>%{x:.2f} [%{customdata}]<extra></extra>",
          customdata: rows.map((_, i) => `${num(lo[i])}, ${num(hi[i])}`),
        },
        {
          type: "scatter", mode: "markers", name: "Combinado",
          y: ["Global (efectos fijos)"], x: [pooled.estimate],
          error_x: { type: "data", symmetric: false, array: [pooled.hi - pooled.estimate],
            arrayminus: [pooled.estimate - pooled.lo], visible: true, thickness: 1.6 },
          marker: { size: 14, symbol: "diamond" },
          hovertemplate: "Combinado<br>%{x:.2f}<extra></extra>",
        },
      ],
      layout: {
        xaxis: { title: { text: "Tamaño del efecto" } },
        yaxis: { title: { text: "" }, categoryarray: yLabels.slice().reverse(), categoryorder: "array", automargin: true },
        shapes: [{ type: "line", x0: 0, x1: 0, yref: "paper", y0: 0, y1: 1,
          line: { color: "rgba(110,120,140,0.7)", width: 1, dash: "dash" } }],
        showlegend: true,
      },
      reading: {
        lead: `Combinación de ${rows.length} estimaciones. El efecto global (varianza inversa) es ${num(pooled.estimate)} con IC95 % [${num(pooled.lo)}, ${num(pooled.hi)}]; ${pooled.lo > 0 || pooled.hi < 0 ? "excluye" : "incluye"} el valor nulo (0).`,
        stats: [
          { k: "Estudios", v: num(rows.length, 0) },
          { k: "Efecto global", v: num(pooled.estimate) },
          { k: "IC95 % global", v: `[${num(pooled.lo)}, ${num(pooled.hi)}]` },
          { k: "Significativos", v: `${significant} / ${rows.length}` },
        ],
        notes: [
          "Cada marca cuadrada es un estudio; el diamante resume el conjunto ponderando por el inverso de la varianza (más peso a los más precisos).",
          "La línea discontinua marca el valor nulo: las estimaciones que no la cruzan son significativas a su nivel.",
        ],
        cautions: ["El modelo de efectos fijos asume un único efecto verdadero; con heterogeneidad alta es preferible un modelo de efectos aleatorios."],
      },
    };
  },
};

/* ============================ Funnel plot ============================== */
const funnelChart = {
  roles: [
    { key: "estimate", label: "Estimación", accepts: ["numeric"], required: true,
      hint: "Tamaño del efecto de cada estudio." },
    { key: "lower", label: "IC inferior", accepts: ["numeric"], required: true, hint: "Límite inferior." },
    { key: "upper", label: "IC superior", accepts: ["numeric"], required: true, hint: "Límite superior." },
  ],
  build(dataset, config) {
    const rows = rowsWith(dataset.rows, [config.estimate, config.lower, config.upper]);
    const est = rows.map((r) => r[config.estimate]);
    const se = rows.map((r) => (r[config.upper] - r[config.lower]) / (2 * 1.96));
    const pooled = pooledIV(est, se);
    const maxSE = Math.max(...se, 0.01);

    // Embudo: pseudo-IC del 95 % alrededor del efecto combinado.
    const seGrid = [0, maxSE * 1.05];
    return {
      traces: [
        { type: "scatter", mode: "markers", name: "Estudios", x: est, y: se,
          marker: { size: 9, opacity: 0.8 },
          hovertemplate: "efecto %{x:.2f}<br>EE %{y:.3f}<extra></extra>" },
        { type: "scatter", mode: "lines", name: "Límite 95 %",
          x: seGrid.map((s) => pooled.estimate - 1.96 * s), y: seGrid,
          line: { width: 1, dash: "dot" }, hoverinfo: "skip" },
        { type: "scatter", mode: "lines", showlegend: false,
          x: seGrid.map((s) => pooled.estimate + 1.96 * s), y: seGrid,
          line: { width: 1, dash: "dot" }, hoverinfo: "skip" },
      ],
      layout: {
        xaxis: { title: { text: "Tamaño del efecto" } },
        yaxis: { title: { text: "Error estándar" }, autorange: "reversed", rangemode: "tozero" },
        shapes: [{ type: "line", x0: pooled.estimate, x1: pooled.estimate, yref: "paper", y0: 0, y1: 1,
          line: { color: "rgba(110,120,140,0.7)", width: 1, dash: "dash" } }],
        showlegend: true,
      },
      reading: {
        lead: `Cada punto es un estudio situado por su efecto (eje X) y su precisión (error estándar, eje Y invertido: los más precisos arriba). En ausencia de sesgo, los puntos se reparten simétricamente dentro del embudo.`,
        stats: [
          { k: "Estudios", v: num(rows.length, 0) },
          { k: "Efecto combinado", v: num(pooled.estimate) },
        ],
        notes: [
          "La asimetría —p. ej. ausencia de estudios pequeños con efecto negativo— sugiere sesgo de publicación.",
          "El embudo marca el rango esperado del 95 % alrededor del efecto combinado para cada nivel de precisión.",
        ],
        cautions: ["La asimetría puede deberse a heterogeneidad genuina y no solo a sesgo; interprétala con prudencia y con pocos estudios evítala."],
      },
    };
  },
};

/* ============================ Volcano plot ============================= */
const volcanoChart = {
  roles: [
    { key: "effect", label: "Tamaño de efecto", accepts: ["numeric"], required: true,
      hint: "Diferencia o log-fold-change por variable." },
    { key: "pvalue", label: "Valor p", accepts: ["numeric"], required: true,
      hint: "Significación de cada variable." },
    { key: "labelVar", label: "Etiqueta (opcional)", accepts: ["categorical"], required: false,
      hint: "Nombre de cada punto." },
  ],
  paramRoles: [
    { key: "alpha", label: "Nivel α", type: "number", min: 0.001, max: 0.2, step: 0.005, default: 0.05,
      hint: "Umbral de significación (línea horizontal)." },
    { key: "effMin", label: "Efecto mínimo", type: "number", min: 0, max: 5, step: 0.1, default: 0.5,
      hint: "Magnitud mínima relevante (líneas verticales)." },
  ],
  build(dataset, config) {
    const rows = rowsWith(dataset.rows, [config.effect, config.pvalue]);
    const alpha = config.alpha ?? 0.05;
    const effMin = config.effMin ?? 0.5;
    const groups = { up: [], down: [], ns: [] };
    for (const r of rows) {
      const e = r[config.effect];
      const p = r[config.pvalue];
      const name = config.labelVar ? String(r[config.labelVar]) : "";
      const point = { x: e, y: NEG_LOG10(p), name };
      if (p < alpha && e >= effMin) groups.up.push(point);
      else if (p < alpha && e <= -effMin) groups.down.push(point);
      else groups.ns.push(point);
    }
    const mk = (pts, name) => ({
      type: "scatter", mode: "markers", name,
      x: pts.map((p) => p.x), y: pts.map((p) => p.y),
      text: pts.map((p) => p.name), marker: { size: 8, opacity: 0.8 },
      hovertemplate: "%{text}<br>efecto %{x:.2f}<br>−log10 p %{y:.2f}<extra></extra>",
    });
    return {
      traces: [mk(groups.ns, "No significativo"), mk(groups.up, "↑ significativo"), mk(groups.down, "↓ significativo")],
      layout: {
        xaxis: { title: { text: "Tamaño de efecto" } },
        yaxis: { title: { text: "−log10(valor p)" }, rangemode: "tozero" },
        shapes: [
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: NEG_LOG10(alpha), y1: NEG_LOG10(alpha),
            line: { color: "rgba(110,120,140,0.7)", width: 1, dash: "dash" } },
          { type: "line", yref: "paper", x0: effMin, x1: effMin, y0: 0, y1: 1,
            line: { color: "rgba(110,120,140,0.5)", width: 1, dash: "dot" } },
          { type: "line", yref: "paper", x0: -effMin, x1: -effMin, y0: 0, y1: 1,
            line: { color: "rgba(110,120,140,0.5)", width: 1, dash: "dot" } },
        ],
        showlegend: true,
      },
      reading: {
        lead: `De ${rows.length} variables, ${groups.up.length + groups.down.length} superan a la vez el umbral de significación (α = ${num(alpha, 3)}) y de efecto (|efecto| ≥ ${num(effMin)}): ${groups.up.length} en sentido positivo y ${groups.down.length} negativo.`,
        stats: [
          { k: "Total", v: num(rows.length, 0) },
          { k: "↑ significativas", v: num(groups.up.length, 0) },
          { k: "↓ significativas", v: num(groups.down.length, 0) },
        ],
        notes: [
          "Combina magnitud (eje X) y evidencia (eje Y): solo las esquinas superiores son a la vez grandes y significativas.",
          "Sube α o el efecto mínimo para endurecer o relajar los criterios.",
        ],
        cautions: ["Con muchas comparaciones, controla la tasa de falsos positivos (p. ej. FDR de Benjamini–Hochberg) antes de declarar hallazgos."],
      },
    };
  },
};

/* =============================== ROC =================================== */
const rocChart = {
  roles: [
    { key: "score", label: "Puntuación", accepts: ["numeric"], required: true,
      hint: "Predictor continuo o probabilidad estimada." },
    { key: "outcome", label: "Clase real", accepts: ["categorical"], required: true,
      hint: "Variable binaria (positivo / negativo)." },
  ],
  build(dataset, config) {
    const rows = rowsWith(dataset.rows, [config.score], [config.outcome]);
    const pos = positiveLevelByScore(rows, config.score, config.outcome);
    const positive = rows.map((r) => String(r[config.outcome]).trim() === pos);
    const { points, auc } = rocCurve(rows.map((r) => r[config.score]), positive);
    const quality = auc >= 0.9 ? "excelente" : auc >= 0.8 ? "buena" : auc >= 0.7 ? "aceptable" : auc >= 0.6 ? "pobre" : "nula";
    return {
      traces: [{
        type: "scatter", mode: "lines", name: `ROC (AUC ${num(auc, 3)})`,
        x: points.map((p) => p.fpr), y: points.map((p) => p.tpr),
        line: { width: 2, shape: "hv" },
        hovertemplate: "FPR %{x:.2f}<br>TPR %{y:.2f}<extra></extra>",
      }],
      layout: {
        xaxis: { title: { text: "1 − especificidad (FPR)" }, range: [0, 1] },
        yaxis: { title: { text: "Sensibilidad (TPR)" }, range: [0, 1] },
        shapes: [{ type: "line", x0: 0, y0: 0, x1: 1, y1: 1,
          line: { color: "rgba(110,120,140,0.6)", width: 1, dash: "dash" } }],
        showlegend: true,
      },
      reading: {
        lead: `Capacidad de “${config.score}” para discriminar la clase “${pos}”. El área bajo la curva (AUC) es ${num(auc, 3)}: discriminación ${quality}.`,
        stats: [
          { k: "AUC", v: num(auc, 3) },
          { k: "Clase positiva", v: pos },
          { k: "n", v: num(rows.length, 0) },
        ],
        notes: [
          "La diagonal representa un clasificador sin información (AUC = 0.5); cuanto más se acerca la curva a la esquina superior izquierda, mejor.",
          "El AUC es la probabilidad de que un positivo al azar reciba mayor puntuación que un negativo al azar.",
        ],
        cautions: ["La curva ROC puede ser optimista con clases muy desbalanceadas; complétala con la curva de precisión–recall."],
      },
    };
  },
};

/* ========================= Precisión–Recall =========================== */
const prChart = {
  roles: rocChart.roles,
  build(dataset, config) {
    const rows = rowsWith(dataset.rows, [config.score], [config.outcome]);
    const pos = positiveLevelByScore(rows, config.score, config.outcome);
    const positive = rows.map((r) => String(r[config.outcome]).trim() === pos);
    const { points, ap, prevalence } = prCurve(rows.map((r) => r[config.score]), positive);
    return {
      traces: [{
        type: "scatter", mode: "lines", name: `PR (AP ${num(ap, 3)})`,
        x: points.map((p) => p.recall), y: points.map((p) => p.precision),
        line: { width: 2 },
        hovertemplate: "recall %{x:.2f}<br>precisión %{y:.2f}<extra></extra>",
      }],
      layout: {
        xaxis: { title: { text: "Exhaustividad (recall)" }, range: [0, 1] },
        yaxis: { title: { text: "Precisión" }, range: [0, 1] },
        shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: prevalence, y1: prevalence,
          line: { color: "rgba(110,120,140,0.6)", width: 1, dash: "dash" } }],
        showlegend: true,
      },
      reading: {
        lead: `Compromiso entre precisión y exhaustividad para la clase “${pos}”. La precisión media (AP) es ${num(ap, 3)}; la línea base (prevalencia) está en ${num(prevalence, 3)}.`,
        stats: [
          { k: "AP", v: num(ap, 3) },
          { k: "Prevalencia", v: num(prevalence, 3) },
          { k: "Clase positiva", v: pos },
        ],
        notes: [
          "A diferencia de la ROC, la curva PR es informativa cuando la clase positiva es minoritaria.",
          "La línea base horizontal es la precisión de un clasificador aleatorio (la prevalencia).",
        ],
        cautions: ["Comparar AP entre conjuntos con distinta prevalencia puede inducir a error: la línea base cambia."],
      },
    };
  },
};

/* ------------------------------ Exportación ---------------------------- */
export const inferenceBuilders = {
  "conf-interval": confIntervalChart,
  forest: forestChart,
  funnel: funnelChart,
  volcano: volcanoChart,
  roc: rocChart,
  "pr-curve": prChart,
};
