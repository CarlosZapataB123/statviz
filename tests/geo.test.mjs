/**
 * geo.test.mjs — Pruebas del motor geoespacial.
 * Ejecutar: node tests/geo.test.mjs
 */

import { boundingBox, gridPoints, boxDiagonal, kde2d, idw } from "../js/stats/geo.js";

let passed = 0, failed = 0;
const failures = [];
function near(a, b, m, tol = 1e-6) { if (Math.abs(a - b) <= tol) passed += 1; else { failed += 1; failures.push(`${m} — ${a} ≠ ${b}`); } }
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* boundingBox: contiene todos los puntos con margen */
{
  const bb = boundingBox([0, 10], [0, 20], 0.1);
  ok(bb.latMin < 0 && bb.latMax > 10 && bb.lonMin < 0 && bb.lonMax > 20, "boundingBox: envuelve con margen");
}

/* gridPoints: nx*ny puntos dentro de la caja */
{
  const bb = { latMin: 0, latMax: 10, lonMin: 0, lonMax: 10 };
  const g = gridPoints(bb, 5, 4);
  ok(g.length === 20, "gridPoints: 5×4 = 20 puntos");
  ok(g.every((p) => p.lat >= 0 && p.lat <= 10 && p.lon >= 0 && p.lon <= 10), "gridPoints: dentro de la caja");
}

/* KDE: mayor densidad cerca de un cúmulo que lejos */
{
  const lats = [0, 0.1, -0.1, 0.05];
  const lons = [0, 0.1, -0.05, 0.0];
  const bb = boundingBox(lats, lons, 2);
  const g = gridPoints(bb, 11, 11);
  const d = kde2d(lats, lons, g, boxDiagonal(bb) / 8);
  // Punto más cercano al centro (0,0) vs esquina.
  const center = g.reduce((bestI, p, i, arr) => (Math.hypot(p.lat, p.lon) < Math.hypot(arr[bestI].lat, arr[bestI].lon) ? i : bestI), 0);
  const corner = 0; // primera celda = esquina inferior izquierda
  ok(d[center] > d[corner], "KDE: densidad mayor en el centro del cúmulo que en la esquina");
  ok(Math.max(...d) <= 1 + 1e-9, "KDE: normalizada a máximo 1");
}

/* IDW: exacto en la muestra; intermedio entre dos */
{
  const lats = [0, 10];
  const lons = [0, 0];
  const vals = [100, 200];
  // Punto sobre la muestra 0.
  const onSample = idw(lats, lons, vals, [{ lat: 0, lon: 0 }], 2);
  near(onSample[0], 100, "IDW: valor exacto sobre la muestra");
  // Punto equidistante → media.
  const mid = idw(lats, lons, vals, [{ lat: 5, lon: 0 }], 2);
  near(mid[0], 150, "IDW: punto medio = promedio", 1e-6);
  // Más cerca de la muestra 2 → más próximo a 200.
  const near2 = idw(lats, lons, vals, [{ lat: 8, lon: 0 }], 2);
  ok(near2[0] > 150, "IDW: pondera hacia la muestra más cercana");
}

console.log(`\n  Pruebas del motor geoespacial`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
