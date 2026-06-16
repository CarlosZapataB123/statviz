/**
 * multivariate.test.mjs — Pruebas del motor multivariado.
 * Ejecutar: node tests/multivariate.test.mjs
 */

import {
  jacobiEigen, pca, kmeans, classicalMDS, distanceMatrix, hclust, tsne,
} from "../js/stats/multivariate.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, m, tol = 1e-3) { if (Math.abs(a - b) <= tol) passed += 1; else { failed += 1; failures.push(`${m} — esperado ≈${b}, obtenido ${a}`); } }
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* Jacobi: [[2,1],[1,2]] → autovalores 3 y 1 */
{
  const e = jacobiEigen([[2, 1], [1, 2]]);
  near(e.values[0], 3, "Jacobi autovalor mayor = 3");
  near(e.values[1], 1, "Jacobi autovalor menor = 1");
  // Autovector de 3 ∝ (1,1)
  const v = e.vectors[0];
  near(Math.abs(v[0]), Math.abs(v[1]), "Jacobi autovector (1,1) normalizado");
}

/* PCA: datos dominados por una dirección → PC1 explica casi todo */
{
  // y ≈ 2x con ruido pequeño; tercera variable casi constante.
  const M = [];
  for (let i = 0; i < 20; i += 1) { const x = i - 10; M.push([x, 2 * x + (i % 3) * 0.1, 5 + (i % 2) * 0.05]); }
  const r = pca(M, 2);
  ok(r.explained[0] > 0.6, `PCA: PC1 explica la mayor parte (${r.explained[0].toFixed(2)})`);
  ok(r.scores.length === 20 && r.scores[0].length === 2, "PCA: scores n×2");
  ok(Math.abs(r.explained.reduce((s, v) => s + v, 0) - 1) < 1e-6, "PCA: proporciones suman 1");
}

/* k-medias: dos cúmulos bien separados → recuperados */
{
  const M = [];
  for (let i = 0; i < 10; i += 1) M.push([Math.cos(i) * 0.3, Math.sin(i) * 0.3]); // cerca de (0,0)
  for (let i = 0; i < 10; i += 1) M.push([10 + Math.cos(i) * 0.3, 10 + Math.sin(i) * 0.3]); // cerca de (10,10)
  const r = kmeans(M, 2, { seed: 1 });
  const firstHalf = new Set(r.labels.slice(0, 10));
  const secondHalf = new Set(r.labels.slice(10));
  ok(firstHalf.size === 1 && secondHalf.size === 1 && [...firstHalf][0] !== [...secondHalf][0],
    "k-medias separa los dos cúmulos");
  ok(r.inertia < 5, "k-medias: inercia baja en cúmulos compactos");
}

/* MDS clásico: puntos colineales → 1ª dimensión recupera el orden */
{
  const M = [[0], [1], [2], [3], [4]];
  const D = distanceMatrix(M);
  const { coords } = classicalMDS(D, 2);
  const x = coords.map((c) => c[0]);
  // Monótono (creciente o decreciente).
  const inc = x.every((v, i) => i === 0 || v >= x[i - 1]);
  const dec = x.every((v, i) => i === 0 || v <= x[i - 1]);
  ok(inc || dec, "MDS recupera el orden lineal en la 1ª dimensión");
}

/* hclust: dos pares cercanos + dendrograma */
{
  const M = [[0], [0.1], [10], [10.1]];
  const D = distanceMatrix(M);
  const h = hclust(D);
  ok(h.leafOrder.length === 4, "hclust: 4 hojas");
  ok(h.segments.length === 3, "hclust: 3 uniones (n-1)");
  ok(h.maxHeight > 5, "hclust: la última unión ocurre a gran distancia");
}

/* t-SNE: reproducible y finito; separa dos grupos */
{
  const M = [];
  for (let i = 0; i < 8; i += 1) M.push([Math.cos(i) * 0.2, Math.sin(i) * 0.2, 0]);
  for (let i = 0; i < 8; i += 1) M.push([8 + Math.cos(i) * 0.2, 8 + Math.sin(i) * 0.2, 8]);
  const a = tsne(M, { seed: 7, iters: 150, perplexity: 4 });
  const b = tsne(M, { seed: 7, iters: 150, perplexity: 4 });
  ok(a.length === 16 && a[0].length === 2, "t-SNE: salida n×2");
  ok(a.every((p) => p.every(Number.isFinite)), "t-SNE: coordenadas finitas");
  ok(JSON.stringify(a) === JSON.stringify(b), "t-SNE: reproducible con la misma semilla");
}

console.log(`\n  Pruebas del motor multivariado`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
