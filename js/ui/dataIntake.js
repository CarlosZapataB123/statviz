/**
 * dataIntake.js — Ingesta de datos (ventana modal).
 *
 * Permite pegar, subir o arrastrar un archivo CSV/TSV; ejecuta el motor de
 * datos (parser + detector) y muestra una revisión de variables en la que cada
 * nivel de medición sugerido puede consultarse (justificación, confianza y
 * alternativas) y corregirse antes de confirmar. Al aceptar, publica el
 * Dataset por el bus para que el resto de la aplicación lo use.
 *
 * Coherente con el principio del proyecto: el usuario aporta sus datos; si no,
 * cada gráfico trae su propio ejemplo. Este módulo cubre la primera vía.
 */

import { bus, EVENTS } from "../core/events.js";
import { store } from "../core/state.js";
import { buildDatasetFromText } from "../data/dataset.js";
import { LEVEL_LABEL } from "../data/detector.js";
import { delimiterLabel } from "../data/parser.js";

const LEVEL_OPTIONS = ["nominal", "ordinal", "intervalo", "razon", "temporal", "id"];

let overlay = null;
let modal = null;
let bodyEl = null;
let footEl = null;
let lastFocused = null;
let currentDataset = null;

/* ------------------------------------------------------------------------
   Construcción del armazón del modal (una sola vez).
   ------------------------------------------------------------------------ */
