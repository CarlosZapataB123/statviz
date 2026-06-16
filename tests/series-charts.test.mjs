/**
 * series-charts.test.mjs — Pruebas de los constructores de Series temporales.
 * Ejecutar: node tests/series-charts.test.mjs
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

/* line */
{
  const { config, out } = buildWith("line", "line");
  check("line", out);
  assert(config.time === "semana" && config.value === "estres", "line: ejes");
  assert(out.traces[0].x.length === 12, "line: 12 puntos ordenados");
}

/* area */
{
  const { out } = buildWith("area", "line");
  check("area", out);
  assert(out.traces[0].fill === "tozeroy", "area: relleno al eje");
}

/* multiline: 3 series */
{
  const { out } = buildWith("multiline", "timeseries-multi");
  check("multiline", out);
  assert(out.traces.length === 3, "multiline: 3 series");
}

/* area-stacked: stackgroup */
{
  const { out } = buildWith("area-stacked", "timeseries-multi");
  check("area-stacked", out);
  assert(out.traces.every((t) => t.stackgroup === "one"), "area-stacked: apiladas");
}

/* streamgraph: baseline + 3 bandas */
{
  const { out } = buildWith("streamgraph", "timeseries-multi");
  check("streamgraph", out);
  assert(out.traces.length === 4, "streamgraph: baseline + 3 bandas");
  assert(out.traces.slice(1).every((t) => t.fill === "tonexty"), "streamgraph: bandas con relleno apilado");
}

/* horizon: 4 trazas con color */
{
  const { out } = buildWith("horizon", "seasonal-series");
  check("horizon", out);
  assert(out.traces.length === 4, "horizon: 2 bandas × 2 sentidos");
  assert(out.traces.every((t) => typeof t.fillcolor === "string"), "horizon: colores de banda");
}

/* seasonal: 2 ciclos (24 meses, periodo 12), parámetro periodo */
{
  const { config, out } = buildWith("seasonal", "seasonal-series");
  check("seasonal", out);
  assert(config.period === 12, "seasonal: periodo por defecto 12");
  assert(out.traces.length === 2, "seasonal: 2 ciclos superpuestos");
}

/* lag: parámetro k; pares = n-1 */
{
  const { config, out } = buildWith("lag", "seasonal-series");
  check("lag", out);
  assert(config.k === 1, "lag: retardo por defecto 1");
  assert(out.traces[0].x.length === 23, "lag: 23 pares (n-1)");
}

/* acf: bandas de significación; detecta autocorrelación estacional (lag 12) */
{
  const { dataset, out } = buildWith("acf", "seasonal-series");
  check("acf", out);
  assert(out.layout.shapes.length === 2, "acf: bandas de significación");
  const n = dataset.n;
  const bound = 1.96 / Math.sqrt(n);
  const x = out.traces[0].x;
  const y = out.traces[0].y;
  const i12 = x.indexOf(12);
  assert(i12 >= 0 && Math.abs(y[i12]) > bound, "acf: autocorrelación significativa en el retardo 12 (estacionalidad)");
}

console.log(`\n  Pruebas de constructores de Series`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
