/**
 * timeseries.test.mjs — Pruebas de utilidades de series temporales.
 * Ejecutar: node tests/timeseries.test.mjs
 */

import { orderByTime, acf } from "../js/stats/timeseries.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, m, tol = 1e-3) { if (Math.abs(a - b) <= tol) passed += 1; else { failed += 1; failures.push(`${m} — esperado ≈${b}, obtenido ${a}`); } }
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* Ordenación por índice temporal desordenado */
{
  const rows = [{ t: 3, y: 30 }, { t: 1, y: 10 }, { t: 2, y: 20 }];
  const s = orderByTime(rows, "t", "y");
  ok(s.values.join(",") === "10,20,30", "orderByTime ordena por índice");
}

/* ACF: r0 = 1 siempre */
{
  const a = acf([1, 2, 3, 4, 5], 3);
  near(a[0].r, 1, "ACF r0 = 1", 1e-9);
}

/* ACF de una serie alternante 1,-1,1,-1,...: r1 < 0, r2 > 0 */
{
  const a = acf([1, -1, 1, -1, 1, -1], 2);
  near(a[1].r, -5 / 6, "ACF r1 alternante", 1e-6);
  near(a[2].r, 4 / 6, "ACF r2 alternante", 1e-6);
  ok(a[1].r < 0 && a[2].r > 0, "ACF alternante: signos correctos");
}

/* ACF de tendencia creciente: r1 alto positivo */
{
  const a = acf([1, 2, 3, 4, 5, 6, 7, 8], 1);
  ok(a[1].r > 0.5, "ACF tendencia: r1 positivo alto");
}

console.log(`\n  Pruebas de series temporales`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
