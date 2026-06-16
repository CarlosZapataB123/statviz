/**
 * statusbar.js — Barra de estado inferior (estética de instrumento).
 *
 * Muestra una lectura compacta del dataset activo: número de observaciones,
 * número de variables y fuente. Reacciona a la carga y limpieza de datos.
 */

import { bus, EVENTS } from "../core/events.js";

let nEl = null;
let varsEl = null;
let sourceEl = null;
let dotEl = null;

const SOURCE_LABEL = {
  ejemplo: "ejemplo",
  csv: "CSV",
  manual: "manual",
};

/** Pinta la lectura a partir de un dataset (o el estado vacío). */
function renderStatus(dataset) {
  if (!dataset) {
    if (nEl) nEl.textContent = "—";
    if (varsEl) varsEl.textContent = "—";
    if (sourceEl) sourceEl.textContent = "sin datos";
    if (dotEl) dotEl.style.backgroundColor = "var(--ink-tertiary)";
    return;
  }
  const n = dataset.rows ? dataset.rows.length : 0;
  const v = dataset.variables ? dataset.variables.length : 0;
  if (nEl) nEl.textContent = String(n);
  if (varsEl) varsEl.textContent = String(v);
  if (sourceEl) {
    sourceEl.textContent = SOURCE_LABEL[dataset.source] || dataset.source || "—";
  }
  if (dotEl) dotEl.style.backgroundColor = "var(--positive)";
}

/**
 * Inicializa la barra de estado.
 * @param {Object} refs  Referencias a los elementos de lectura.
 */
export function initStatusbar({ nEl: n, varsEl: v, sourceEl: s, dotEl: d }) {
  nEl = n;
  varsEl = v;
  sourceEl = s;
  dotEl = d;

  renderStatus(null);

  bus.on(EVENTS.DATA_LOADED, ({ dataset }) => renderStatus(dataset));
  bus.on(EVENTS.DATA_CLEARED, () => renderStatus(null));
}
