/**
 * exporter.js (UI) — Exportación del gráfico activo.
 *
 * Un menú en la cabecera ofrece siete formatos. Los cinco nativos (PNG, SVG,
 * PDF por impresión, HTML interactivo autocontenido y Markdown con la
 * interpretación) no requieren ninguna librería: usan Plotly —ya cargado— y el
 * navegador. PPTX y DOCX cargan una librería de código abierto bajo demanda
 * (solo al usarlas) y degradan con elegancia si la red falla.
 *
 * La figura se toma "viva" del nodo dibujado (datos y layout ya tematizados),
 * de modo que lo exportado coincide exactamente con lo que se ve.
 */

import { bus, EVENTS } from "../core/events.js";
import { getActive } from "./workspace.js";
import { getCategory } from "../charts/registry.js";
import { slugify, buildMarkdown, buildStandaloneHtml, readingToHtml } from "../charts/exporter.js";

const PPTX_URL = "https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.min.js";
const DOCX_URL = "https://unpkg.com/docx@7.8.2/build/index.umd.js";

let expBtn = null;
let expMenu = null;
let expStatus = null;
let lastReading = null;

const FORMATS = [
  { fmt: "png", name: "PNG", note: "imagen de mapa de bits" },
  { fmt: "svg", name: "SVG", note: "imagen vectorial" },
  { fmt: "pdf", name: "PDF", note: "vía diálogo de impresión" },
  { fmt: "html", name: "HTML interactivo", note: "figura autocontenida" },
  { fmt: "md", name: "Markdown", note: "informe con interpretación" },
  { fmt: "pptx", name: "PowerPoint", note: ".pptx · carga una librería" },
  { fmt: "docx", name: "Word", note: ".docx · carga una librería" },
];

