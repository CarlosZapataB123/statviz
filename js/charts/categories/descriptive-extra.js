/**
 * descriptive-extra.js — Variantes descriptivas que completan el catálogo.
 *
 *  - bars-diverging: desviaciones respecto a la media, en barras a ambos lados.
 *  - stem-leaf: diagrama de tallo y hojas (texto fiel al método clásico).
 *  - ridgeline: densidades por grupo superpuestas verticalmente.
 *  - beeswarm: puntos por grupo dispersos para no solaparse.
 *  - raincloud: media violín (densidad) + caja + puntos, por grupo.
 */

import { num, label } from "../format.js";
import { kde1d, axisGrid, beeswarmOffsets } from "../../stats/density.js";

/* ----------------------------- Utilidades ------------------------------ */
function byGroup(dataset, gVar, vVar) {
  const map = new Map();
  for (const r of dataset.rows) {
    const v = r[vVar];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const g = String(r[gVar] ?? "—").trim();
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(v);
  }
  return [...map].map(([name, values]) => ({ name, values }));
}
function quantileOf(sorted, p) {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
const RIDGE = ["rgba(43,68,201,0.30)", "rgba(31,157,139,0.30)", "rgba(224,130,61,0.30)", "rgba(179,71,127,0.30)", "rgba(90,125,42,0.30)"];
const RIDGE_LINE = ["#2b44c9", "#1f9d8b", "#e0823d", "#b3477f", "#5a7d2a"];
const GROUP_VALUE_ROLES = [
  { key: "group", label: "Grupo", accepts: ["categorical"], required: true, hint: "Variable que define los grupos." },
  { key: "value", label: "Valor", accepts: ["numeric"], required: true, hint: "Variable numérica a describir." },
];

/* ========================== Barras divergentes ======================== */
const barsDivergingChart = {
  roles: GROUP_VALUE_ROLES,
  build(dataset, config) {
    const groups = byGroup(dataset, config.group, config.value);
    const means = groups.map((g) => ({ name: g.name, mean: g.values.reduce((s, v) => s + v, 0) / g.values.length }));
    const grand = means.reduce((s, m) => s + m.mean, 0) / means.length;
    const dev = means.map((m) => ({ name: m.name, d: m.mean - grand })).sort((a, b) => a.d - b.d);

    return {
      traces: [{
        type: "bar", orientation: "h",
        y: dev.map((x) => x.name), x: dev.map((x) => x.d),
        marker: { color: dev.map((x) => (x.d >= 0 ? "rgba(43,68,201,0.85)" : "rgba(224,130,61,0.85)")) },
        hovertemplate: "%{y}: %{x:+.2f}<extra></extra>",
      }],
      layout: {
        xaxis: { title: { text: `Desviación de “${config.value}” respecto a la media` }, zeroline: true },
        yaxis: { title: { text: "" } },
        shapes: [{ type: "line", yref: "paper", x0: 0, x1: 0, y0: 0, y1: 1, line: { color: "rgba(110,120,140,0.8)", width: 1 } }],
        showlegend: false,
      },
      reading: {
        lead: `Desviación de cada grupo respecto a la media general de “${config.value}” (${num(grand)}). Las barras a la derecha (azul) están por encima del promedio; a la izquierda (naranja), por debajo.`,
        stats: dev.map((x) => ({ k: x.name, v: num(x.d, 2) })),
        notes: ["Centrar en la media convierte un ranking en una lectura de “por encima / por debajo”.", "El orden por desviación facilita ver los extremos."],
        cautions: ["La desviación no dice si la diferencia es estadísticamente significativa: para eso, compara con un intervalo o una prueba."],
      },
    };
  },
};

/* =========================== Tallo y hojas ============================ */
const stemLeafChart = {
  roles: [{ key: "value", label: "Valor", accepts: ["numeric"], required: true, hint: "Variable numérica." }],
  build(dataset, config) {
    const values = dataset.rows.map((r) => r[config.value]).filter((v) => typeof v === "number" && Number.isFinite(v));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const unit = 10 ** (Math.floor(Math.log10(span)) - 1); // unidad de la hoja
    const scaled = values.map((v) => Math.round(v / unit));
    const stems = new Map();
    for (const sv of scaled.sort((a, b) => a - b)) {
      const stem = Math.floor(sv / 10);
      const leaf = Math.abs(sv % 10);
      if (!stems.has(stem)) stems.set(stem, []);
      stems.get(stem).push(leaf);
    }
    const rows = [...stems.entries()].sort((a, b) => a[0] - b[0]);
    const stemW = Math.max(...rows.map((r) => String(r[0]).length));
    const lines = rows.map(([stem, leaves]) => `${String(stem).padStart(stemW)} │ ${leaves.join(" ")}`);

    const annotations = [
      { xref: "paper", yref: "paper", x: 0.02, y: 0.97, xanchor: "left", align: "left",
        text: `Tallo y hoja de “${config.value}”  ·  hoja = ${num(unit)} ${dataset.unitOf?.(config.value) || ""}`.trim(),
        showarrow: false, font: { family: "IBM Plex Mono, monospace", size: 12 } },
      ...lines.map((ln, i) => ({
        xref: "paper", yref: "paper", x: 0.04, y: 0.88 - (i * 0.82) / Math.max(1, lines.length),
        xanchor: "left", align: "left", text: ln, showarrow: false,
        font: { family: "IBM Plex Mono, monospace", size: 13 },
      })),
    ];

    return {
      traces: [{ type: "scatter", x: [0], y: [0], mode: "markers", marker: { opacity: 0 }, hoverinfo: "skip" }],
      layout: {
        xaxis: { visible: false, range: [0, 1] },
        yaxis: { visible: false, range: [0, 1] },
        annotations,
        showlegend: false,
      },
      reading: {
        lead: `Diagrama de tallo y hojas de ${values.length} valores. Cada fila es un tallo (decenas) y sus hojas (unidades); conserva todos los datos a la vez que muestra la forma de la distribución.`,
        stats: [
          { k: "n", v: num(values.length, 0) },
          { k: "Mínimo", v: num(min) },
          { k: "Máximo", v: num(max) },
          { k: "Unidad de hoja", v: num(unit) },
        ],
        notes: ["A diferencia del histograma, no pierde los valores individuales: es un híbrido entre tabla y gráfico.", "La longitud de cada fila hace las veces de barra de frecuencia."],
        cautions: ["Es poco práctico con muchos datos o rangos muy amplios; ahí conviene un histograma."],
      },
    };
  },
};

/* ============================== Ridgeline ============================= */
const ridgelineChart = {
  roles: GROUP_VALUE_ROLES,
  build(dataset, config) {
    const groups = byGroup(dataset, config.group, config.value);
    const all = groups.flatMap((g) => g.values);
    const grid = axisGrid(Math.min(...all), Math.max(...all), 80);
    const densities = groups.map((g) => kde1d(g.values, grid));
    const maxDens = Math.max(...densities.flat(), 1e-9);
    const step = 1;
    const scale = (step * 1.7) / maxDens;

    const traces = [];
    groups.forEach((g, k) => {
      const base = k * step;
      const top = densities[k].map((d) => base + d * scale);
      traces.push({
        type: "scatter", mode: "lines",
        x: [...grid, ...grid.slice().reverse()],
        y: [...top, ...grid.map(() => base).reverse()],
        fill: "toself", fillcolor: RIDGE[k % RIDGE.length],
        line: { color: RIDGE_LINE[k % RIDGE_LINE.length], width: 1.5 },
        name: g.name, hoverinfo: "name",
      });
    });

    return {
      traces,
      layout: {
        xaxis: { title: { text: label(dataset, config.value) } },
        yaxis: { tickvals: groups.map((_, k) => k * step), ticktext: groups.map((g) => g.name), title: { text: "" } },
        showlegend: false,
      },
      reading: {
        lead: `Densidades de “${config.value}” por “${config.group}”, superpuestas. Permite comparar de un vistazo desplazamientos, dispersión y número de modas entre grupos.`,
        stats: groups.map((g) => ({ k: g.name, v: `${g.values.length} obs.` })),
        notes: ["Cada cresta es la distribución suavizada (KDE) de un grupo; el solapamiento ahorra espacio sin perder comparabilidad.", "Crestas desplazadas indican diferencias de nivel; más anchas, mayor variabilidad."],
        cautions: ["El suavizado depende del ancho de banda; modas muy finas pueden quedar difuminadas."],
      },
    };
  },
};

/* ============================== Beeswarm ============================== */
const beeswarmChart = {
  roles: GROUP_VALUE_ROLES,
  build(dataset, config) {
    const groups = byGroup(dataset, config.group, config.value);
    const traces = groups.map((g, k) => {
      const all = g.values;
      const range = (Math.max(...all) - Math.min(...all)) || 1;
      const lanes = beeswarmOffsets(all, range / 35);
      const maxLane = Math.max(1, ...lanes.map((l) => Math.abs(l)));
      const spread = 0.38 / maxLane;
      return {
        type: "scatter", mode: "markers", name: g.name,
        x: lanes.map((l) => k + l * spread), y: all,
        marker: { size: 7, opacity: 0.8 },
        hovertemplate: `${g.name}<br>${config.value}=%{y}<extra></extra>`,
      };
    });
    return {
      traces,
      layout: {
        xaxis: { tickvals: groups.map((_, k) => k), ticktext: groups.map((g) => g.name), title: { text: config.group }, range: [-0.6, groups.length - 0.4] },
        yaxis: { title: { text: label(dataset, config.value) } },
        showlegend: false,
      },
      reading: {
        lead: `Enjambre de “${config.value}” por “${config.group}”: cada punto es una observación, desplazada lateralmente solo para no solaparse. Muestra todos los datos y revela su forma y los valores atípicos.`,
        stats: groups.map((g) => ({ k: g.name, v: `${g.values.length} obs.` })),
        notes: ["A diferencia del diagrama de caja, no oculta la distribución real ni los huecos.", "El ancho del enjambre en cada altura aproxima la densidad de datos."],
        cautions: ["Con muchísimos puntos el enjambre se ensancha en exceso; ahí un violín o una caja resumen mejor."],
      },
    };
  },
};

/* ============================== Raincloud ============================= */
const raincloudChart = {
  roles: GROUP_VALUE_ROLES,
  build(dataset, config) {
    const groups = byGroup(dataset, config.group, config.value);
    const all = groups.flatMap((g) => g.values);
    const grid = axisGrid(Math.min(...all), Math.max(...all), 70);
    const densities = groups.map((g) => kde1d(g.values, grid));
    const maxDens = Math.max(...densities.flat(), 1e-9);

    const traces = [];
    const shapes = [];
    groups.forEach((g, k) => {
      const base = k;
      // Nube (media violín) por encima de la línea base.
      const top = densities[k].map((d) => base + 0.12 + (d / maxDens) * 0.34);
      traces.push({
        type: "scatter", mode: "lines",
        x: [...grid, ...grid.slice().reverse()],
        y: [...top, ...grid.map(() => base + 0.12).reverse()],
        fill: "toself", fillcolor: RIDGE[k % RIDGE.length], line: { color: RIDGE_LINE[k % RIDGE_LINE.length], width: 1.2 },
        name: g.name, hoverinfo: "name",
      });
      // Lluvia (puntos) por debajo, con dispersión determinista.
      traces.push({
        type: "scatter", mode: "markers",
        x: g.values, y: g.values.map((_, i) => base - 0.14 - ((i % 6) / 6) * 0.12),
        marker: { size: 5, opacity: 0.6, color: RIDGE_LINE[k % RIDGE_LINE.length] },
        hovertemplate: `${g.name}<br>${config.value}=%{x}<extra></extra>`, showlegend: false,
      });
      // Caja (Q1–Q3, mediana, bigotes) sobre la línea base.
      const sorted = [...g.values].sort((a, b) => a - b);
      const q1 = quantileOf(sorted, 0.25);
      const q3 = quantileOf(sorted, 0.5 + 0.25);
      const med = quantileOf(sorted, 0.5);
      shapes.push(
        { type: "rect", xref: "x", yref: "y", x0: q1, x1: q3, y0: base - 0.04, y1: base + 0.04, line: { color: RIDGE_LINE[k % RIDGE_LINE.length], width: 1 }, fillcolor: "rgba(255,255,255,0.35)" },
        { type: "line", xref: "x", yref: "y", x0: med, x1: med, y0: base - 0.05, y1: base + 0.05, line: { color: RIDGE_LINE[k % RIDGE_LINE.length], width: 2 } },
        { type: "line", xref: "x", yref: "y", x0: sorted[0], x1: q1, y0: base, y1: base, line: { color: RIDGE_LINE[k % RIDGE_LINE.length], width: 1 } },
        { type: "line", xref: "x", yref: "y", x0: q3, x1: sorted[sorted.length - 1], y0: base, y1: base, line: { color: RIDGE_LINE[k % RIDGE_LINE.length], width: 1 } },
      );
    });

    return {
      traces,
      layout: {
        xaxis: { title: { text: label(dataset, config.value) } },
        yaxis: { tickvals: groups.map((_, k) => k), ticktext: groups.map((g) => g.name), title: { text: "" }, range: [-0.5, groups.length - 0.3] },
        shapes,
        showlegend: false,
      },
      reading: {
        lead: `Raincloud de “${config.value}” por “${config.group}”: combina la densidad (nube), el resumen de cinco números (caja) y los datos crudos (lluvia) en una sola vista por grupo.`,
        stats: groups.map((g) => ({ k: g.name, v: `${g.values.length} obs.` })),
        notes: ["Reúne en una imagen lo que muestran por separado el violín, el diagrama de caja y el de puntos.", "La caja aporta la mediana y los cuartiles; la nube, la forma; la lluvia, cada observación."],
        cautions: ["Es densa en información: conviene reservarla para comparar pocos grupos."],
      },
    };
  },
};

/* ------------------------------ Exportación ---------------------------- */
export const descriptiveExtraBuilders = {
  "bars-diverging": barsDivergingChart,
  "stem-leaf": stemLeafChart,
  ridgeline: ridgelineChart,
  beeswarm: beeswarmChart,
  raincloud: raincloudChart,
};
