/**
 * umap-charts.test.mjs — Prueba del constructor del gráfico UMAP.
 * Ejecutar: node tests/umap-charts.test.mjs
 */

import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getBuilder, defaultConfig, usesAllNumeric } from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function assert(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

{
  assert(usesAllNumeric("umap"), "umap: usa todas las numéricas");
  const dataset = buildDatasetFromExample(getExample("multivar"));
  const { config, missingRequired } = defaultConfig(dataset, "umap");
  assert(missingRequired.length === 0, "umap: configuración inicial completa");
  assert(config.color === "departamento", "umap: color por departamento por defecto");
  assert(config.vecinos === 8 && config.minDist === 0.1 && config.epocas === 300, "umap: parámetros por defecto");

  const out = getBuilder("umap").build(dataset, config);
  assert(Array.isArray(out.traces) && out.traces.length === 3, "umap: una traza por departamento");
  assert(out.reading && typeof out.reading.lead === "string", "umap: lectura");
  const allFinite = out.traces.every((t) => t.x.every(Number.isFinite) && t.y.every(Number.isFinite));
  assert(allFinite, "umap: coordenadas finitas");
}

console.log(`\n  Prueba del gráfico UMAP`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
