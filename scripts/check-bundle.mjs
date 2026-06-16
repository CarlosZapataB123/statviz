/**
 * check-bundle.mjs — Verifica la integridad de la vista previa de archivo único.
 *
 * Tras `python3 build_preview.py`, comprueba que el módulo inlinado:
 *   · no conserva sentencias import/export,
 *   · no declara nombres de nivel superior duplicados (colisión de ámbito),
 *   · no contiene `</script>` literal (cerraría el script antes de tiempo),
 *   · es sintácticamente válido (node --check).
 *
 *   node scripts/check-bundle.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "statviz-universe-preview.html");

let problems = [];
const html = readFileSync(htmlPath, "utf8");

const m = html.match(/<script type="module">([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) {
  console.error("✗ No se encontró el <script type=\"module\"> del bundle.");
  process.exit(1);
}
const js = m[1];

const imports = (js.match(/^\s*import\b/gm) || []).length;
const exports = (js.match(/^\s*export\b/gm) || []).length;
if (imports) problems.push(`${imports} sentencia(s) import residual(es)`);
if (exports) problems.push(`${exports} sentencia(s) export residual(es)`);
if (js.includes("</script>")) problems.push("contiene «</script>» literal");

const names = [...js.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((x) => x[1]);
const seen = new Set(); const dups = new Set();
for (const n of names) { if (seen.has(n)) dups.add(n); else seen.add(n); }
if (dups.size) problems.push(`nombres de nivel superior duplicados: ${[...dups].join(", ")}`);

const tmp = join(tmpdir(), "statviz-bundle-check.mjs");
writeFileSync(tmp, js);
const res = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
if (res.status !== 0) problems.push("node --check falló:\n" + (res.stderr || "").split("\n").slice(0, 4).join("\n"));

console.log(`Bundle: ${(js.length / 1024).toFixed(0)} KB · ${names.length} símbolos de nivel superior`);
if (problems.length) {
  console.error("✗ Integridad del bundle: PROBLEMAS");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("✓ Integridad del bundle: correcta (sin imports/exports, sin duplicados, sintaxis válida)");
