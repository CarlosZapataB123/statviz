/**
 * regression-charts.test.mjs — Pruebas de los constructores de Regresión.
 * Ejecutar: node tests/regression-charts.test.mjs
 */

import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getBuilder, defaultConfig } from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function assert(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

function buildWith(id, exampleKey) {
  const dataset = buildDatasetFromExample(getExample(exampleKey));
  const { config, missingRequired } = defaultConfig(dataset, id);
  assert(missingRequired.length === 0, `${id}: configuración inicial completa`);
  return { dataset, config, out: getBuilder(id).build(dataset, config) };
}
function check(id, out) {
  assert(Array.isArray(out.traces) && out.traces.length > 0, `${id}: produce trazas`);
  assert(out.reading && typeof out.reading.lead === "string", `${id}: lectura`);
}

/* linear-reg: banda + recta + puntos; pendiente negativa en sueño~agotamiento */
{
  const { out } = buildWith("linear-reg", "scatter");
  check("linear-reg", out);
  assert(out.traces.length === 4, "linear-reg: banda(2) + recta + puntos");
  const slope = out.reading.stats.find((s) => s.k === "Pendiente");
  assert(slope && slope.v.startsWith("-"), "linear-reg: pendiente negativa (más sueño, menos agotamiento)");
  const r2 = out.reading.stats.find((s) => s.k === "R²");
  assert(parseFloat(r2.v.replace(",", ".")) > 0.8, "linear-reg: R² alto");
}

/* multiple-reg: observado vs predicho + identidad; coeficientes por predictor */
{
  const { out } = buildWith("multiple-reg", "corr-heatmap");
  check("multiple-reg", out);
  assert(out.traces.length === 2, "multiple-reg: casos + identidad");
  assert(out.reading.stats.some((s) => s.k === "R² ajustado"), "multiple-reg: reporta R² ajustado");
  // Debe incluir coeficientes de varios predictores (≥3 además de R², R² aj, F).
  assert(out.reading.stats.length >= 6, "multiple-reg: tabla de coeficientes");
}

/* fitted-curves: lineal + polinómico, parámetro grado */
{
  const { config, out } = buildWith("fitted-curves", "scatter");
  check("fitted-curves", out);
  assert(config.grado === 3, "fitted-curves: grado por defecto 3");
  assert(out.traces.length === 3, "fitted-curves: puntos + lineal + polinómico");
}

/* residuals: nube + línea cero */
{
  const { out } = buildWith("residuals", "scatter");
  check("residuals", out);
  assert(out.layout.shapes.length === 1, "residuals: línea de cero");
}

/* influence: burbujas por Cook + umbrales */
{
  const { out } = buildWith("influence", "scatter");
  check("influence", out);
  assert(out.traces[0].marker.sizemode === "area", "influence: tamaño = Cook (área)");
  assert(out.layout.shapes.length === 3, "influence: umbrales de apalancamiento y residuo");
}

/* leverage: barras + umbral 2p/n */
{
  const { out } = buildWith("leverage", "scatter");
  check("leverage", out);
  assert(out.traces[0].type === "bar", "leverage: barras por observación");
  assert(out.layout.shapes.length === 1, "leverage: línea de umbral");
}

/* reg-diagnostics: Q–Q con referencia; cuantiles teóricos = n */
{
  const { dataset, out } = buildWith("reg-diagnostics", "scatter");
  check("reg-diagnostics", out);
  assert(out.traces.length === 2, "reg-diagnostics: residuos + referencia");
  assert(out.traces[0].x.length === dataset.n, "reg-diagnostics: un cuantil por observación");
}

console.log(`\n  Pruebas de constructores de Regresión`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
