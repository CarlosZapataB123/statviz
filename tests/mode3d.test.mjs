/**
 * mode3d.test.mjs — Pruebas del modo 3D (Fase 5).
 * Ejecutar: node tests/mode3d.test.mjs
 */

import { forceLayout3d } from "../js/stats/networks.js";
import { getExample } from "../js/data/examples.js";
import { buildDatasetFromExample } from "../js/data/dataset.js";
import { getChart, CHARTS } from "../js/charts/registry.js";
import { getBuilder, defaultConfig } from "../js/charts/builders.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, m, tol = 1e-9) { if (Math.abs(a - b) <= tol) passed += 1; else { failed += 1; failures.push(`${m} — ${a} ≠ ${b}`); } }
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

const is3dTrace = (t) => t.type === "scatter3d" || t.type === "surface";

/* forceLayout3d: finito, reproducible, centrado, normalizado */
{
  const edges = [{ source: 0, target: 1 }, { source: 1, target: 2 }, { source: 3, target: 4 }, { source: 4, target: 5 }];
  const a = forceLayout3d(6, edges, { seed: 4, iters: 150 });
  const b = forceLayout3d(6, edges, { seed: 4, iters: 150 });
  ok(a.length === 6 && a.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)), "forceLayout3d: posiciones finitas");
  ok(JSON.stringify(a) === JSON.stringify(b), "forceLayout3d: reproducible con la misma semilla");
  near(a.reduce((s, p) => s + p.x, 0) / 6, 0, "forceLayout3d: centrado en x");
  ok(Math.max(...a.map((p) => Math.hypot(p.x, p.y, p.z))) <= 1 + 1e-9, "forceLayout3d: normalizado a radio ≤ 1");
}

/* Todos los gráficos con supports3D deben tener build3d */
{
  const threeD = CHARTS.filter((c) => c.supports3D);
  ok(threeD.length === 10, "registro: 10 gráficos declaran soporte 3D");
  for (const c of threeD) {
    ok(typeof getBuilder(c.id).build3d === "function", `${c.id}: tiene build3d`);
  }
}

/* build3d produce trazas 3D + escena, con su ejemplo */
function check3d(id, key) {
  const dataset = buildDatasetFromExample(getExample(key));
  const { config } = defaultConfig(dataset, id);
  const out = getBuilder(id).build3d(dataset, config);
  ok(out.traces.some(is3dTrace), `${id}: produce traza 3D (scatter3d/surface)`);
  ok(out.layout && out.layout.scene, `${id}: define escena 3D`);
  ok(out.reading && typeof out.reading.lead === "string", `${id}: lectura 3D`);
}

check3d("pca", "multivar");
check3d("clustering", "multivar");
check3d("mds", "multivar");
check3d("tsne", "multivar");
check3d("umap", "multivar");
check3d("multiple-reg", "corr-heatmap");
check3d("network", "crosstab");
check3d("force-directed", "crosstab");
check3d("bubble", "bubble");

/* scatter: 3D real con ≥3 numéricas; aviso con solo 2 */
{
  const multi = buildDatasetFromExample(getExample("multivar")); // 4 numéricas
  const { config } = defaultConfig(multi, "scatter");
  const out = getBuilder("scatter").build3d(multi, config);
  ok(out.traces.some(is3dTrace), "scatter: 3D con ≥3 variables numéricas");

  const flat = buildDatasetFromExample(getExample("scatter")); // 2 numéricas
  const { config: c2 } = defaultConfig(flat, "scatter");
  const note = getBuilder("scatter").build3d(flat, c2);
  ok(!note.traces.some(is3dTrace) && note.layout.annotations, "scatter: aviso cuando faltan dimensiones");
}

console.log(`\n  Pruebas del modo 3D`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
