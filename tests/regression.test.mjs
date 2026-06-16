/**
 * regression.test.mjs — Pruebas del motor de regresión.
 * Ejecutar: node tests/regression.test.mjs
 */

import { linearModel, polyDesign, predictSimple } from "../js/stats/regression.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, msg, tol = 1e-6) {
  if (Math.abs(a - b) <= tol) passed += 1;
  else { failed += 1; failures.push(`${msg} — esperado ≈${b}, obtenido ${a}`); }
}
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* Relación exacta y = 2x + 1 → intercepto 1, pendiente 2, R² = 1 */
{
  const xs = [1, 2, 3, 4, 5];
  const y = xs.map((x) => 2 * x + 1);
  const m = linearModel(xs.map((x) => [x]), y, ["x"]);
  near(m.coefficients[0], 1, "intercepto exacto");
  near(m.coefficients[1], 2, "pendiente exacta");
  near(m.r2, 1, "R² = 1 en ajuste perfecto", 1e-9);
  ok(m.residuals.every((e) => Math.abs(e) < 1e-9), "residuos nulos en ajuste perfecto");
}

/* Invariantes de diagnóstico: Σ apalancamiento = p; fitted + resid = y */
{
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const y = [2.1, 3.9, 6.2, 7.8, 10.1, 12.3, 13.8, 16.4];
  const m = linearModel(xs.map((x) => [x]), y, ["x"]);
  const sumLev = m.leverage.reduce((s, h) => s + h, 0);
  near(sumLev, m.p, "Σ apalancamiento = nº de parámetros", 1e-6);
  ok(m.fitted.every((f, i) => Math.abs(f + m.residuals[i] - y[i]) < 1e-9), "fitted + residuo = y");
  ok(m.r2 > 0.99, "R² alto en relación casi lineal");
  ok(m.coefNames.length === 2, "nombres de coeficientes (intercepto + x)");
  ok(m.cooks.every((d) => Number.isFinite(d) && d >= 0), "distancia de Cook finita y ≥ 0");
}

/* Regresión múltiple: y = 1 + 2·x1 − 3·x2 (exacta) */
{
  const X = [
    [1, 0], [2, 1], [3, 2], [0, 1], [1, 2], [4, 0], [2, 3], [3, 1],
  ];
  const y = X.map(([a, b]) => 1 + 2 * a - 3 * b);
  const m = linearModel(X, y, ["x1", "x2"]);
  near(m.coefficients[0], 1, "múltiple: intercepto", 1e-6);
  near(m.coefficients[1], 2, "múltiple: b1", 1e-6);
  near(m.coefficients[2], -3, "múltiple: b2", 1e-6);
  near(m.r2, 1, "múltiple: R² = 1", 1e-9);
  ok(m.p === 3, "múltiple: 3 parámetros");
  const sumLev = m.leverage.reduce((s, h) => s + h, 0);
  near(sumLev, 3, "múltiple: Σ apalancamiento = 3", 1e-6);
}

/* polyDesign genera columnas x, x², x³ */
{
  const d = polyDesign([2, 3], 3);
  ok(d[0][0] === 2 && d[0][1] === 4 && d[0][2] === 8, "polyDesign grado 3");
}

/* predictSimple devuelve ŷ y EE de la media */
{
  const xs = [1, 2, 3, 4, 5];
  const y = [2, 4, 5, 4, 6];
  const m = linearModel(xs.map((x) => [x]), y, ["x"]);
  const { yhat, seMean } = predictSimple(m, [1, 3, 5]);
  ok(yhat.length === 3 && seMean.length === 3, "predictSimple: longitudes");
  ok(seMean.every((s) => s >= 0), "predictSimple: EE ≥ 0");
}

console.log(`\n  Pruebas del motor de regresión`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
