/**
 * umap.test.mjs — Pruebas del motor UMAP.
 * Ejecutar: node tests/umap.test.mjs
 */

import { umap, fitAB, fuzzySimplicialSet } from "../js/stats/umap.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* fitAB: devuelve a, b positivos para los valores por defecto */
{
  const { a, b } = fitAB(0.1, 1.0);
  ok(a > 0 && b > 0, `fitAB: a,b positivos (a=${a.toFixed(2)}, b=${b.toFixed(2)})`);
}

/* fuzzySimplicialSet: matriz simétrica con pesos en [0, 1] */
{
  const M = [[0, 0], [0.1, 0], [5, 5], [5.1, 5]];
  const D = M.map((p) => M.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
  const { W } = fuzzySimplicialSet(D, 2);
  let symmetric = true;
  let inRange = true;
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) {
    if (Math.abs(W[i][j] - W[j][i]) > 1e-9) symmetric = false;
    if (W[i][j] < -1e-9 || W[i][j] > 1 + 1e-9) inRange = false;
  }
  ok(symmetric, "fuzzySimplicialSet: matriz simétrica");
  ok(inRange, "fuzzySimplicialSet: pesos en [0, 1]");
  ok(W[0][1] > W[0][2], "fuzzySimplicialSet: vecino cercano pesa más que uno lejano");
}

/* umap: salida n×2 finita, reproducible y que separa dos cúmulos */
{
  const M = [];
  for (let i = 0; i < 12; i += 1) M.push([Math.cos(i) * 0.3, Math.sin(i) * 0.3, 0]);
  for (let i = 0; i < 12; i += 1) M.push([8 + Math.cos(i) * 0.3, 8 + Math.sin(i) * 0.3, 8]);

  const A = umap(M, { seed: 3, nEpochs: 200, nNeighbors: 6 });
  const B = umap(M, { seed: 3, nEpochs: 200, nNeighbors: 6 });
  ok(A.length === 24 && A[0].length === 2, "umap: salida n×2");
  ok(A.every((p) => p.every(Number.isFinite)), "umap: coordenadas finitas");
  ok(JSON.stringify(A) === JSON.stringify(B), "umap: reproducible con la misma semilla");

  const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  const c1 = centroid(A.slice(0, 12));
  const c2 = centroid(A.slice(12));
  const between = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]);
  const within = A.slice(0, 12).reduce((s, p) => s + Math.hypot(p[0] - c1[0], p[1] - c1[1]), 0) / 12;
  ok(between > within * 2, "umap: separa los dos cúmulos (distancia entre centros ≫ dispersión interna)");
}

console.log(`\n  Pruebas del motor UMAP`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
