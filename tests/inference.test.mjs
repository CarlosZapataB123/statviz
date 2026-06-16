/**
 * inference.test.mjs — Pruebas de los constructores de Inferencia.
 * Ejecutar: node tests/inference.test.mjs
 */

import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getBuilder, defaultConfig } from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function assert(cond, msg) { if (cond) passed += 1; else { failed += 1; failures.push(msg); } }

function buildWith(id, exampleKey) {
  const dataset = buildDatasetFromExample(getExample(exampleKey));
  const { config, missingRequired } = defaultConfig(dataset, id);
  assert(missingRequired.length === 0, `${id}: configuración inicial completa`);
  return { dataset, config, out: getBuilder(id).build(dataset, config) };
}
function check(id, out) {
  assert(Array.isArray(out.traces) && out.traces.length > 0, `${id}: produce trazas`);
  assert(out.reading && typeof out.reading.lead === "string", `${id}: lectura`);
  assert(Array.isArray(out.reading.stats) && out.reading.stats.length > 0, `${id}: estadísticos`);
}

/* conf-interval con agrupación */
{
  const { config, out } = buildWith("conf-interval", "boxplot");
  check("conf-interval", out);
  assert(config.y === "agotamiento" && config.group === "departamento", "conf-interval: variables");
  assert(out.traces[0].error_y && out.traces[0].error_y.array.length === 3, "conf-interval: barras de error por grupo");
}

/* forest: estudios + diamante combinado (2 trazas) */
{
  const { config, out } = buildWith("forest", "meta");
  check("forest", out);
  assert(config.estimate === "efecto" && config.lower === "ic_inf" && config.upper === "ic_sup", "forest: roles");
  assert(out.traces.length === 2, "forest: estudios + combinado");
  const pooled = out.reading.stats.find((s) => s.k === "Efecto global");
  assert(pooled && parseFloat(pooled.v.replace(",", ".")) > 0.3 && parseFloat(pooled.v.replace(",", ".")) < 0.55, "forest: efecto combinado plausible");
}

/* funnel: estudios + 2 líneas de embudo */
{
  const { out } = buildWith("funnel", "meta");
  check("funnel", out);
  assert(out.traces.length === 3, "funnel: puntos + dos límites");
  assert(out.layout.yaxis.autorange === "reversed", "funnel: eje EE invertido");
}

/* volcano: tres categorías + parámetros */
{
  const { config, out } = buildWith("volcano", "diffexp");
  check("volcano", out);
  assert(config.alpha === 0.05 && config.effMin === 0.5, "volcano: parámetros por defecto");
  assert(out.traces.length === 3, "volcano: ns / up / down");
  assert(out.layout.shapes.length === 3, "volcano: líneas de umbral");
  // Con los datos del ejemplo hay significativas en ambos sentidos.
  const up = out.reading.stats.find((s) => s.k === "↑ significativas");
  assert(up && Number(up.v) >= 1, "volcano: detecta significativas positivas");
}

/* ROC: AUC alto y plausible */
{
  const { config, out } = buildWith("roc", "classifier");
  check("roc", out);
  const auc = out.reading.stats.find((s) => s.k === "AUC");
  const v = parseFloat(auc.v.replace(",", "."));
  assert(v > 0.7 && v <= 1, `ROC: AUC plausible (${auc.v})`);
  assert(out.layout.shapes.length === 1, "ROC: diagonal de referencia");
}

/* PR: AP y línea base de prevalencia */
{
  const { out } = buildWith("pr-curve", "classifier");
  check("pr-curve", out);
  const ap = out.reading.stats.find((s) => s.k === "AP");
  assert(ap && parseFloat(ap.v.replace(",", ".")) > 0.6, "PR: AP plausible");
}

console.log(`\n  Pruebas de constructores de Inferencia`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
