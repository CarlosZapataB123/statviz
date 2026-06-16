/**
 * workspace.js — Lienzo central.
 *
 * Estados:
 *  (1) Vacío: la tesis de la plataforma (las cuatro preguntas).
 *  (2) Gráfico con render (Fase 3): resuelve el conjunto de datos —los del
 *      usuario si son compatibles, o el ejemplo del gráfico—, calcula una
 *      configuración inicial y dibuja con Plotly. Reacciona a cambios de
 *      configuración, de tema y de tamaño.
 *  (3) Gráfico sin render todavía: ficha + aviso (como en fases previas).
 *
 * Materializa el principio del proyecto: cada gráfico se dibuja con los datos
 * que aporta el usuario o, en su defecto, con su propio ejemplo.
 */

import { bus, EVENTS } from "../core/events.js";
import { store } from "../core/state.js";
import { getChart, getCategory, TOTAL_CHARTS } from "../charts/registry.js";
import { getExample } from "../data/examples.js";
import { buildDatasetFromExample } from "../data/dataset.js";
import { hasBuilder, defaultConfig, canRender, isDataless } from "../charts/builders.js";
import { renderChart, resizeChart, purgeChart } from "../charts/renderer.js";

let rootEl = null;
let onExplore = null;

/** Estado del gráfico activo (para redibujar ante tema/config/tamaño/modo). */
let active = { chart: null, dataset: null, config: null, mount: null, ro: null, mode: "2d" };

const ICON_CHART =
  '<svg class="placeholder-note__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>';

/* ------------------------- Estado vacío: la tesis ---------------------- */
const QUESTIONS = [
  { q: "¿Qué gráfico necesito?", hint: "Elegir la visualización adecuada para tus variables y tu objetivo." },
  { q: "¿Cómo se construye?", hint: "Ver el método y los parámetros que hay detrás de cada figura." },
  { q: "¿Qué muestra?", hint: "Leer la figura representada con datos reales." },
  { q: "¿Cómo lo interpreto?", hint: "Obtener una lectura guiada fundamentada en los valores, no en plantillas." },
];

function renderHero() {
  const questions = QUESTIONS.map(
    (item, i) => `
      <div class="question">
        <span class="question__num">0${i + 1}</span>
        <span class="question__text">${item.q}<span class="question__hint">${item.hint}</span></span>
      </div>`
  ).join("");

  rootEl.innerHTML = `
    <div class="hero">
      <span class="eyebrow hero__eyebrow">Visualización estadística · ${TOTAL_CHARTS} gráficos</span>
      <h1 class="hero__title">Del dato a la figura, sin renunciar al <em>rigor</em>.</h1>
      <p class="hero__lead">
        Un catálogo de más de setenta gráficos estadísticos en nueve categorías.
        Cada uno explica qué representa, cómo se construye y cómo se interpreta —
        y trae su propio conjunto de datos de ejemplo para que nunca quede vacío.
      </p>
      <div class="questions" role="list">${questions}</div>
      <div class="hero__actions">
        <button class="btn btn--primary" type="button" data-action="explore">Explorar el catálogo</button>
        <button class="btn btn--ghost" type="button" data-action="example">Ver un ejemplo</button>
      </div>
    </div>`;
}

/* ----------------- Marco común del lienzo (cabecera + cuerpo) ---------- */
function chartFrame(chart, bodyHtml) {
  const category = getCategory(chart.category);
  const dims = chart.supports3D
    ? `<div class="dim-toggle" role="group" aria-label="Dimensión de la vista">
         <button type="button" class="dim-toggle__btn is-active" data-mode="2d" aria-pressed="true">2D</button>
         <button type="button" class="dim-toggle__btn" data-mode="3d" aria-pressed="false">3D</button>
       </div>`
    : '<span class="badge">2D</span>';
  return `
    <div class="chart-meta">
      <div class="chart-meta__eyebrow">
        <span class="eyebrow">${category ? category.name : ""}</span>
        ${dims}
      </div>
      <h1 class="chart-meta__title">${chart.name}</h1>
      <p class="chart-meta__desc">${chart.summary}</p>
      <div class="canvas-frame">
        <div class="canvas-frame__bar">
          <span class="canvas-frame__dots"><span></span><span></span><span></span></span>
          <span class="canvas-frame__label">${chart.id}</span>
        </div>
        <div class="canvas-frame__body">${bodyHtml}</div>
      </div>
    </div>`;
}

