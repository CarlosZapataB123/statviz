/**
 * builders.test.mjs — Pruebas de los constructores de gráficos (Fase 3).
 *
 * Ejecutar con: node tests/builders.test.mjs
 * Validan que cada constructor produce trazas y una lectura coherente a partir
 * de su dataset de ejemplo, sin necesitar Plotly ni el DOM. Se omite
 * corr-heatmap porque su construcción lee tokens CSS del navegador.
 */

import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import {
  getBuilder,
  getRoles,
  defaultConfig,
  canRender,
  hasBuilder,
} from "../js/charts/builders.js";

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) passed += 1;
  else {
    failed += 1;
    failures.push(msg);
  }
}

/** Construye un gráfico con su ejemplo y devuelve { dataset, config, out }. */
function buildWith(chartId, exampleKey) {
  const dataset = buildDatasetFromExample(getExample(exampleKey));
  const { config, missingRequired } = defaultConfig(dataset, chartId);
  assert(missingRequired.length === 0, `${chartId}: configuración inicial completa`);
  const out = getBuilder(chartId).build(dataset, config);
  return { dataset, config, out };
}

/** Comprobaciones comunes de salida de un constructor. */
function checkOutput(chartId, out) {
  assert(Array.isArray(out.traces) && out.traces.length > 0, `${chartId}: produce trazas`);
  assert(out.traces.every((t) => typeof t.type === "string"), `${chartId}: trazas con tipo`);
  assert(out.reading && typeof out.reading.lead === "string" && out.reading.lead.length > 0,
    `${chartId}: lectura con enunciado`);
  assert(Array.isArray(out.reading.stats), `${chartId}: lectura con estadísticos`);
}

/* --- Descriptiva ------------------------------------------------------- */

// Histograma: bandas + curva normal de referencia.
{
  const { out } = buildWith("histogram", "histogram");
  checkOutput("histogram", out);
  assert(out.traces.length === 2, "histogram: barras + curva normal");
  assert(out.traces[0].type === "bar", "histogram: primera traza de barras");
  const sumF = out.traces[0].y.reduce((a, b) => a + b, 0);
  assert(sumF === 32, "histogram: la frecuencia total iguala n=32");
}

// Polígono de frecuencias y ojiva (misma forma univariada).
checkOutput("frequency-polygon", buildWith("frequency-polygon", "histogram").out);
{
  const { out } = buildWith("ogive", "histogram");
  checkOutput("ogive", out);
  const y = out.traces[0].y;
  assert(Math.abs(y[y.length - 1] - 100) < 1e-6, "ogive: acumulada llega a 100%");
}

// Densidad (KDE).
checkOutput("density", buildWith("density", "histogram").out);

// Caja, violín y strip con agrupación.
{
  const { config, out } = buildWith("boxplot", "boxplot");
  checkOutput("boxplot", out);
  assert(config.y === "agotamiento" && config.group === "departamento",
    "boxplot: asigna numérica y grupo correctos");
  assert(out.traces[0].type === "box", "boxplot: traza de caja");
}
checkOutput("violin", buildWith("violin", "boxplot").out);
checkOutput("strip", buildWith("strip", "boxplot").out);

// Barras simples, frecuencias, pareto, dot-plot (categoría + valor).
{
  const { out } = buildWith("bars-simple", "bars-simple");
  checkOutput("bars-simple", out);
  // Ordenadas de mayor a menor.
  const ys = out.traces[0].y;
  assert(ys.every((v, i) => i === 0 || ys[i - 1] >= v), "bars-simple: orden descendente");
}
checkOutput("frequencies", buildWith("frequencies", "bars-simple").out);
{
  const { out } = buildWith("pareto", "bars-simple");
  checkOutput("pareto", out);
  assert(out.traces.length === 2 && out.traces[1].yaxis === "y2",
    "pareto: curva acumulada en eje secundario");
}
checkOutput("dot-plot", buildWith("dot-plot", "bars-simple").out);

// Barras agrupadas y apiladas (dos categóricas).
{
  const { out } = buildWith("bars-grouped", "crosstab");
  checkOutput("bars-grouped", out);
  assert(out.layout.barmode === "group", "bars-grouped: barmode group");
}
{
  const { out } = buildWith("bars-stacked", "crosstab");
  assert(out.layout.barmode === "stack", "bars-stacked: barmode stack");
}

/* --- Asociación -------------------------------------------------------- */

// Dispersión: nube + recta, con r de Pearson en la lectura.
{
  const { config, out } = buildWith("scatter", "scatter");
  checkOutput("scatter", out);
  assert(config.x !== config.y, "scatter: ejes con variables distintas");
  assert(out.traces.length === 2, "scatter: puntos + ajuste lineal");
  const hasR = out.reading.stats.some((s) => s.k.includes("Pearson"));
  assert(hasR, "scatter: la lectura incluye Pearson r");
}

// Burbujas: tres variables, tamaño por área.
{
  const { config, out } = buildWith("bubble", "bubble");
  checkOutput("bubble", out);
  assert(config.size && config.size !== config.x && config.size !== config.y,
    "bubble: asigna tercera variable al tamaño");
  assert(out.traces[0].marker.sizemode === "area", "bubble: tamaño por área");
}

/* --- API de builders --------------------------------------------------- */
assert(hasBuilder("histogram") && !hasBuilder("__no-existe__"), "hasBuilder distingue implementados");
assert(getRoles("scatter").length === 3, "getRoles devuelve los roles de scatter (x, y, z opcional)");
{
  const ds = buildDatasetFromExample(getExample("corr-heatmap"));
  assert(canRender(ds, "corr-heatmap"), "canRender acepta corr-heatmap con ≥2 numéricas");
  assert(getRoles("corr-heatmap").length === 0, "corr-heatmap no expone roles (usa todas)");
}

/* --- Reporte ----------------------------------------------------------- */
console.log(`\n  Pruebas de constructores de gráficos`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed > 0) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
} else {
  console.log("  ✓ Todo correcto\n");
}
