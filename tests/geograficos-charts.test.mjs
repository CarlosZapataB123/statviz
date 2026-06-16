/**
 * geograficos-charts.test.mjs — Pruebas de los constructores de Geográficos.
 * Ejecutar: node tests/geograficos-charts.test.mjs
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
  assert(Array.isArray(out.reading.stats) && out.reading.stats.length > 0, `${id}: estadísticos`);
}

/* choropleth */
{
  const { config, out } = buildWith("choropleth", "geo-countries");
  check("choropleth", out);
  assert(config.location === "pais" && config.value === "bienestar", "choropleth: roles por defecto");
  const t = out.traces[0];
  assert(t.type === "choropleth" && t.locationmode === "country names", "choropleth: trazo y modo de localización");
  assert(t.locations.length === 12 && t.z.length === 12, "choropleth: 12 regiones");
  assert(out.layout.geo.scope === "world", "choropleth: mapa mundial");
}

/* bubble-map */
{
  const { config, out } = buildWith("bubble-map", "geo-cities");
  check("bubble-map", out);
  assert(config.lat === "lat" && config.lon === "lon" && config.size === "participantes", "bubble-map: roles por defecto");
  assert(config.label === "ciudad", "bubble-map: etiqueta = ciudad");
  const t = out.traces[0];
  assert(t.type === "scattergeo" && t.lat.length === 10, "bubble-map: 10 ubicaciones");
  assert(t.marker.sizemode === "area", "bubble-map: área proporcional");
}

/* density-map */
{
  const { config, out } = buildWith("density-map", "geo-events");
  check("density-map", out);
  assert(config.lat === "lat" && config.lon === "lon", "density-map: roles por defecto");
  assert(config.radio === 9, "density-map: suavizado por defecto");
  assert(out.traces.length === 2, "density-map: rejilla + puntos crudos");
  assert(out.traces[0].marker.symbol === "square", "density-map: celdas cuadradas");
  assert(out.traces[1].lat.length === 26, "density-map: 26 eventos originales");
  assert(out.traces[0].lat.length > 0 && out.traces[0].lat.length <= 18 * 18, "density-map: celdas activas filtradas");
}

/* heat-map */
{
  const { config, out } = buildWith("heat-map", "geo-events");
  check("heat-map", out);
  assert(config.value === "intensidad", "heat-map: variable interpolada");
  assert(config.potencia === 2, "heat-map: potencia IDW por defecto");
  assert(out.traces.length === 2, "heat-map: superficie + muestras");
  assert(out.traces[0].lat.length === 400, "heat-map: rejilla 20×20");
  assert(out.traces[1].lat.length === 26, "heat-map: 26 muestras");
}

console.log(`\n  Pruebas de constructores de Geográficos`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