/* -------------------------- Resolución de datos ------------------------ */
/**
 * Decide qué conjunto usar: los datos del usuario si satisfacen el gráfico;
 * en su defecto, el ejemplo del gráfico. Devuelve null si no hay ninguno.
 */
function resolveDataset(chart) {
  const d = store.get("data");
  const hasUserData =
    d && (d.source === "csv" || d.source === "manual") && d.rows && d.rows.length;

  if (hasUserData) {
    const userDataset = {
      name: "Tus datos",
      source: d.source,
      variables: d.variables,
      rows: d.rows,
      n: d.rows.length,
    };
    if (canRender(userDataset, chart.id)) return userDataset;
  }

  const example = getExample(chart.exampleKey);
  return example ? buildDatasetFromExample(example) : null;
}

/* ----------------------------- Render Plotly --------------------------- */
function teardownActive() {
  if (active.ro) {
    active.ro.disconnect();
    active.ro = null;
  }
  if (active.mount) purgeChart(active.mount);
}

/** Dibuja (o redibuja) el gráfico activo y notifica el resultado. */
async function draw() {
  const { chart, dataset, config, mount, mode } = active;
  if (!chart || !mount) return;

  const result = await renderChart(mount, { chart, dataset, config, mode });

  if (!result.ok) {
    mount.innerHTML = `
      <div class="placeholder-note">
        ${ICON_CHART}
        <p class="placeholder-note__text">${result.message || "No se pudo dibujar el gráfico."}</p>
      </div>`;
  }

  bus.emit(EVENTS.CHART_RENDERED, {
    chartId: chart.id,
    dataset,
    config,
    ok: result.ok,
    reading: result.reading,
    warnings: result.warnings,
    message: result.message,
  });
}

/** Prepara el marco con render y lanza el primer dibujo. */
function renderWithPlot(chart) {
  const dataless = isDataless(chart.id);
  const dataset = dataless
    ? { name: "Modelo teórico", source: "modelo", variables: [], rows: [], n: 0 }
    : resolveDataset(chart);

  if (!dataset) {
    rootEl.innerHTML = chartFrame(
      chart,
      `<div class="placeholder-note">${ICON_CHART}
         <p class="placeholder-note__text">Aún no hay datos de ejemplo para este gráfico.</p>
       </div>`
    );
    bus.emit(EVENTS.CHART_RENDERED, { chartId: chart.id, ok: false, message: "Sin datos de ejemplo." });
    return;
  }

  const { config } = defaultConfig(dataset, chart.id);
  store.set("chart.config", config);

  rootEl.innerHTML = chartFrame(chart, `<div class="plot-mount" id="plot-mount" role="img" aria-label="Gráfico: ${chart.name}. La interpretación textual está en la pestaña Interpretación."></div>`);
  const mount = rootEl.querySelector("#plot-mount");

  teardownActive();
  active = { chart, dataset, config, mount, ro: null, mode: "2d" };
  store.set("chart.mode", "2d");

  // Barra de estado: datos activos o aviso de modelo teórico.
  if (dataless) bus.emit(EVENTS.DATA_CLEARED, {});
  else bus.emit(EVENTS.DATA_LOADED, { dataset });

  draw().then(() => {
    if (typeof ResizeObserver !== "undefined" && mount) {
      active.ro = new ResizeObserver(() => resizeChart(mount));
      active.ro.observe(mount);
    }
  });
}

