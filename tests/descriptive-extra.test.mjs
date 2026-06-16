/**
 * descriptive-extra.test.mjs — Pruebas de las variantes descriptivas.
 * Ejecutar: node tests/descriptive-extra.test.mjs
 */

import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getBuilder, defaultConfig } from "../js/charts/builders.js";

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

/* bars-diverging: barras horizontales; las desviaciones suman ~0 */
{
  const { config, out } = buildWith("bars-diverging", "groups-dist");
  check("bars-diverging", out);
  assert(config.group === "turno" && config.value === "puntaje", "bars-diverging: roles por defecto");
  const t = out.traces[0];
  assert(t.orientation === "h" && t.y.length === 3, "bars-diverging: 3 grupos horizontales");
  const sum = t.x.reduce((s, v) => s + v, 0);
  assert(Math.abs(sum) < 1e-6, "bars-diverging: desviaciones respecto a la media suman 0");
}

/* stem-leaf: render por anotaciones (título + filas) */
{
  const { out } = buildWith("stem-leaf", "histogram");
  check("stem-leaf", out);
  assert(out.layout.annotations.length >= 2, "stem-leaf: título + filas de tallos");
  assert(out.layout.xaxis.visible === false && out.layout.yaxis.visible === false, "stem-leaf: ejes ocultos");
}

/* ridgeline: una cresta por grupo, rellena */
{
  const { out } = buildWith("ridgeline", "groups-dist");
  check("ridgeline", out);
  assert(out.traces.length === 3, "ridgeline: 3 crestas");
  assert(out.traces.every((t) => t.fill === "toself"), "ridgeline: crestas rellenas");
}

/* beeswarm: un enjambre por grupo */
{
  const { out } = buildWith("beeswarm", "groups-dist");
  check("beeswarm", out);
  assert(out.traces.length === 3, "beeswarm: 3 grupos");
  // Los puntos del primer grupo están dentro de su banda (centro 0 ± 0.4).
  assert(out.traces[0].x.every((v) => Math.abs(v) <= 0.45), "beeswarm: puntos dentro de la banda del grupo");
}

/* raincloud: nube + lluvia por grupo (6 trazas) + cajas (shapes) */
{
  const { out } = buildWith("raincloud", "groups-dist");
  check("raincloud", out);
  assert(out.traces.length === 6, "raincloud: nube + lluvia por cada uno de los 3 grupos");
  assert(out.layout.shapes.length === 12, "raincloud: 4 elementos de caja por grupo");
}

console.log(`\n  Pruebas de variantes descriptivas`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
