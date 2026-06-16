/**
 * descriptive.js — Constructores de gráficos de estadística descriptiva.
 *
 * Cada entrada declara:
 *  - roles: qué variables necesita y de qué tipo (para el panel de
 *    configuración y la validación del renderizador).
 *  - build(dataset, config): produce { traces, layout, reading, warnings }
 *    a partir de los datos reales. La "lectura" es un objeto estructurado que
 *    el panel de interpretación convierte en texto; no son plantillas fijas.
 *
 * La estadística se apoya en el motor de datos (Fase 2): binning, frecuencias,
 * agrupación y resúmenes numéricos.
 */

import {
  numericVector,
  binNumeric,
  frequencyTable,
  groupBy,
  contingencyTable,
  numericSummary,
} from "../../data/transformer.js";
import { num, label } from "../format.js";
import { normalPdf } from "../../stats/distributions.js";

/* ----------------------------- Utilidades ------------------------------ */

/** Valores categóricos (cadenas) presentes de una variable. */
function catValues(rows, name) {
  return rows.map((r) => r[name]).filter((v) => v != null && String(v).trim() !== "");
}

/** Asimetría muestral (g1) para describir la forma. */
function skewness(xs) {
  const n = xs.length;
  if (n < 3) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const s = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / n);
  if (s === 0) return 0;
  return xs.reduce((a, b) => a + ((b - m) / s) ** 3, 0) / n;
}

/** Describe la asimetría en palabras. */
function skewWord(g1) {
  if (g1 > 0.5) return "asimetría positiva (cola hacia la derecha)";
  if (g1 < -0.5) return "asimetría negativa (cola hacia la izquierda)";
  return "distribución aproximadamente simétrica";
}

/* ----------------------------- Histograma ------------------------------ */
const histogram = {
  roles: [
    { key: "x", label: "Variable", accepts: ["numeric"], required: true,
      hint: "Variable continua cuya distribución se examina." },
  ],
  build(dataset, config) {
    const xs = numericVector(dataset.rows, config.x);
    const s = numericSummary(xs);
    const bins = binNumeric(xs, {});
    const width = bins.length ? bins[0].x1 - bins[0].x0 : 1;

    const barTrace = {
      type: "bar",
      x: bins.map((b) => b.mid),
      y: bins.map((b) => b.count),
      width: width * 0.96,
      name: "Frecuencia",
      hovertemplate: "[%{customdata}]<br>f = %{y}<extra></extra>",
      customdata: bins.map((b) => `${num(b.x0)} – ${num(b.x1)}`),
    };

    // Curva normal de referencia escalada a frecuencias.
    const grid = [];
    const step = (s.max - s.min) / 80 || 1;
    for (let x = s.min; x <= s.max + step / 2; x += step) {
      grid.push(x);
    }
    const normalTrace = {
      type: "scatter",
      mode: "lines",
      x: grid,
      y: grid.map((x) => normalPdf(x, s.mean, s.sd) * s.n * width),
      name: "Normal de referencia",
      line: { width: 1.5, dash: "dot" },
      hoverinfo: "skip",
    };

    const g1 = skewness(xs);
    return {
      traces: [barTrace, normalTrace],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: "Frecuencia" } },
        bargap: 0.02,
        showlegend: true,
      },
      reading: {
        lead: `La variable “${config.x}” se distribuye con una media de ${num(s.mean)} y mediana de ${num(s.median)} sobre ${s.n} observaciones; presenta ${skewWord(g1)}.`,
        stats: [
          { k: "n", v: num(s.n, 0) },
          { k: "Media", v: num(s.mean) },
          { k: "Mediana", v: num(s.median) },
          { k: "DE", v: num(s.sd) },
          { k: "Mín–Máx", v: `${num(s.min)} – ${num(s.max)}` },
          { k: "Asimetría", v: num(g1) },
        ],
        notes: [
          "La curva punteada es una normal con la misma media y desviación: sirve de referencia visual, no de prueba de normalidad.",
          "El número de clases sigue la regla de Sturges; cambiar su número puede revelar o esconder estructura.",
        ],
        cautions:
          Math.abs(s.mean - s.median) > s.sd * 0.3
            ? ["La separación entre media y mediana sugiere asimetría: considera la mediana como medida de posición."]
            : [],
      },
    };
  },
};