/* ------------------- Render de marcador (sin builder) ------------------ */
function implPhase(chart) {
  if (chart.category === "series" || chart.category === "probabilidad" ||
      chart.category === "inferencia" || chart.category === "regresion") {
    return "una fase próxima";
  }
  return "una fase posterior";
}

function renderPlaceholder(chart) {
  teardownActive();
  active = { chart: null, dataset: null, config: null, mount: null, ro: null, mode: "2d" };

  const example = getExample(chart.exampleKey);
  let note;
  if (example) {
    const ds = buildDatasetFromExample(example);
    note = `<p class="placeholder-note__text">
        <strong>Datos de ejemplo cargados:</strong> ${example.name} (n = ${ds.n}).<br>
        El render interactivo de este gráfico se incorpora en ${implPhase(chart)}.
      </p>`;
    bus.emit(EVENTS.DATA_LOADED, { dataset: ds });
  } else {
    note = `<p class="placeholder-note__text">
        Este gráfico incluirá su propio conjunto de datos de ejemplo al
        implementar su render, en ${implPhase(chart)}.
      </p>`;
    bus.emit(EVENTS.DATA_CLEARED, {});
  }
  rootEl.innerHTML = chartFrame(chart, `<div class="placeholder-note">${ICON_CHART}${note}</div>`);
}

/* ------------------------------- Selección ----------------------------- */
function selectChart(id) {
  const chart = getChart(id);
  if (!chart) return;
  if (hasBuilder(id)) {
    renderWithPlot(chart);
  } else {
    renderPlaceholder(chart);
  }
  rootEl.parentElement?.focus?.();
}

/**
 * Devuelve el estado del gráfico activo (gráfico, datos, configuración, modo y
 * el nodo donde está dibujado). Lo usa el exportador.
 */
export function getActive() {
  return active;
}

/**
 * Inicializa el lienzo.
 * @param {Object} refs
 * @param {HTMLElement} refs.rootEl
 * @param {Function} refs.onExplore
 */
export function initWorkspace({ rootEl: r, onExplore: explore }) {
  rootEl = r;
  onExplore = explore;

  renderHero();

  rootEl.addEventListener("click", (e) => {
    // Conmutador de dimensión (2D/3D) del gráfico activo.
    const modeBtn = e.target.closest("[data-mode]");
    if (modeBtn) {
      if (!active.chart) return;
      const m = modeBtn.dataset.mode;
      if (m !== active.mode) {
        active.mode = m;
        store.set("chart.mode", m);
        rootEl.querySelectorAll(".dim-toggle__btn").forEach((b) => {
          const on = b.dataset.mode === m;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        draw();
      }
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "explore") {
      onExplore?.();
    } else if (btn.dataset.action === "example") {
      store.set("chart.id", "histogram");
      bus.emit(EVENTS.CHART_SELECTED, { id: "histogram" });
    }
  });

  bus.on(EVENTS.CHART_SELECTED, ({ id }) => selectChart(id));

  bus.on(EVENTS.CHART_CLEARED, () => {
    teardownActive();
    active = { chart: null, dataset: null, config: null, mount: null, ro: null, mode: "2d" };
    renderHero();
    bus.emit(EVENTS.DATA_CLEARED, {});
  });

  // Cambio de configuración desde el inspector: redibujar con el mismo dataset.
  bus.on(EVENTS.CHART_CONFIG_CHANGED, ({ config }) => {
    if (!active.chart) return;
    active.config = { ...active.config, ...config };
    store.set("chart.config", active.config);
    draw();
  });

  // Cambio de tema: Plotly se re-tematiza redibujando.
  bus.on(EVENTS.THEME_CHANGED, () => {
    if (active.chart && active.mount) draw();
  });

  window.addEventListener("resize", () => {
    if (active.mount) resizeChart(active.mount);
  });
}
