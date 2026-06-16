/**
 * association-extra.test.mjs — Pruebas de las variantes de asociación.
 * Ejecutar: node tests/association-extra.test.mjs
 */

import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getBuilder, defaultConfig, usesAllNumeric } from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function assert(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

function buildWith(id, key) {
  const dataset = buildDatasetFromExample(getExample(key));
  const { config, missingRequired } = defaultConfig(dataset, id);
  assert(missingRequired.length === 0, `${id}: configuración inicial completa`);
  return { dataset, config, out: getBuilder(id).build(dataset, config) };
}
function check(id, out) {
  assert(Array.isArray(out.traces) && out.traces.length > 0, `${id}: produce trazas`);
  assert(out.reading && typeof out.reading.lead === "string", `${id}: lectura`);
}

/* hexbin: celdas hexagonales coloreadas por conteo */
{
  const { config, out } = buildWith("hexbin", "scatter-cloud");
  check("hexbin", out);
  assert(config.x === "horas_sueno" && config.y === "agotamiento", "hexbin: roles por defecto");
  assert(config.resolucion === 16, "hexbin: resolución por defecto");
  const t = out.traces[0];
  assert(t.marker.symbol === "hexagon", "hexbin: marcador hexagonal");
  assert(t.marker.color.length === t.x.length && t.x.length > 0, "hexbin: una celda por hexágono ocupado");
}

/* correlogram: matriz p×p de círculos */
{
  assert(usesAllNumeric("correlogram"), "correlogram: usa todas las numéricas");
  const { dataset, out } = buildWith("correlogram", "corr-heatmap");
  check("correlogram", out);
  const p = dataset.variables.filter((v) => v.storageType === "numeric").length;
  assert(out.traces[0].x.length === p * p, "correlogram: p×p círculos");
  assert(out.traces[0].marker.cmin === -1 && out.traces[0].marker.cmax === 1, "correlogram: escala de color en [-1, 1]");
}

/* pairplot: SPLOM por grupo (color = departamento) */
{
  const { config, out } = buildWith("pairplot", "multivar");
  check("pairplot", out);
  assert(config.color === "departamento", "pairplot: color por departamento");
  assert(out.traces.length === 3, "pairplot: un SPLOM por departamento");
  assert(out.traces.every((t) => t.type === "splom" && t.dimensions.length === 4), "pairplot: SPLOM de 4 dimensiones");
}

/* scatter-matrix: SPLOM único de todas las numéricas */
{
  const { out } = buildWith("scatter-matrix", "multivar");
  check("scatter-matrix", out);
  assert(out.traces.length === 1 && out.traces[0].type === "splom", "scatter-matrix: un único SPLOM");
  assert(out.traces[0].dimensions.length === 4, "scatter-matrix: 4 dimensiones");
  assert(out.traces[0].showupperhalf === false, "scatter-matrix: solo media matriz");
}

console.log(`\n  Pruebas de variantes de asociación`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
