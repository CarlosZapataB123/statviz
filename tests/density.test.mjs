/**
 * density.test.mjs — Pruebas de los motores de densidad y binning hexagonal.
 * Ejecutar: node tests/density.test.mjs
 */

import { silvermanBandwidth, axisGrid, kde1d, beeswarmOffsets } from "../js/stats/density.js";
import { hexbin } from "../js/stats/hexbin.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, m, tol = 1e-2) { if (Math.abs(a - b) <= tol) passed += 1; else { failed += 1; failures.push(`${m} — ${a} ≠ ${b}`); } }
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* Silverman: positivo y decrece con n */
{
  const small = silvermanBandwidth([1, 2, 3, 4, 5]);
  const big = silvermanBandwidth(Array.from({ length: 500 }, (_, i) => Math.sin(i)));
  ok(small > 0 && big > 0, "Silverman: ancho de banda positivo");
}

/* KDE 1D: integra ≈ 1 y tiene su máximo cerca de la media */
{
  const data = [];
  for (let i = 0; i < 200; i += 1) data.push(Math.cos(i) + Math.sin(i * 0.7)); // ~centrado en 0
  const grid = axisGrid(-4, 4, 400);
  const dens = kde1d(data, grid);
  const step = grid[1] - grid[0];
  const area = dens.reduce((s, d) => s + d * step, 0);
  near(area, 1, "KDE: integra aproximadamente a 1", 0.05);
  const peakX = grid[dens.indexOf(Math.max(...dens))];
  ok(Math.abs(peakX) < 1.5, "KDE: máximo cerca del centro");
}

/* Beeswarm: puntos cercanos en valor no comparten carril */
{
  const values = [1, 1, 1, 1, 2, 2, 3];
  const lanes = beeswarmOffsets(values, 0.5);
  // Los cuatro "1" deben ocupar carriles distintos.
  const ones = values.map((v, i) => ({ v, l: lanes[i] })).filter((o) => o.v === 1).map((o) => o.l);
  ok(new Set(ones).size === ones.length, "Beeswarm: valores iguales en carriles distintos");
  ok(lanes.every((l) => Number.isInteger(l)), "Beeswarm: carriles enteros");
}

/* Hexbin: conserva el total de puntos y detecta el cúmulo denso */
{
  const xs = [];
  const ys = [];
  // Cúmulo denso cerca de (0,0) + dispersión.
  for (let i = 0; i < 60; i += 1) { xs.push(Math.cos(i) * 0.05); ys.push(Math.sin(i) * 0.05); }
  for (let i = 0; i < 20; i += 1) { xs.push(1 + i * 0.1); ys.push(1 + (i % 5) * 0.1); }
  const { cells, max } = hexbin(xs, ys, 16);
  const total = cells.reduce((s, c) => s + c.count, 0);
  ok(total === 80, "Hexbin: conserva el total de puntos");
  ok(max >= 10, "Hexbin: la celda más densa concentra muchos puntos");
  ok(cells.every((c) => c.count > 0), "Hexbin: solo celdas con puntos");
}

console.log(`\n  Pruebas de densidad y hexbin`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