/* -------------------------- Polígono de frecuencias -------------------- */
const frequencyPolygon = {
  roles: histogram.roles,
  build(dataset, config) {
    const xs = numericVector(dataset.rows, config.x);
    const bins = binNumeric(xs, {});
    const width = bins.length ? bins[0].x1 - bins[0].x0 : 1;
    // Anclar el trazo en cero antes de la primera y después de la última clase.
    const x = [bins[0]?.mid - width, ...bins.map((b) => b.mid), bins[bins.length - 1]?.mid + width];
    const y = [0, ...bins.map((b) => b.count), 0];
    return {
      traces: [{ type: "scatter", mode: "lines+markers", x, y, fill: "tozeroy",
        line: { width: 2 }, name: "Frecuencia" }],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: "Frecuencia" } },
      },
      reading: {
        lead: `El polígono une los puntos medios de ${bins.length} clases de “${config.x}”, mostrando la silueta de la distribución como alternativa al histograma.`,
        stats: [{ k: "Clases", v: num(bins.length, 0) }, { k: "n", v: num(xs.length, 0) }],
        notes: ["Útil para comparar la forma de dos o más distribuciones superpuestas."],
        cautions: [],
      },
    };
  },
};

/* -------------------------------- Ojiva -------------------------------- */
const ogive = {
  roles: histogram.roles,
  build(dataset, config) {
    const xs = numericVector(dataset.rows, config.x);
    const bins = binNumeric(xs, {});
    const n = xs.length || 1;
    let acc = 0;
    const x = [bins[0]?.x0];
    const y = [0];
    for (const b of bins) {
      acc += b.count;
      x.push(b.x1);
      y.push((acc / n) * 100);
    }
    return {
      traces: [{ type: "scatter", mode: "lines+markers", x, y, line: { width: 2 },
        name: "F. acumulada", hovertemplate: "≤ %{x:.2f}<br>%{y:.1f}%<extra></extra>" }],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: "Frecuencia acumulada (%)" }, range: [0, 100] },
      },
      reading: {
        lead: `La ojiva acumula la frecuencia relativa de “${config.x}”. Permite leer percentiles directamente: la altura de la curva indica qué porcentaje de casos queda por debajo de cada valor.`,
        stats: [{ k: "n", v: num(xs.length, 0) }],
        notes: ["El valor donde la curva cruza el 50 % aproxima la mediana."],
        cautions: [],
      },
    };
  },
};

/* ------------------------------- Densidad ------------------------------ */
const density = {
  roles: histogram.roles,
  build(dataset, config) {
    const xs = numericVector(dataset.rows, config.x);
    const s = numericSummary(xs);
    const n = xs.length;
    // Ancho de banda de Silverman.
    const iqr = s.q3 - s.q1;
    const sigma = Math.min(s.sd, iqr > 0 ? iqr / 1.349 : s.sd) || s.sd || 1;
    const h = 1.06 * sigma * Math.pow(n, -1 / 5) || 1;
    const lo = s.min - 3 * h;
    const hi = s.max + 3 * h;
    const step = (hi - lo) / 120 || 1;
    const gx = [];
    const gy = [];
    for (let x = lo; x <= hi; x += step) {
      let acc = 0;
      for (const xi of xs) acc += normalPdf(x, xi, h);
      gx.push(x);
      gy.push(acc / n);
    }
    return {
      traces: [{ type: "scatter", mode: "lines", x: gx, y: gy, fill: "tozeroy",
        line: { width: 2 }, name: "Densidad" }],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: "Densidad" }, rangemode: "tozero" },
      },
      reading: {
        lead: `Estimación de densidad por núcleo (KDE) de “${config.x}”, una versión suavizada del histograma con media ${num(s.mean)} y desviación ${num(s.sd)}.`,
        stats: [
          { k: "n", v: num(n, 0) },
          { k: "Ancho de banda", v: num(h) },
          { k: "Media", v: num(s.mean) },
        ],
        notes: ["El ancho de banda controla el suavizado: valores pequeños revelan más detalle; grandes, más tendencia. Aquí se usa la regla de Silverman."],
        cautions: ["La KDE puede insinuar densidad fuera del rango real de los datos; interpreta los extremos con cautela."],
      },
    };
  },
};

