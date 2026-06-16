/**
 * multivariate-charts.test.mjs — Pruebas de los constructores Multivariado.
 * Ejecutar: node tests/multivariate-charts.test.mjs
 */

import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getBuilder, defaultConfig, usesAllNumeric } from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function assert(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

function buildWith(id) {
  const dataset = buildDatasetFromExample(getExample("multivar"));
  const { config } = defaultConfig(dataset, id);
  return { dataset, config, out: getBuilder(id).build(dataset, config) };
}
function check(id, out) {
  assert(Array.isArray(out.traces) && out.traces.length > 0, `${id}: produce trazas`);
  assert(out.reading && typeof out.reading.lead === "string", `${id}: lectura`);
  assert(Array.isArray(out.reading.stats) && out.reading.stats.length > 0, `${id}: estadísticos`);
}

/* Todos usan todas las numéricas y colorean por defecto por departamento. */
for (const id of ["pca", "biplot", "clustering", "mds", "dendrogram", "tsne"]) {
  assert(usesAllNumeric(id), `${id}: usa todas las numéricas`);
}

/* PCA: 3 grupos coloreados; PC1+PC2 retienen mucha varianza (grupos separados) */
{
  const { config, out } = buildWith("pca");
  check("pca", out);
  assert(config.color === "departamento", "pca: colorea por departamento por defecto");
  assert(out.traces.length === 3, "pca: una traza por departamento");
  const acc = out.reading.stats.find((s) => s.k === "Acumulado");
  assert(parseFloat(acc.v) > 80, `pca: PC1+PC2 retienen >80% (${acc.v})`);
}

/* Biplot: puntos por grupo + flechas (anotaciones) por variable */
{
  const { out } = buildWith("biplot");
  check("biplot", out);
  assert(out.layout.annotations.length === 4, "biplot: una flecha por variable (4)");
}

/* Clustering: k=3 por defecto; recupera ~3 grupos */
{
  const { config, out } = buildWith("clustering");
  check("clustering", out);
  assert(config.k === 3, "clustering: k por defecto 3");
  assert(out.traces.length >= 2, "clustering: separa en grupos");
  assert(out.reading.stats.some((s) => s.k === "Inercia"), "clustering: reporta inercia");
}

/* MDS: 3 grupos; reporta varianza de las dimensiones */
{
  const { out } = buildWith("mds");
  check("mds", out);
  assert(out.traces.length === 3, "mds: una traza por departamento");
  assert(out.reading.stats.some((s) => s.k === "Dim 1"), "mds: reporta dimensión 1");
}

/* Dendrograma: una traza de segmentos; etiquetas = nº de casos */
{
  const { dataset, out } = buildWith("dendrogram");
  check("dendrogram", out);
  assert(out.traces.length === 1, "dendrogram: segmentos en una traza");
  assert(out.layout.xaxis.ticktext.length === dataset.n, "dendrogram: una etiqueta por hoja");
}

/* t-SNE: salida coloreada y finita; parámetros por defecto */
{
  const { config, out } = buildWith("tsne");
  check("tsne", out);
  assert(config.perplexity === 5 && config.iters === 300, "tsne: parámetros por defecto");
  assert(out.traces.length === 3, "tsne: una traza por departamento");
  const allFinite = out.traces.every((t) => t.x.every(Number.isFinite) && t.y.every(Number.isFinite));
  assert(allFinite, "tsne: coordenadas finitas");
}

console.log(`\n  Pruebas de constructores Multivariado`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
