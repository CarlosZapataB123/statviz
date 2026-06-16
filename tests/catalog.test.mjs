/**
 * catalog.test.mjs — Integridad y completitud del catálogo (Fase 8).
 *
 * Garantiza que los 71 gráficos están realmente implementados: cada uno tiene
 * metadatos válidos, un constructor, y se dibuja —con su dataset de ejemplo o,
 * si es un gráfico sin datos, desde sus parámetros— produciendo trazas y una
 * lectura. Es la red de seguridad que respalda la promesa "71 de 71".
 *
 * Ejecutar: node tests/catalog.test.mjs
 */

import { CHARTS, CATEGORIES, TOTAL_CHARTS, implementedCount, getCategory } from "../js/charts/registry.js";
import { hasExample, getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getBuilder, defaultConfig, isDataless } from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* Recuentos globales */
ok(CHARTS.length === 71, "el catálogo tiene 71 gráficos");
ok(TOTAL_CHARTS === 71, "TOTAL_CHARTS es 71");
ok(implementedCount() === 71, "implementedCount() es 71");

/* Identificadores únicos */
{
  const idSet = new Set(CHARTS.map((c) => c.id));
  ok(idSet.size === CHARTS.length, "todos los identificadores de gráfico son únicos");
}

/* Cada categoría declarada en un gráfico existe en CATEGORIES */
{
  const catIds = new Set(CATEGORIES.map((c) => c.id));
  const orphan = CHARTS.filter((c) => !catIds.has(c.category)).map((c) => c.id);
  ok(orphan.length === 0, `toda categoría referenciada existe (huérfanos: ${orphan.join(", ") || "ninguno"})`);
}

const emptyDS = { name: "(sin datos)", variables: [], rows: [], n: 0 };

/* Cada gráfico: metadatos, constructor y render efectivo */
let renderable = 0;
for (const c of CHARTS) {
  ok(typeof c.name === "string" && c.name.length > 0, `${c.id}: tiene nombre`);
  ok(Boolean(getCategory(c.category)), `${c.id}: categoría resoluble`);
  const builder = getBuilder(c.id);
  ok(typeof builder?.build === "function", `${c.id}: tiene constructor`);
  if (!builder) continue;

  let ds;
  if (isDataless(c.id)) {
    ds = emptyDS;
  } else {
    if (!hasExample(c.exampleKey)) { failed += 1; failures.push(`${c.id}: sin dataset de ejemplo (${c.exampleKey})`); continue; }
    ds = buildDatasetFromExample(getExample(c.exampleKey));
  }

  const { config } = defaultConfig(ds, c.id);
  try {
    const out = builder.build(ds, config);
    const traces = (out.traces || []).length;
    const hasLead = Boolean(out.reading && out.reading.lead);
    ok(traces > 0, `${c.id}: produce al menos una traza`);
    ok(hasLead, `${c.id}: produce una lectura`);
    if (traces > 0 && hasLead) renderable += 1;
  } catch (e) {
    failed += 1; failures.push(`${c.id}: build lanzó «${e.message}»`);
  }
}
ok(renderable === 71, `los 71 gráficos se dibujan con datos reales (logrado: ${renderable})`);

console.log(`\n  Integridad del catálogo`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
