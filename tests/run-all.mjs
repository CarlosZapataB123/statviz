/**
 * run-all.mjs — Ejecutor único de la batería de pruebas.
 *
 * Descubre todos los archivos `*.test.mjs` de esta carpeta, los ejecuta cada
 * uno en su proceso y agrega el resultado. Sale con código 1 si alguna prueba
 * falla. Es el comando que usa la integración continua.
 *
 *   node tests/run-all.mjs
 */

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

let totalOk = 0;
let totalFail = 0;
let suitesFailed = 0;
const t0 = Date.now();

for (const file of files) {
  const res = spawnSync(process.execPath, [join(here, file)], { encoding: "utf8" });
  const out = (res.stdout || "") + (res.stderr || "");
  const ok = Number((out.match(/(\d+)\s+correctas/) || [])[1] || 0);
  const fail = Number((out.match(/(\d+)\s+fallidas/) || [])[1] || 0);
  totalOk += ok;
  totalFail += fail;
  const crashed = res.status !== 0 && fail === 0; // error fuera del recuento
  const bad = fail > 0 || crashed;
  if (bad) suitesFailed += 1;
  const mark = bad ? "✗" : "✓";
  const name = file.replace(/\.test\.mjs$/, "");
  console.log(`  ${mark} ${name.padEnd(22)} ${ok} correctas${fail ? `, ${fail} fallidas` : ""}${crashed ? "  (proceso con error)" : ""}`);
  if (crashed && out.trim()) {
    console.log(out.split("\n").slice(-6).map((l) => "      " + l).join("\n"));
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log("\n  ──────────────────────────────────────────────");
console.log(`  ${files.length} suites · ${totalOk} pruebas correctas · ${totalFail} fallidas · ${secs}s`);
if (suitesFailed) {
  console.log(`  Resultado: FALLÓ (${suitesFailed} suite(s) con problemas)\n`);
  process.exit(1);
}
console.log("  Resultado: TODO EN VERDE\n");