/* --------------------- Caja / Violín / Strip --------------------------- */
const numericByGroupRoles = [
  { key: "y", label: "Variable numérica", accepts: ["numeric"], required: true,
    hint: "Variable cuya distribución se resume." },
  { key: "group", label: "Agrupar por (opcional)", accepts: ["categorical"], required: false,
    hint: "Compara la distribución entre los niveles de una variable categórica." },
];

/** Construye la lectura comparativa por grupos de una variable numérica. */
function groupReading(dataset, config, kind) {
  const total = numericSummary(numericVector(dataset.rows, config.y));
  if (config.group) {
    const meds = groupBy(dataset.rows, config.group, config.y, "median");
    const sorted = [...meds].sort((a, b) => b.value - a.value);
    const hi = sorted[0];
    const lo = sorted[sorted.length - 1];
    return {
      lead: `Distribución de “${config.y}” según “${config.group}”. La mediana más alta corresponde a ${hi?.group} (${num(hi?.value)}) y la más baja a ${lo?.group} (${num(lo?.value)}).`,
      stats: meds.map((m) => ({ k: `Md · ${m.group}`, v: `${num(m.value)} (n=${m.n})` })),
      notes: [
        kind === "box"
          ? "La caja abarca el rango intercuartílico (Q1–Q3); la línea interior es la mediana y los puntos, atípicos."
          : "El violín muestra la densidad estimada por grupo; revela bimodalidad que una caja ocultaría.",
        "Diferencias visibles de mediana sugieren, pero no confirman, diferencias entre grupos: requieren un contraste inferencial (Fase 4).",
      ],
      cautions: [],
    };
  }
  return {
    lead: `Resumen de “${config.y}”: mediana ${num(total.median)}, rango intercuartílico ${num(total.q3 - total.q1)} y ${total.n} observaciones.`,
    stats: [
      { k: "n", v: num(total.n, 0) },
      { k: "Mediana", v: num(total.median) },
      { k: "Q1", v: num(total.q1) },
      { k: "Q3", v: num(total.q3) },
    ],
    notes: ["Agrega una variable categórica para comparar la distribución entre grupos."],
    cautions: [],
  };
}