function buildModal() {
  overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.dataset.open = "false";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="intake-title">
      <div class="modal__head">
        <span class="modal__title" id="intake-title">Cargar datos</span>
        <span class="modal__subtitle">CSV · TSV</span>
        <button class="icon-btn" type="button" data-act="close" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="modal__body" id="intake-body"></div>
      <div class="modal__foot" id="intake-foot"></div>
    </div>`;
  document.body.appendChild(overlay);

  modal = overlay.querySelector(".modal");
  bodyEl = overlay.querySelector("#intake-body");
  footEl = overlay.querySelector("#intake-foot");

  // Cierre por backdrop, botón y Escape.
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="close"], [data-act="cancel"]')) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.dataset.open === "true") close();
  });
}

/* ------------------------------------------------------------------------
   Paso 1 · Entrada.
   ------------------------------------------------------------------------ */
function renderIntake() {
  currentDataset = null;
  bodyEl.innerHTML = `
    <p class="intake__hint">
      Pega tu tabla o sube un archivo. Se detectan automáticamente el
      delimitador (coma, punto y coma o tabulador) y el separador decimal; tú
      revisas y confirmas el nivel de medición de cada variable.
    </p>
    <label class="intake__drop" id="intake-drop" tabindex="0">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4"/>
        <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
      </svg>
      <span class="intake__drop-main"><b>Elige un archivo</b> o arrástralo aquí</span>
      <span class="modal__subtitle">.csv · .tsv · .txt</span>
      <input type="file" id="intake-file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden />
    </label>
    <div class="intake__sep">o pega el texto</div>
    <textarea
      class="intake__textarea"
      id="intake-text"
      spellcheck="false"
      placeholder="edad,sexo,puntaje
34,M,7.5
28,F,8.2"
    ></textarea>
    <div id="intake-error"></div>`;

  footEl.innerHTML = `
    <span class="modal__foot-spacer"></span>
    <button class="btn btn--ghost" type="button" data-act="cancel">Cancelar</button>
    <button class="btn btn--primary" type="button" data-act="analyze">Analizar</button>`;

  wireIntakeStep();
}

function wireIntakeStep() {
  const drop = bodyEl.querySelector("#intake-drop");
  const fileInput = bodyEl.querySelector("#intake-file");
  const textarea = bodyEl.querySelector("#intake-text");

  footEl.querySelector('[data-act="analyze"]').addEventListener("click", () => {
    analyze(textarea.value);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) readFile(file, textarea);
  });

  // Arrastrar y soltar.
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.dataset.drag = "true";
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.dataset.drag = "false";
    })
  );
  drop.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) readFile(file, textarea);
  });

  setTimeout(() => textarea.focus(), 0);
}

function readFile(file, textarea) {
  const reader = new FileReader();
  reader.onload = () => {
    textarea.value = String(reader.result || "");
    analyze(textarea.value);
  };
  reader.onerror = () => showError("No se pudo leer el archivo.");
  reader.readAsText(file, "UTF-8");
}

function showError(message) {
  const box = bodyEl.querySelector("#intake-error");
  if (box) box.innerHTML = `<div class="intake__error">${message}</div>`;
}

/* ------------------------------------------------------------------------
   Análisis.
   ------------------------------------------------------------------------ */
function analyze(text) {
  const trimmed = (text || "").trim();
  if (trimmed === "") {
    showError("Pega una tabla o sube un archivo para continuar.");
    return;
  }
  let dataset;
  try {
    dataset = buildDatasetFromText(trimmed, { name: "Datos cargados" });
  } catch (err) {
    showError(`No se pudo interpretar el texto: ${err.message}`);
    return;
  }
  if (dataset.n === 0 || dataset.variables.length === 0) {
    showError("No se encontraron filas de datos. Revisa el contenido.");
    return;
  }
  currentDataset = dataset;
  renderReview(dataset);
}

/* ------------------------------------------------------------------------
   Paso 2 · Revisión de variables.
   ------------------------------------------------------------------------ */
function renderReview(dataset) {
  const m = dataset.meta || {};
  const warnings = [];
  if (m.raggedRows > 0) {
    warnings.push(
      `${m.raggedRows} fila(s) tenían un número de columnas distinto al de los encabezados; se ajustaron rellenando o recortando.`
    );
  }
  if (m.droppedEmptyRows > 0) {
    warnings.push(`Se descartaron ${m.droppedEmptyRows} fila(s) vacía(s).`);
  }

  const summary = `
    <div class="parse-summary">
      <span class="parse-summary__item">filas <b>${dataset.n}</b></span>
      <span class="parse-summary__item">variables <b>${dataset.variables.length}</b></span>
      <span class="parse-summary__item">delimitador <b>${delimiterLabel(dataset.delimiter)}</b></span>
      <span class="parse-summary__item">decimal <b>${dataset.decimal === "," ? "coma" : "punto"}</b></span>
    </div>`;

  const warningHtml = warnings.length
    ? `<div class="parse-warning">${warnings.join(" ")}</div>`
    : "";

  const rows = dataset.variables.map((v, i) => variableRow(v, i)).join("");

  bodyEl.innerHTML = `
    ${summary}
    ${warningHtml}
    <p class="var-review__lead">
      Revisa el <b>nivel de medición</b> propuesto para cada variable. Es una
      decisión teórica: el sistema solo sugiere a partir de la forma de los
      datos. Pulsa “¿por qué?” para ver la justificación y las alternativas.
    </p>
    <div class="var-table">
      <div class="var-row var-row--head">
        <span>Variable</span><span>Tipo</span><span>Nivel de medición</span><span></span>
      </div>
      ${rows}
    </div>`;

  footEl.innerHTML = `
    <button class="btn btn--ghost" type="button" data-act="back">← Volver</button>
    <span class="modal__foot-spacer"></span>
    <button class="btn btn--ghost" type="button" data-act="cancel">Cancelar</button>
    <button class="btn btn--primary" type="button" data-act="use">Usar estos datos</button>`;

  wireReviewStep();
}

function variableRow(v, i) {
  const meta =
    v.storageType === "numeric" && v.stats
      ? `n=${v.stats.n} · perdidos ${Math.round(v.missingPct * 100)}%`
      : `${v.unique} categorías · perdidos ${Math.round(v.missingPct * 100)}%`;

  const options = LEVEL_OPTIONS.map(
    (lv) =>
      `<option value="${lv}"${lv === v.level ? " selected" : ""}>${LEVEL_LABEL[lv]}</option>`
  ).join("");

  const alts = v.levelAlternatives && v.levelAlternatives.length
    ? `<br><b>Alternativas:</b><ul>${v.levelAlternatives
        .map((a) => `<li>${LEVEL_LABEL[a.level]} — ${a.note}</li>`)
        .join("")}</ul>`
    : "";

  return `
    <div class="var-row" data-i="${i}">
      <span class="var-name">${v.name}<span class="var-name__meta">${meta}</span></span>
      <span><span class="type-badge">${v.storageType}</span></span>
      <span class="level-cell">
        <select class="level-select" data-i="${i}" aria-label="Nivel de medición de ${v.name}">
          ${options}
        </select>
        <span class="level-confidence" data-c="${v.levelConfidence}">confianza ${v.levelConfidence}</span>
      </span>
      <button class="var-why" type="button" data-why="${i}" aria-expanded="false">¿por qué?</button>
      <div class="var-rationale" id="rat-${i}" hidden>
        ${v.levelRationale}${alts}
      </div>
    </div>`;
}

function wireReviewStep() {
  footEl.querySelector('[data-act="back"]').addEventListener("click", renderIntake);
  footEl.querySelector('[data-act="use"]').addEventListener("click", confirmDataset);

  bodyEl.querySelectorAll(".level-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const i = Number(sel.dataset.i);
      currentDataset.variables[i].level = sel.value;
      currentDataset.variables[i].isUserConfirmed = true;
    });
  });

  bodyEl.querySelectorAll(".var-why").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = bodyEl.querySelector(`#rat-${btn.dataset.why}`);
      const open = !panel.hidden;
      panel.hidden = open;
      btn.setAttribute("aria-expanded", String(!open));
      btn.textContent = open ? "¿por qué?" : "ocultar";
    });
  });
}

/* ------------------------------------------------------------------------
   Confirmación: cargar el dataset en el estado y anunciarlo.
   ------------------------------------------------------------------------ */
function confirmDataset() {
  if (!currentDataset) return;
  // El usuario validó la revisión: todos los niveles quedan confirmados.
  currentDataset.variables.forEach((v) => {
    v.isUserConfirmed = true;
  });

  store.patch("data", {
    rows: currentDataset.rows,
    variables: currentDataset.variables,
    source: "csv",
    exampleKey: null,
  });

  bus.emit(EVENTS.DATA_LOADED, { dataset: currentDataset });
  close();
}

/* ------------------------------------------------------------------------
   Apertura / cierre.
   ------------------------------------------------------------------------ */
export function openDataIntake() {
  if (!overlay) buildModal();
  lastFocused = document.activeElement;
  renderIntake();
  overlay.dataset.open = "true";
  document.body.style.overflow = "hidden";
}

function close() {
  if (!overlay) return;
  overlay.dataset.open = "false";
  document.body.style.overflow = "";
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

/**
 * Inicializa la ingesta de datos.
 * @param {Object} refs
 * @param {HTMLElement} refs.openBtn  Botón que abre el modal
 */
export function initDataIntake({ openBtn }) {
  buildModal();
  openBtn?.addEventListener("click", openDataIntake);
}
