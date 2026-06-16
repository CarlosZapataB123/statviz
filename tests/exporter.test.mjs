/**
 * exporter.test.mjs — Pruebas de los constructores de exportación (puros).
 * Ejecutar: node tests/exporter.test.mjs
 */

import { slugify, escapeHtml, buildMarkdown, readingToHtml, buildStandaloneHtml } from "../js/charts/exporter.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, m) { if (c) passed += 1; else { failed += 1; failures.push(m); } }

/* slugify */
ok(slugify("Diagrama de Caja: Bienestar") === "diagrama-de-caja-bienestar", "slugify: minúsculas, sin signos");
ok(slugify("Relación ñandú & Co.") === "relacion-nandu-co", "slugify: quita acentos y símbolos");
ok(slugify("") === "grafico", "slugify: vacío → fallback");
ok(!/^-|-$/.test(slugify("  espacios  ")), "slugify: sin guiones en los extremos");

/* escapeHtml */
ok(escapeHtml('<b>"x"</b>') === "&lt;b&gt;&quot;x&quot;&lt;/b&gt;", "escapeHtml: escapa < > \"");

/* buildMarkdown */
{
  const reading = {
    lead: "La distribución es asimétrica a la derecha.",
    stats: [{ k: "Media", v: "3.20" }, { k: "Mediana", v: "3.00" }],
    notes: ["La media supera a la mediana."],
    cautions: ["Sensible a valores atípicos."],
  };
  const md = buildMarkdown({ title: "Histograma", categoryName: "Descriptiva", datasetName: "Tus datos", imgDataUri: "data:image/png;base64,AAA", reading });
  ok(md.startsWith("# Histograma"), "markdown: encabezado con el título");
  ok(md.includes("**Categoría:** Descriptiva") && md.includes("**Datos:** Tus datos"), "markdown: metadatos");
  ok(md.includes("![Histograma](data:image/png;base64,AAA)"), "markdown: imagen embebida");
  ok(md.includes("| Métrica | Valor |") && md.includes("| Media | 3.20 |"), "markdown: tabla de indicadores");
  ok(md.includes("### Notas") && md.includes("- La media supera a la mediana."), "markdown: notas");
  ok(md.includes("### Advertencias") && md.includes("- Sensible a valores atípicos."), "markdown: advertencias");
  ok(md.includes("StatViz Universe"), "markdown: pie de autoría");
}

/* readingToHtml escapa contenido */
{
  const html = readingToHtml({ lead: "x < y & z", stats: [{ k: "a", v: "<b>" }], notes: [], cautions: [] });
  ok(html.includes("x &lt; y &amp; z"), "readingToHtml: escapa el texto del lead");
  ok(html.includes("&lt;b&gt;"), "readingToHtml: escapa los valores");
}

/* buildStandaloneHtml incrusta datos y carga Plotly */
{
  const traces = [{ type: "scatter3d", x: [1, 2], y: [3, 4], z: [5, 6] }];
  const layout = { scene: { xaxis: { title: { text: "A" } } } };
  const html = buildStandaloneHtml({ title: "Dispersión 3D", categoryName: "Asociación", datasetName: "multivar", traces, layout, reading: { lead: "ok", stats: [], notes: [], cautions: [] } });
  ok(html.includes("<!doctype html>"), "standalone: documento HTML completo");
  ok(html.includes("cdn.plot.ly/plotly"), "standalone: carga Plotly desde la CDN");
  ok(html.includes('Plotly.newPlot("fig"'), "standalone: dibuja la figura");
  ok(html.includes(JSON.stringify(traces)), "standalone: incrusta las trazas");
  ok(html.includes(JSON.stringify(layout)), "standalone: incrusta el layout");
  ok(html.includes("Dispersión 3D"), "standalone: incluye el título");
}

console.log(`\n  Pruebas de exportación`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed) { for (const f of failures) console.log("  ✗ " + f); process.exit(1); }
else console.log("  ✓ Todo correcto\n");
