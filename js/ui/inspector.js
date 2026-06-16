/**
 * inspector.js — Panel derecho: configuración e interpretación.
 *
 * Actúa como anfitrión de dos pestañas y delega su contenido:
 *  - Configuración → configPanel (asignación de variables) cuando el gráfico
 *    está dibujado; si no, muestra la ficha de metadatos del gráfico.
 *  - Interpretación → interpretationPanel (lectura basada en datos).
 *
 * Escucha la selección del gráfico y el evento de "gráfico dibujado" para
 * mantener ambos paneles sincronizados con el lienzo.
 */

import { bus, EVENTS } from "../core/events.js";
import { getChart, getCategory } from "../charts/registry.js";
import { renderConfig } from "./configPanel.js";
import { renderInterpretation } from "./interpretationPanel.js";

let tabsEl = null;
let panelEl = null;
let activeTab = "config";
let currentChart = null;
let lastRender = null; // payload de CHART_RENDERED para el gráfico actual

/** Cambia la pestaña activa y vuelve a pintar. */
function setTab(tab) {
  activeTab = tab;
  tabsEl?.querySelectorAll(".tabs__btn").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  });
  renderPanel();
}

/** Ficha de metadatos del gráfico (respaldo de la pestaña Configuración). */
function metadataFicha(chart) {
  if (!chart) {
    return `
      <div class="inspector-empty">
        <p class="inspector-empty__text">
          Elige un gráfico en el catálogo para ver sus opciones de configuración.
        </p>
      </div>`;
  }
  const category = getCategory(chart.category);
  const dims = chart.supports3D ? "2D y 3D" : "2D";
  const message =
    lastRender && !lastRender.ok && lastRender.message
      ? `<p class="field-group__hint">${lastRender.message}</p>`
      : `<p class="field-group__hint">
           El render interactivo de este gráfico se incorpora en una fase
           posterior; entonces se activarán aquí sus controles.
         </p>`;
  return `
    <div class="field-group">
      <span class="field-group__label">Ficha del gráfico</span>
      <dl class="meta-dl">
        <dt>Categoría</dt><dd>${category ? category.name : "—"}</dd>
        <dt>Modos</dt><dd>${dims}</dd>
        <dt>Datos</dt><dd>ejemplo incluido</dd>
      </dl>
    </div>
    <div class="field-group">
      <span class="field-group__label">Configuración</span>
      ${message}
    </div>`;
}

/** Pinta el panel según la pestaña activa y el estado del gráfico. */
function renderPanel() {
  if (activeTab === "config") {
    if (lastRender && lastRender.ok && lastRender.dataset && lastRender.config) {
      renderConfig(panelEl, {
        chart: currentChart,
        dataset: lastRender.dataset,
        config: lastRender.config,
      });
    } else {
      panelEl.innerHTML = metadataFicha(currentChart);
    }
    return;
  }
  // Interpretación.
  if (lastRender && lastRender.ok) {
    renderInterpretation(panelEl, lastRender);
  } else {
    renderInterpretation(panelEl, { reading: null });
  }
}

/**
 * Inicializa el inspector.
 * @param {Object} refs
 * @param {HTMLElement} refs.tabsEl
 * @param {HTMLElement} refs.panelEl
 */
export function initInspector({ tabsEl: t, panelEl: p }) {
  tabsEl = t;
  panelEl = p;

  tabsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tabs__btn");
    if (btn) setTab(btn.dataset.tab);
  });

  bus.on(EVENTS.CHART_SELECTED, ({ id }) => {
    currentChart = getChart(id);
    lastRender = null;
    renderPanel();
  });

  bus.on(EVENTS.CHART_RENDERED, (payload) => {
    currentChart = getChart(payload.chartId) || currentChart;
    lastRender = payload;
    renderPanel();
  });

  bus.on(EVENTS.CHART_CLEARED, () => {
    currentChart = null;
    lastRender = null;
    renderPanel();
  });

  setTab("config");
}