/* --------------------------- Utilidades web ---------------------------- */
const scriptCache = new Map();
function loadScript(url) {
  if (scriptCache.has(url)) return scriptCache.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url; s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("No se pudo cargar la librería externa."));
    document.head.appendChild(s);
  });
  scriptCache.set(url, p);
  return p;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename, mime) {
  downloadBlob(new Blob([text], { type: mime || "text/plain;charset=utf-8" }), filename);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ------------------------ Contexto de exportación ---------------------- */
/** Reúne el gráfico activo y su figura dibujada; null si no hay nada que exportar. */
function exportContext() {
  const a = getActive();
  const Plotly = window.Plotly;
  if (!a || !a.chart || !a.mount || !Plotly || !a.mount.data) return null;
  const cat = getCategory(a.chart.category);
  return {
    Plotly,
    mount: a.mount,
    title: a.chart.name,
    categoryName: cat ? cat.name : "",
    datasetName: a.dataset ? a.dataset.name : "",
    slug: slugify(a.chart.name),
    reading: lastReading,
    // Figura viva, saneada a JSON (sin funciones).
    traces: JSON.parse(JSON.stringify(a.mount.data)),
    layout: JSON.parse(JSON.stringify(a.mount.layout || {})),
  };
}

function readingPlain(reading) {
  if (!reading) return "";
  const lines = [];
  if (reading.lead) lines.push(reading.lead);
  (reading.stats || []).forEach((s) => lines.push(`${s.k}: ${s.v}`));
  (reading.notes || []).forEach((n) => lines.push(`• ${n}`));
  (reading.cautions || []).forEach((c) => lines.push(`⚠ ${c}`));
  return lines.join("\n");
}

/* ------------------------------ Acciones ------------------------------- */
async function exportPNG(ctx) {
  const url = await ctx.Plotly.toImage(ctx.mount, { format: "png", scale: 2 });
  downloadDataUrl(url, `${ctx.slug}.png`);
}

async function exportSVG(ctx) {
  const url = await ctx.Plotly.toImage(ctx.mount, { format: "svg" });
  downloadDataUrl(url, `${ctx.slug}.svg`);
}

async function exportPDF(ctx) {
  const png = await ctx.Plotly.toImage(ctx.mount, { format: "png", scale: 2 });
  const win = window.open("", "_blank");
  if (!win) throw new Error("El navegador bloqueó la ventana de impresión.");
  const sub = [ctx.categoryName, ctx.datasetName ? `Datos: ${ctx.datasetName}` : ""].filter(Boolean).join("  ·  ");
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${ctx.title}</title>
    <style>
      body{font-family:"IBM Plex Sans",system-ui,sans-serif;color:#16203a;margin:32px;line-height:1.55}
      h1{font-size:1.4rem;margin:0 0 2px} .sub{color:#5a678a;font-size:.85rem;margin:0 0 16px}
      img{max-width:100%;border:1px solid #e6e8ef;border-radius:8px}
      table{border-collapse:collapse;margin:12px 0} th,td{text-align:left;padding:3px 16px 3px 0;border-bottom:1px solid #e6e8ef;font-size:.9rem} th{color:#5a678a;font-weight:500}
      h2{font-size:1rem;margin:16px 0 6px} ul{padding-left:1.1rem} ul.cautions li{color:#9a3b2a}
      @media print{ body{margin:12mm} }
    </style></head><body>
    <h1>${ctx.title}</h1><p class="sub">${sub}</p>
    <img src="${png}" alt="${ctx.title}">
    ${readingToHtml(ctx.reading)}
    <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
    </body></html>`);
  win.document.close();
}

function exportHTML(ctx) {
  const html = buildStandaloneHtml({
    title: ctx.title, categoryName: ctx.categoryName, datasetName: ctx.datasetName,
    traces: ctx.traces, layout: ctx.layout, reading: ctx.reading,
  });
  downloadText(html, `${ctx.slug}.html`, "text/html;charset=utf-8");
}

async function exportMD(ctx) {
  const png = await ctx.Plotly.toImage(ctx.mount, { format: "png", scale: 2 });
  const md = buildMarkdown({
    title: ctx.title, categoryName: ctx.categoryName, datasetName: ctx.datasetName,
    imgDataUri: png, reading: ctx.reading,
  });
  downloadText(md, `${ctx.slug}.md`, "text/markdown;charset=utf-8");
}

async function exportPPTX(ctx) {
  await loadScript(PPTX_URL);
  const PptxGenJS = window.PptxGenJS;
  if (!PptxGenJS) throw new Error("La librería de PowerPoint no está disponible.");
  const png = await ctx.Plotly.toImage(ctx.mount, { format: "png", scale: 2, width: 1000, height: 560 });
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "SV", width: 10, height: 5.63 });
  pptx.layout = "SV";
  const slide = pptx.addSlide();
  slide.addText(ctx.title, { x: 0.4, y: 0.25, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: "16203A" });
  slide.addText([ctx.categoryName, ctx.datasetName].filter(Boolean).join("  ·  "), { x: 0.4, y: 0.72, w: 9.2, h: 0.3, fontSize: 11, color: "5A678A" });
  slide.addImage({ data: png, x: 0.4, y: 1.1, w: 6.2, h: 3.47 });
  slide.addText(readingPlain(ctx.reading), { x: 6.8, y: 1.1, w: 2.9, h: 4.0, fontSize: 9, color: "33415C", valign: "top" });
  await pptx.writeFile({ fileName: `${ctx.slug}.pptx` });
}

async function exportDOCX(ctx) {
  await loadScript(DOCX_URL);
  const docx = window.docx;
  if (!docx) throw new Error("La librería de Word no está disponible.");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = docx;
  const png = await ctx.Plotly.toImage(ctx.mount, { format: "png", scale: 2, width: 1000, height: 560 });
  const bytes = dataUrlToBytes(png);

  const children = [
    new Paragraph({ text: ctx.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: [ctx.categoryName, ctx.datasetName].filter(Boolean).join("  ·  "), italics: true, color: "5A678A" })] }),
    new Paragraph({ children: [new ImageRun({ data: bytes, transformation: { width: 600, height: 336 } })] }),
  ];
  const r = ctx.reading || {};
  if (r.lead) children.push(new Paragraph({ text: r.lead }));
  (r.stats || []).forEach((s) => children.push(new Paragraph({ children: [new TextRun({ text: `${s.k}: `, bold: true }), new TextRun(String(s.v))] })));
  if (r.notes && r.notes.length) {
    children.push(new Paragraph({ text: "Notas", heading: HeadingLevel.HEADING_2 }));
    r.notes.forEach((n) => children.push(new Paragraph({ text: n, bullet: { level: 0 } })));
  }
  if (r.cautions && r.cautions.length) {
    children.push(new Paragraph({ text: "Advertencias", heading: HeadingLevel.HEADING_2 }));
    r.cautions.forEach((c) => children.push(new Paragraph({ text: c, bullet: { level: 0 } })));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${ctx.slug}.docx`);
}

const ACTIONS = { png: exportPNG, svg: exportSVG, pdf: exportPDF, html: exportHTML, md: exportMD, pptx: exportPPTX, docx: exportDOCX };

async function runExport(fmt) {
  const ctx = exportContext();
  if (!ctx) {
    setStatus("Primero abre un gráfico en el lienzo.");
    return;
  }
  const label = (FORMATS.find((f) => f.fmt === fmt) || {}).name || fmt;
  setStatus(`Generando ${label}…`);
  try {
    await ACTIONS[fmt](ctx);
    expClose();
  } catch (err) {
    setStatus(err.message || "No se pudo exportar.");
  }
}

/* -------------------------------- Menú --------------------------------- */
function setStatus(msg) {
  if (expStatus) expStatus.textContent = msg || "";
}

function buildMenu() {
  expMenu = document.createElement("div");
  expMenu.className = "exp-menu";
  expMenu.dataset.open = "false";
  expMenu.setAttribute("role", "menu");
  expMenu.setAttribute("aria-label", "Exportar gráfico");
  const items = FORMATS.map((f, i) =>
    `${f.fmt === "pptx" ? '<div class="exp-menu__sep"></div>' : ""}
     <button class="exp-menu__item" type="button" role="menuitem" data-fmt="${f.fmt}">
       <span class="exp-menu__name">${f.name}</span><span class="exp-menu__note">${f.note}</span>
     </button>`
  ).join("");
  expMenu.innerHTML = `${items}<p class="exp-menu__status" aria-live="polite"></p>`;
  document.body.appendChild(expMenu);
  expStatus = expMenu.querySelector(".exp-menu__status");

  expMenu.addEventListener("click", (e) => {
    const item = e.target.closest("[data-fmt]");
    if (item) runExport(item.dataset.fmt);
  });
}

function positionMenu() {
  const r = expBtn.getBoundingClientRect();
  expMenu.style.top = `${Math.round(r.bottom + 8)}px`;
  expMenu.style.right = `${Math.round(window.innerWidth - r.right)}px`;
}

function expOpen() {
  setStatus("");
  positionMenu();
  expMenu.dataset.open = "true";
  expBtn.setAttribute("aria-expanded", "true");
}

function expClose() {
  expMenu.dataset.open = "false";
  expBtn.setAttribute("aria-expanded", "false");
}

function toggle() {
  if (expMenu.dataset.open === "true") expClose();
  else expOpen();
}

/**
 * Inicializa la exportación.
 * @param {Object} refs
 * @param {HTMLElement} refs.openBtn  botón que abre el menú de exportación
 */
export function initExporter({ openBtn }) {
  expBtn = openBtn;
  if (!expBtn) return;
  buildMenu();
  expBtn.setAttribute("aria-haspopup", "true");
  expBtn.setAttribute("aria-expanded", "false");
  expBtn.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });

  document.addEventListener("click", (e) => {
    if (expMenu.dataset.open === "true" && !expMenu.contains(e.target) && e.target !== expBtn) expClose();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && expMenu.dataset.open === "true") expClose();
  });
  window.addEventListener("resize", () => { if (expMenu.dataset.open === "true") positionMenu(); });

  // Cachea la última lectura para incluirla en los informes.
  bus.on(EVENTS.CHART_RENDERED, ({ reading }) => { lastReading = reading || null; });
  bus.on(EVENTS.CHART_CLEARED, () => { lastReading = null; });
}
