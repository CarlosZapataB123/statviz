/**
 * networks.test.mjs — Pruebas del motor de redes.
 * Ejecutar: node tests/networks.test.mjs
 */

import { circleLayout, forceLayout, correlationEdges } from "../js/stats/networks.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, m, tol = 1e-6) { if (Math.abs(a - b) <= tol) passed += 1; else { failed += 1; failures.push(`${m} — ${a} ≠ ${b}`); } }
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* circleLayout: n puntos sobre la circunferencia unidad */
{
  const p = circleLayout(6, 1);
  ok(p.length === 6, "circleLayout: 6 puntos");
  ok(p.every((q) => Math.abs(Math.hypot(q.x, q.y) - 1) < 1e-9), "circleLayout: radio unidad");
}

/* forceLayout: finito, reproducible, centrado y normalizado */
{
  const edges = [
    { source: 0, target: 1 }, { source: 1, target: 2 }, { source: 0, target: 2 }, // triángulo
    { source: 3, target: 4 }, { source: 4, target: 5 }, { source: 3, target: 5 }, // otro triángulo
  ];
  const a = forceLayout(6, edges, { seed: 5, iters: 200 });
  const b = forceLayout(6, edges, { seed: 5, iters: 200 });
  ok(a.length === 6 && a.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), "forceLayout: posiciones finitas");
  ok(JSON.stringify(a) === JSON.stringify(b), "forceLayout: reproducible con la misma semilla");
  const cx = a.reduce((s, p) => s + p.x, 0) / 6;
  const cy = a.reduce((s, p) => s + p.y, 0) / 6;
  near(cx, 0, "forceLayout: centrado en x", 1e-9);
  near(cy, 0, "forceLayout: centrado en y", 1e-9);
  ok(Math.max(...a.map((p) => Math.hypot(p.x, p.y))) <= 1 + 1e-9, "forceLayout: normalizado a radio ≤ 1");

  // Los nodos conectados de un triángulo quedan más cerca entre sí que de los del otro.
  const d01 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  const d03 = Math.hypot(a[0].x - a[3].x, a[0].y - a[3].y);
  ok(d01 < d03, "forceLayout: conectados más próximos que no conectados");
}

/* correlationEdges: filtra por umbral conservando el signo */
{
  const C = [
    [1.0, 0.9, 0.1],
    [0.9, 1.0, -0.6],
    [0.1, -0.6, 1.0],
  ];
  const e = correlationEdges(C, 0.5);
  ok(e.length === 2, "correlationEdges: 2 aristas con |r|≥0.5");
  ok(e.some((x) => x.source === 1 && x.target === 2 && x.r < 0), "correlationEdges: conserva el signo negativo");
  ok(!e.some((x) => Math.abs(x.r) < 0.5), "correlationEdges: descarta correlaciones débiles");
}

console.log(`\n  Pruebas del motor de redes`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
