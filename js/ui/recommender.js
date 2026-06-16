/**
 * recommender.js (UI) — Asistente "¿Qué gráfico necesito?".
 *
 * Ventana modal que lee el perfil de las variables del usuario (si hay datos
 * cargados), permite elegir un objetivo analítico y muestra los gráficos
 * recomendados con su justificación. Al elegir uno, lo abre en el lienzo.
 * La lógica de recomendación vive en js/charts/recommender.js.
 */

import { bus, EVENTS } from "../core/events.js";
import { store } from "../core/state.js";
import { recommend, profileFromDataset, GOALS } from "../charts/recommender.js";
import { getChart, getCategory } from "../charts/registry.js";

let recOverlay = null;
let recBody = null;
let recLastFocused = null;
let recGoal = ""; // "" = agregado (todos los objetivos)

/** Perfil de los datos del usuario, o null si no hay datos cargados. */
function currentProfile() {
  const d = store.get("data");
  if (d && (d.source === "csv" || d.source === "manual") && d.rows && d.rows.length) {
    return profileFromDataset({ variables: d.variables, n: d.rows.length });
  }
  return null;
}

function profileLine(p) {
  if (!p) {
    return "No has cargado datos. Te muestro los gráficos típicos de cada objetivo; cada uno trae su propio conjunto de ejemplo.";
  }
  const parts = [];
  if (p.numeric) parts.push(`${p.numeric} numérica${p.numeric === 1 ? "" : "s"}`);
  if (p.categorical) parts.push(`${p.categorical} categórica${p.categorical === 1 ? "" : "s"}`);
  if (p.temporal) parts.push(`${p.temporal} temporal${p.temporal === 1 ? "" : "es"}`);
  return `Según tus datos (${p.n} filas: ${parts.join(", ") || "sin variables reconocidas"}), estas son las sugerencias.`;
}

function chipsHtml() {
  const all = `<button class="rec-chip${recGoal === "" ? " is-active" : ""}" type="button" data-goal="" aria-pressed="${recGoal === ""}">Todos</button>`;
  const rest = GOALS.map((g) =>
    `<button class="rec-chip${recGoal === g.id ? " is-active" : ""}" type="button" data-goal="${g.id}" aria-pressed="${recGoal === g.id}" title="${g.hint}">${g.label}</button>`
  ).join("");
  return all + rest;
}

function resultsHtml(profile) {
  const recs = recommend(profile, recGoal || undefined);
  if (!recs.length) {
    return `<p class="rec__empty">Para este objetivo necesitas variables que tus datos no tienen todavía. Prueba otro objetivo o carga datos adecuados.</p>`;
  }
  return recs
    .map((r) => {
      const chart = getChart(r.id);
      if (!chart) return "";
      const cat = getCategory(chart.category);
      return `
        <button class="rec-card" type="button" data-chart="${r.id}">
          <span class="rec-card__head">
            <span class="rec-card__name">${chart.name}</span>
            <span class="rec-card__cat">${cat ? cat.name : ""}</span>
          </span>
          <span class="rec-card__why">${r.reason}</span>
        </button>`;
    })
    .join("");
}

function render() {
  const profile = currentProfile();
  recBody.innerHTML = `
    <div class="rec">
      <p class="rec__profile">${profileLine(profile)}</p>
      <div class="rec__goals" role="group" aria-label="Objetivo del análisis">${chipsHtml()}</div>
      <div class="rec__results">${resultsHtml(profile)}</div>
    </div>`;
}

function buildRecModal() {
  recOverlay = document.createElement("div");
  recOverlay.className = "modal-overlay";
  recOverlay.dataset.open = "false";
  recOverlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rec-title">
      <div class="modal__head">
        <span class="modal__title" id="rec-title">¿Qué gráfico necesito?</span>
        <span class="modal__subtitle">Recomendador</span>
        <button class="icon-btn" type="button" data-act="close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="modal__body" id="rec-body"></div>
    </div>`;
  document.body.appendChild(recOverlay);
  recBody = recOverlay.querySelector("#rec-body");

  recOverlay.addEventListener("click", (e) => {
    if (e.target === recOverlay || e.target.closest('[data-act="close"]')) { closeRec(); return; }

    const chip = e.target.closest("[data-goal]");
    if (chip) {
      recGoal = chip.dataset.goal;
      render();
      return;
    }
    const card = e.target.closest("[data-chart]");
    if (card) {
      const id = card.dataset.chart;
      store.set("chart.id", id);
      bus.emit(EVENTS.CHART_SELECTED, { id });
      closeRec();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && recOverlay.dataset.open === "true") closeRec();
  });
}

function openRec() {
  recLastFocused = document.activeElement;
  recGoal = "";
  render();
  recOverlay.dataset.open = "true";
  recOverlay.querySelector('[data-act="close"]')?.focus();
}

function closeRec() {
  recOverlay.dataset.open = "false";
  recLastFocused?.focus?.();
}

/**
 * Inicializa el recomendador.
 * @param {Object} refs
 * @param {HTMLElement} refs.openBtn  botón que abre el asistente
 */
export function initRecommender({ openBtn }) {
  buildRecModal();
  openBtn?.addEventListener("click", openRec);
}
