/**
 * exporter.js — Constructores de exportación (lógica pura, testeable).
 *
 * Genera los artefactos de texto de la exportación: nombre de archivo seguro,
 * informe en Markdown (con la interpretación y la figura embebida) y un HTML
 * autocontenido que reproduce el gráfico de forma interactiva cargando Plotly
 * desde la CDN. Las acciones del navegador (descarga, captura de imagen,
 * impresión) viven en la capa de UI.
 */

/** Convierte un nombre en un identificador de archivo seguro. */
export function slugify(name) {
  return String(name || "grafico")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "grafico";
}

/** Escapa texto para insertarlo en HTML. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Lista de estadísticos → tabla Markdown. */
function statsToMarkdownTable(stats) {
  if (!stats || !stats.length) return "";
  const rows = stats.map((s) => `| ${s.k} | ${s.v} |`).join("\n");
  return `| Métrica | Valor |\n| --- | --- |\n${rows}\n`;
}

/** Lectura estructurada → secciones Markdown. */
function readingToMarkdown(reading) {
  if (!reading) return "";
  const out = [];
  if (reading.lead) out.push(reading.lead + "\n");
  const table = statsToMarkdownTable(reading.stats);
  if (table) out.push("### Indicadores\n\n" + table);
  if (reading.notes && reading.notes.length) {
    out.push("### Notas\n\n" + reading.notes.map((n) => `- ${n}`).join("\n") + "\n");
  }
  if (reading.cautions && reading.cautions.length) {
    out.push("### Advertencias\n\n" + reading.cautions.map((c) => `- ${c}`).join("\n") + "\n");
  }
  return out.join("\n");
}

/**
 * Informe en Markdown del gráfico.
 * @param {Object} a
 * @param {string} a.title
 * @param {string} [a.categoryName]
 * @param {string} [a.datasetName]
 * @param {string} [a.imgDataUri]  PNG en base64 (data URI) para embeber
 * @param {Object} [a.reading]
 */
export function buildMarkdown({ title, categoryName, datasetName, imgDataUri, reading }) {
  const head = [`# ${title}`];
  const meta = [];
  if (categoryName) meta.push(`**Categoría:** ${categoryName}`);
  if (datasetName) meta.push(`**Datos:** ${datasetName}`);
  if (meta.length) head.push("\n" + meta.join("  ·  "));
  if (imgDataUri) head.push(`\n![${title}](${imgDataUri})`);
  const body = readingToMarkdown(reading);
  const foot = `\n---\n_Generado con StatViz Universe._`;
  return `${head.join("\n")}\n\n${body}${foot}\n`;
}

/** Lectura estructurada → HTML (para el HTML autocontenido y la impresión). */
export function readingToHtml(reading) {
  if (!reading) return "";
  const parts = [];
  if (reading.lead) parts.push(`<p class="lead">${escapeHtml(reading.lead)}</p>`);
  if (reading.stats && reading.stats.length) {
    const rows = reading.stats.map((s) => `<tr><th>${escapeHtml(s.k)}</th><td>${escapeHtml(s.v)}</td></tr>`).join("");
    parts.push(`<table class="stats">${rows}</table>`);
  }
  if (reading.notes && reading.notes.length) {
    parts.push(`<h2>Notas</h2><ul>${reading.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`);
  }
  if (reading.cautions && reading.cautions.length) {
    parts.push(`<h2>Advertencias</h2><ul class="cautions">${reading.cautions.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`);
  }
  return parts.join("\n");
}

const HTML_STYLE = `
  :root { color-scheme: light; }
  body { font-family: "IBM Plex Sans", system-ui, sans-serif; color: #16203a; background: #fbfbfd; margin: 0; padding: 32px; line-height: 1.6; }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 4px; }
  .sub { color: #5a678a; font-size: .85rem; margin: 0 0 20px; }
  #fig { width: 100%; height: 560px; }
  .lead { font-size: 1.02rem; }
  table.stats { border-collapse: collapse; margin: 12px 0; }
  table.stats th, table.stats td { text-align: left; padding: 4px 16px 4px 0; border-bottom: 1px solid #e6e8ef; font-size: .92rem; }
  table.stats th { color: #5a678a; font-weight: 500; }
  h2 { font-size: 1rem; margin: 18px 0 6px; }
  ul { margin: 0 0 12px; padding-left: 1.1rem; }
  ul.cautions li { color: #9a3b2a; }
  footer { margin-top: 28px; color: #8a93a8; font-size: .8rem; border-top: 1px solid #e6e8ef; padding-top: 12px; }
`;

/**
 * HTML autocontenido e interactivo: incrusta trazas y layout y los dibuja con
 * Plotly (cargado desde la CDN). Reproduce el gráfico sin depender de la app.
 */
export function buildStandaloneHtml({ title, categoryName, datasetName, traces, layout, reading, plotlyUrl }) {
  const sub = [categoryName, datasetName ? `Datos: ${datasetName}` : ""].filter(Boolean).join("  ·  ");
  const url = plotlyUrl || "https://cdn.plot.ly/plotly-2.35.2.min.js";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · StatViz Universe</title>
<style>${HTML_STYLE}</style>
<script src="${url}" charset="utf-8"><\/script>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(sub)}</p>
  <div id="fig"></div>
  ${readingToHtml(reading)}
  <footer>Figura interactiva generada con StatViz Universe. Arrastra para girar o hacer zoom.</footer>
</div>
<script>
  const traces = ${JSON.stringify(traces)};
  const layout = ${JSON.stringify(layout)};
  Plotly.newPlot("fig", traces, layout, { responsive: true, displaylogo: false });
<\/script>
</body>
</html>`;
}
