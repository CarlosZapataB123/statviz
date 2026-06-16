/**
 * redes-charts.test.mjs — Pruebas de los constructores de Redes.
 * Ejecutar: node tests/redes-charts.test.mjs
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
const nodeTraces = (out) => out.traces.filter((t) => t.mode === "markers+text");
const lineTraces = (out) => out.traces.filter((t) => t.mode === "lines");

/* network: grafo bipartito (2 grupos de nodos + aristas) */
{
  const { config, out } = buildWith("network", "crosstab");
  check("network", out);
  assert(config.source === "genero" && config.target === "nivel_bienestar", "network: roles por defecto");
  assert(nodeTraces(out).length === 2, "network: dos grupos de nodos");
  assert(lineTraces(out).length >= 1, "network: al menos una arista");
}

/* force-directed: mismas cuentas, disposición distinta */
{
  const { out } = buildWith("force-directed", "crosstab");
  check("force-directed", out);
  assert(nodeTraces(out).length === 2, "force-directed: dos grupos de nodos");
  assert(out.traces.every((t) => t.x.every((v) => v === null || Number.isFinite(v))), "force-directed: coordenadas finitas");
}

/* sankey: trazo nativo con enlaces consistentes */
{
  const { out } = buildWith("sankey", "crosstab");
  check("sankey", out);
  const s = out.traces[0];
  assert(s.type === "sankey", "sankey: tipo de trazo");
  assert(s.link.source.length === s.link.value.length && s.link.target.length === s.link.value.length, "sankey: enlaces consistentes");
  assert(s.node.label.length === 6, "sankey: 6 nodos (3 + 3 categorías)");
}

/* chord: conectores curvos + nodos */
{
  const { out } = buildWith("chord", "crosstab");
  check("chord", out);
  assert(nodeTraces(out).length === 2, "chord: dos grupos de nodos");
  const links = lineTraces(out);
  assert(links.length >= 1, "chord: al menos un conector");
  assert(links[0].x.length === 27, "chord: conector muestreado en 27 puntos (Bézier)");
}

/* assoc-network: red de correlación entre las 5 variables numéricas */
{
  assert(usesAllNumeric("assoc-network"), "assoc-network: usa todas las numéricas");
  const { config, out } = buildWith("assoc-network", "corr-heatmap");
  check("assoc-network", out);
  assert(config.threshold === 0.5, "assoc-network: umbral por defecto 0.5");
  const nodes = nodeTraces(out);
  assert(nodes.length === 1 && nodes[0].text.length === 5, "assoc-network: 5 variables como nodos");
  assert(lineTraces(out).length >= 1, "assoc-network: al menos una correlación fuerte");
}

console.log(`\n  Pruebas de constructores de Redes`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
