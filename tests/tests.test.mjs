/**
 * tests.test.mjs — Pruebas de las utilidades inferenciales.
 * Ejecutar: node tests/tests.test.mjs
 */

import { groupStats, meanCI, pooledIV, rocCurve, prCurve } from "../js/stats/tests.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, msg, tol = 1e-3) {
  if (Math.abs(a - b) <= tol) passed += 1;
  else { failed += 1; failures.push(`${msg} — esperado ≈${b}, obtenido ${a}`); }
}
function ok(cond, msg) { if (cond) passed += 1; else { failed += 1; failures.push(msg); } }

/* meanCI: media de [2,4,4,4,5,5,7,9] = 5, sd=2, se=0.70711, t_.975,7=2.3646 */
{
  const ci = meanCI(5, 2 / Math.sqrt(8), 8);
  near(ci.tcrit, 2.3646, "t crítica gl=7", 2e-3);
  near(ci.lo, 3.328, "IC inferior", 2e-3);
  near(ci.hi, 6.672, "IC superior", 2e-3);
}

/* groupStats */
{
  const rows = [
    { g: "A", y: 10 }, { g: "A", y: 20 }, { g: "B", y: 30 }, { g: "B", y: 50 },
  ];
  const gs = groupStats(rows, "y", "g");
  ok(gs.length === 2, "groupStats: 2 grupos");
  near(gs[0].mean, 15, "groupStats media A");
  near(gs[1].mean, 40, "groupStats media B");
}

/* pooledIV: estimaciones 0.2 y 0.4 con se 0.1 → 0.3 ± ... */
{
  const p = pooledIV([0.2, 0.4], [0.1, 0.1]);
  near(p.estimate, 0.3, "pooled estimación");
  near(p.se, Math.sqrt(1 / 200), "pooled error estándar", 1e-4);
}

/* ROC: separación perfecta → AUC 1; intermedio conocido → 0.75 */
{
  const perfect = rocCurve([1, 2, 3, 4], [false, false, true, true]);
  near(perfect.auc, 1, "ROC AUC separación perfecta");
  const mid = rocCurve([0.1, 0.4, 0.35, 0.8], [false, false, true, true]);
  near(mid.auc, 0.75, "ROC AUC intermedio");
  const inv = rocCurve([1, 2, 3, 4], [true, true, false, false]);
  near(inv.auc, 0, "ROC AUC invertido");
}

/* PR: separación perfecta → AP 1; prevalencia correcta */
{
  const pr = prCurve([1, 2, 3, 4], [false, false, true, true]);
  near(pr.ap, 1, "PR AP separación perfecta");
  near(pr.prevalence, 0.5, "PR prevalencia");
}

console.log(`\n  Pruebas de utilidades inferenciales`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