const boxplot = {
  roles: numericByGroupRoles,
  build(dataset, config) {
    const y = numericVector(dataset.rows, config.y);
    const trace = config.group
      ? { type: "box", x: catValues(dataset.rows, config.group), y: dataset.rows.map((r) => r[config.y]), boxpoints: "outliers" }
      : { type: "box", y, name: config.y, boxpoints: "outliers" };
    return {
      traces: [trace],
      layout: {
        xaxis: { title: { text: config.group || "" } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: false,
      },
      reading: groupReading(dataset, config, "box"),
    };
  },
};

const violin = {
  roles: numericByGroupRoles,
  build(dataset, config) {
    const base = { type: "violin", box: { visible: true }, meanline: { visible: true }, points: false };
    const trace = config.group
      ? { ...base, x: catValues(dataset.rows, config.group), y: dataset.rows.map((r) => r[config.y]) }
      : { ...base, y: numericVector(dataset.rows, config.y), name: config.y };
    return {
      traces: [trace],
      layout: {
        xaxis: { title: { text: config.group || "" } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: false,
      },
      reading: groupReading(dataset, config, "violin"),
    };
  },
};

const strip = {
  roles: numericByGroupRoles,
  build(dataset, config) {
    // Caja transparente con todos los puntos: produce un "strip" con jitter.
    const base = {
      type: "box", boxpoints: "all", jitter: 0.5, pointpos: 0,
      fillcolor: "rgba(0,0,0,0)", line: { color: "rgba(0,0,0,0)" },
      hoveron: "points", marker: { size: 6, opacity: 0.7 },
    };
    const trace = config.group
      ? { ...base, x: catValues(dataset.rows, config.group), y: dataset.rows.map((r) => r[config.y]) }
      : { ...base, y: numericVector(dataset.rows, config.y), name: config.y };
    return {
      traces: [trace],
      layout: {
        xaxis: { title: { text: config.group || "" } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: false,
      },
      reading: {
        ...groupReading(dataset, config, "box"),
        notes: ["Cada punto es una observación; el jitter horizontal evita el solapamiento. Útil con muestras pequeñas, donde la caja puede engañar."],
      },
    };
  },
};

/* --------------------------- Barras / Frecuencias ---------------------- */
const categoryValueRoles = [
  { key: "category", label: "Categoría", accepts: ["categorical"], required: true,
    hint: "Variable categórica que define las barras." },
  { key: "value", label: "Valor (opcional)", accepts: ["numeric"], required: false,
    hint: "Métrica a representar; si se omite, se cuentan los casos." },
];

/** Obtiene pares {label, value} a partir de categoría y (opcional) valor. */
function categoryPairs(dataset, config) {
  if (config.value) {
    const agg = groupBy(dataset.rows, config.category, config.value, "sum");
    return agg.map((g) => ({ label: g.group, value: g.value }));
  }
  return frequencyTable(catValues(dataset.rows, config.category)).map((f) => ({
    label: f.value,
    value: f.count,
  }));
}

const barsSimple = {
  roles: categoryValueRoles,
  build(dataset, config) {
    const pairs = categoryPairs(dataset, config).sort((a, b) => b.value - a.value);
    return {
      traces: [{ type: "bar", x: pairs.map((p) => p.label), y: pairs.map((p) => p.value),
        hovertemplate: "%{x}<br>%{y}<extra></extra>" }],
      layout: {
        xaxis: { title: { text: config.category } },
        yaxis: { title: { text: config.value ? label(dataset, config.value) : "Frecuencia" } },
        showlegend: false,
      },
      reading: {
        lead: `“${pairs[0]?.label}” es la categoría con mayor ${config.value ? "valor" : "frecuencia"} (${num(pairs[0]?.value)}), seguida de “${pairs[1]?.label}”.`,
        stats: pairs.slice(0, 6).map((p) => ({ k: p.label, v: num(p.value) })),
        notes: ["Las barras se ordenan de mayor a menor para facilitar la comparación."],
        cautions: [],
      },
    };
  },
};

const frequencies = {
  roles: categoryValueRoles,
  build(dataset, config) {
    const pairs = categoryPairs(dataset, config).sort((a, b) => b.value - a.value);
    const total = pairs.reduce((a, p) => a + p.value, 0) || 1;
    return {
      traces: [{ type: "bar", x: pairs.map((p) => p.label),
        y: pairs.map((p) => (p.value / total) * 100),
        hovertemplate: "%{x}<br>%{y:.1f}%<extra></extra>" }],
      layout: {
        xaxis: { title: { text: config.category } },
        yaxis: { title: { text: "Frecuencia relativa (%)" } },
        showlegend: false,
      },
      reading: {
        lead: `“${pairs[0]?.label}” concentra el ${num((pairs[0]?.value / total) * 100, 1)} % de los casos de “${config.category}”.`,
        stats: pairs.slice(0, 6).map((p) => ({ k: p.label, v: `${num((p.value / total) * 100, 1)} %` })),
        notes: ["Las frecuencias relativas facilitan comparar distribuciones de tamaños de muestra distintos."],
        cautions: [],
      },
    };
  },
};

const pareto = {
  roles: categoryValueRoles,
  build(dataset, config) {
    const pairs = categoryPairs(dataset, config).sort((a, b) => b.value - a.value);
    const total = pairs.reduce((a, p) => a + p.value, 0) || 1;
    let acc = 0;
    const cum = pairs.map((p) => ((acc += p.value), (acc / total) * 100));
    const k80 = cum.findIndex((c) => c >= 80) + 1;
    return {
      traces: [
        { type: "bar", x: pairs.map((p) => p.label), y: pairs.map((p) => p.value), name: "Frecuencia" },
        { type: "scatter", mode: "lines+markers", x: pairs.map((p) => p.label), y: cum,
          name: "% acumulado", yaxis: "y2", line: { width: 2 } },
      ],
      layout: {
        xaxis: { title: { text: config.category } },
        yaxis: { title: { text: config.value ? label(dataset, config.value) : "Frecuencia" } },
        yaxis2: { title: { text: "% acumulado" }, overlaying: "y", side: "right", range: [0, 100] },
        showlegend: true,
      },
      reading: {
        lead: `Las primeras ${k80 || pairs.length} categorías acumulan el 80 % del total: ${pairs.slice(0, k80).map((p) => p.label).join(", ") || "—"}.`,
        stats: [{ k: "Categorías", v: num(pairs.length, 0) }, { k: "Para el 80 %", v: num(k80, 0) }],
        notes: ["El principio de Pareto sugiere concentrar esfuerzos en las pocas categorías que explican la mayor parte del total."],
        cautions: [],
      },
    };
  },
};

const dotPlot = {
  roles: categoryValueRoles,
  build(dataset, config) {
    const pairs = categoryPairs(dataset, config).sort((a, b) => a.value - b.value);
    // Tallos como formas horizontales desde 0 hasta el valor.
    const shapes = pairs.map((p) => ({
      type: "line", x0: 0, x1: p.value, y0: p.label, y1: p.label,
      line: { color: "rgba(127,133,150,0.45)", width: 1 },
    }));
    return {
      traces: [{ type: "scatter", mode: "markers", x: pairs.map((p) => p.value),
        y: pairs.map((p) => p.label), marker: { size: 11 },
        hovertemplate: "%{y}<br>%{x}<extra></extra>" }],
      layout: {
        xaxis: { title: { text: config.value ? label(dataset, config.value) : "Frecuencia" }, rangemode: "tozero" },
        yaxis: { title: { text: config.category }, automargin: true },
        shapes,
        showlegend: false,
      },
      reading: {
        lead: `Dot plot de “${config.category}”: cada punto marca el ${config.value ? "valor" : "recuento"} de una categoría, ordenadas de menor a mayor.`,
        stats: pairs.slice(-6).reverse().map((p) => ({ k: p.label, v: num(p.value) })),
        notes: ["Los dot plots evitan la distorsión de área de las barras y son más legibles con muchas categorías."],
        cautions: [],
      },
    };
  },
};

/* ----------------------- Barras agrupadas / apiladas ------------------- */
const twoCategoryRoles = [
  { key: "rowVar", label: "Variable principal", accepts: ["categorical"], required: true,
    hint: "Define el eje de categorías." },
  { key: "colVar", label: "Subgrupo", accepts: ["categorical"], required: true,
    hint: "Cada nivel se dibuja como una serie." },
];

function barsCrossBuild(dataset, config, mode) {
  const ct = contingencyTable(dataset.rows, config.rowVar, config.colVar);
  const traces = ct.cols.map((col, j) => ({
    type: "bar",
    name: col,
    x: ct.rows,
    y: ct.matrix.map((row) => row[j]),
  }));
  const rowTotals = ct.matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const topIdx = rowTotals.indexOf(Math.max(...rowTotals));
  return {
    traces,
    layout: {
      barmode: mode,
      xaxis: { title: { text: config.rowVar } },
      yaxis: { title: { text: "Frecuencia" } },
      showlegend: true,
      legend: { title: { text: config.colVar } },
    },
    reading: {
      lead: `Distribución conjunta de “${config.rowVar}” y “${config.colVar}”. La categoría “${ct.rows[topIdx]}” concentra el mayor número de casos.`,
      stats: ct.rows.map((r, i) => ({ k: r, v: num(rowTotals[i], 0) })),
      notes: [
        mode === "stack"
          ? "Las barras apiladas muestran la composición de cada total; compara proporciones internas."
          : "Las barras agrupadas facilitan comparar cada subgrupo entre categorías.",
        "Para evaluar si las dos variables son independientes, usa una prueba ji-cuadrado (Fase 4).",
      ],
      cautions: [],
    },
  };
}

const barsGrouped = { roles: twoCategoryRoles, build: (d, c) => barsCrossBuild(d, c, "group") };
const barsStacked = { roles: twoCategoryRoles, build: (d, c) => barsCrossBuild(d, c, "stack") };

/* ------------------------------ Exportación ---------------------------- */
export const descriptiveBuilders = {
  histogram,
  "frequency-polygon": frequencyPolygon,
  ogive,
  density,
  boxplot,
  violin,
  strip,
  "bars-simple": barsSimple,
  frequencies,
  pareto,
  "dot-plot": dotPlot,
  "bars-grouped": barsGrouped,
  "bars-stacked": barsStacked,
};
