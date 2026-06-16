/**
 * probability.test.mjs — Pruebas de los constructores de Probabilidad.
 * Ejecutar: node tests/probability.test.mjs
 * No requieren navegador (la matemática es del motor; no se invoca Plotly).
 */

import {
  getBuilder,
  getParamRoles,
  isDataless,
  defaultConfig,
} from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) passed += 1;
  else { failed += 1; failures.push(msg); }
}

const EMPTY = { name: "Modelo teórico", source: "modelo", variables: [], rows: [], n: 0 };

function buildDist(id) {
  const { config } = defaultConfig(EMPTY, id);
  // Todos los parámetros quedaron asignados.
  for (const p of getParamRoles(id)) {
    assert(config[p.key] !== undefined, `${id}: parámetro ${p.key} con valor inicial`);
  }
  return getBuilder(id).build(EMPTY, config);
}

function checkOutput(id, out, nTraces) {
  assert(Array.isArray(out.traces) && out.traces.length > 0, `${id}: produce trazas`);
  if (nTraces) assert(out.traces.length === nTraces, `${id}: ${nTraces} trazas`);
  assert(out.traces.every((t) => typeof t.type === "string"), `${id}: trazas con tipo`);
  assert(out.reading && typeof out.reading.lead === "string", `${id}: lectura`);
  assert(Array.isArray(out.reading.stats) && out.reading.stats.length > 0, `${id}: estadísticos`);
}

const CONTINUOUS = ["normal-dist", "exponential-dist", "weibull-dist", "gamma-dist", "beta-dist"];
const DISCRETE = ["binomial-dist", "poisson-dist"];

for (const id of [...CONTINUOUS, ...DISCRETE, "dist-compare"]) {
  assert(isDataless(id), `${id}: es dataless`);
}

// Continuas: densidad + área sombreada (2 trazas) y línea de referencia en k.
for (const id of CONTINUOUS) {
  const out = buildDist(id);
  checkOutput(id, out, 2);
  assert(Array.isArray(out.layout.shapes) && out.layout.shapes.length === 1,
    `${id}: línea de referencia en k`);
  // La lectura incluye P(X ≤ k).
  assert(out.reading.stats.some((s) => s.k.includes("P(X ≤ k)")), `${id}: reporta P(X ≤ k)`);
}

// Discretas: una traza de barras.
for (const id of DISCRETE) {
  const out = buildDist(id);
  checkOutput(id, out, 1);
  assert(out.traces[0].type === "bar", `${id}: barras de masa`);
}

// Binomial: ks de 0..n.
{
  const { config } = defaultConfig(EMPTY, "binomial-dist");
  const out = getBuilder("binomial-dist").build(EMPTY, config);
  assert(out.traces[0].x.length === Math.round(config.n) + 1, "binomial: soporte 0..n");
}

// dist-compare: Normal + dos t (3 trazas).
checkOutput("dist-compare", buildDist("dist-compare"), 3);

// API.
assert(getParamRoles("normal-dist").length === 3, "normal-dist: 3 parámetros");
assert(!isDataless("histogram") && !isDataless("scatter"), "gráficos de datos no son dataless");

console.log(`\n  Pruebas de constructores de Probabilidad`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
