/**
 * distributions.test.mjs — Pruebas del motor de distribuciones.
 * Ejecutar: node tests/distributions.test.mjs
 * Compara contra valores conocidos de tablas e identidades.
 */

import * as D from "../js/stats/distributions.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, msg, tol = 1e-3) {
  if (Math.abs(a - b) <= tol) passed += 1;
  else { failed += 1; failures.push(`${msg} — esperado ≈${b}, obtenido ${a}`); }
}

/* Funciones especiales */
near(D.gammaFn(5), 24, "Γ(5)=24");
near(D.gammaFn(0.5), Math.sqrt(Math.PI), "Γ(0.5)=√π");
near(D.erf(0), 0, "erf(0)=0");
near(D.erf(1), 0.8427, "erf(1)");

/* Normal */
near(D.normalCdf(0), 0.5, "Φ(0)=0.5");
near(D.normalCdf(1.96), 0.975, "Φ(1.96)=0.975", 2e-3);
near(D.normalCdf(-1), 0.1587, "Φ(-1)");
near(D.normalInv(0.975), 1.95996, "Φ⁻¹(0.975)", 1e-3);
near(D.normalInv(0.5), 0, "Φ⁻¹(0.5)=0");
near(D.normalPdf(0), 1 / Math.sqrt(2 * Math.PI), "φ(0)");

/* t de Student */
near(D.studentTInv(0.975, 10), 2.2281, "t_{0.975,10}", 2e-3);
near(D.studentTInv(0.975, 30), 2.0423, "t_{0.975,30}", 2e-3);
near(D.studentTCdf(0, 5), 0.5, "T(0)=0.5");
near(D.studentTCdf(2.2281, 10), 0.975, "T(2.228,10)", 2e-3);

/* Ji-cuadrado */
near(D.chiSqInv(0.95, 1), 3.8415, "χ²_{0.95,1}", 3e-3);
near(D.chiSqInv(0.95, 5), 11.0705, "χ²_{0.95,5}", 5e-3);
near(D.chiSqCdf(3.8415, 1), 0.95, "F_χ²(3.84,1)", 2e-3);

/* F */
near(D.fInv(0.95, 5, 10), 3.3258, "F_{0.95,5,10}", 5e-3);
near(D.fCdf(3.3258, 5, 10), 0.95, "F_F(3.326,5,10)", 2e-3);

/* Exponencial */
near(D.expCdf(1, 1), 1 - Math.exp(-1), "Exp cdf(1,1)");
near(D.expInv(0.5, 1), Math.log(2), "Exp mediana");

/* Weibull */
near(D.weibullCdf(1, 1, 1), 1 - Math.exp(-1), "Weibull(1,1) cdf(1)");

/* Gamma (forma 1 = exponencial) */
near(D.gammaCdf(1, 1, 1), 1 - Math.exp(-1), "Gamma(1,1) cdf(1) = Exp");
near(D.gammaCdf(2, 2, 1), 0.5940, "Gamma(2,1) cdf(2)", 3e-3);

/* Beta (simétrica) */
near(D.betaCdf(0.5, 2, 2), 0.5, "Beta(2,2) cdf(0.5)=0.5");
near(D.incBeta(0.5, 0.5, 0.5), 0.5, "I_0.5(0.5,0.5)=0.5");

/* Binomial */
near(D.binomPmf(2, 5, 0.5), 0.3125, "Binom pmf(2;5,0.5)");
near(D.binomCdf(2, 5, 0.5), 0.5, "Binom cdf(2;5,0.5)=0.5");
near(D.binomCdf(10, 10, 0.3), 1, "Binom cdf(n)=1");

/* Poisson */
near(D.poissonPmf(0, 2), Math.exp(-2), "Poisson pmf(0;2)");
near(D.poissonCdf(3, 2), 0.8571, "Poisson cdf(3;2)", 2e-3);

console.log(`\n  Pruebas del motor de distribuciones`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
