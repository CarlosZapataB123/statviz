/**
 * recommender.test.mjs — Pruebas del recomendador de gráficos.
 * Ejecutar: node tests/recommender.test.mjs
 */

import { recommend, profileFromDataset, GOALS } from "../js/charts/recommender.js";
import { getChart } from "../js/charts/registry.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }
const top = (arr) => (arr[0] ? arr[0].id : null);
const ids = (arr) => arr.map((r) => r.id);

/* profileFromDataset cuenta por tipo */
{
  const ds = { n: 21, variables: [
    { storageType: "categorical" }, { storageType: "numeric" }, { storageType: "numeric" },
    { storageType: "numeric" }, { storageType: "numeric" }, { storageType: "temporal" }, { storageType: "identifier" },
  ] };
  const p = profileFromDataset(ds);
  ok(p.numeric === 4 && p.categorical === 1 && p.temporal === 1, "perfil: recuento por tipo (ignora identificadores)");
}

/* Todos los objetivos producen recomendaciones existentes en modo solo-objetivo */
{
  let allValid = true;
  for (const g of GOALS) {
    const recs = recommend(null, g.id);
    if (recs.length === 0) allValid = false;
    if (recs.some((r) => !getChart(r.id))) allValid = false;
  }
  ok(allValid, "cada objetivo recomienda gráficos válidos del catálogo");
}

/* Comparación de grupos: la caja encabeza */
{
  const p = { numeric: 1, categorical: 1, temporal: 0, n: 60 };
  const recs = recommend(p, "comparacion");
  ok(top(recs) === "boxplot", "comparación: el diagrama de caja es la primera recomendación");
  ok(ids(recs).includes("violin"), "comparación: incluye el violín");
  ok(!ids(recs).includes("scatter"), "comparación: no sugiere dispersión (es de relación)");
}

/* Relación con muchas numéricas: dispersión primero, matrices presentes */
{
  const p = { numeric: 5, categorical: 0, temporal: 0, n: 80 };
  const recs = recommend(p, "relacion");
  ok(top(recs) === "scatter", "relación: la dispersión encabeza");
  ok(ids(recs).includes("scatter-matrix") && ids(recs).includes("correlogram"), "relación: ofrece matrices para varias variables");
}

/* Hexbin gana puntuación con muchos puntos */
{
  const few = recommend({ numeric: 2, categorical: 0, temporal: 0, n: 40 }, "relacion");
  const many = recommend({ numeric: 2, categorical: 0, temporal: 0, n: 5000 }, "relacion");
  const score = (recs, id) => (recs.find((r) => r.id === id) || {}).score;
  ok(score(many, "hexbin") > score(few, "hexbin"), "hexbin gana puntuación cuando hay muchos puntos");
}

/* Evolución exige una variable temporal */
{
  const sinTiempo = recommend({ numeric: 2, categorical: 1, temporal: 0, n: 50 }, "evolucion");
  ok(sinTiempo.length === 0, "evolución: sin variable temporal no recomienda nada");
  const conTiempo = recommend({ numeric: 2, categorical: 0, temporal: 1, n: 50 }, "evolucion");
  ok(top(conTiempo) === "line", "evolución: con tiempo, la línea encabeza");
  ok(ids(conTiempo).includes("multiline"), "evolución: con dos numéricas, ofrece líneas múltiples");
}

/* Estructura exige 3+ numéricas */
{
  const pocas = recommend({ numeric: 2, categorical: 0, temporal: 0, n: 50 }, "estructura");
  ok(pocas.length === 0, "estructura: con menos de 3 numéricas no recomienda");
  const muchas = recommend({ numeric: 4, categorical: 1, temporal: 0, n: 50 }, "estructura");
  ok(top(muchas) === "pca", "estructura: el PCA encabeza");
}

/* Sin objetivo: agrega y deduplica, máximo 10 */
{
  const p = { numeric: 4, categorical: 1, temporal: 1, n: 100 };
  const recs = recommend(p);
  ok(recs.length > 0 && recs.length <= 10, "sin objetivo: devuelve hasta 10 sugerencias");
  ok(new Set(ids(recs)).size === recs.length, "sin objetivo: sin duplicados");
}

console.log(`\n  Pruebas del recomendador`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
