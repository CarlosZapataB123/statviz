/**
 * configPanel.js — Panel de configuración del gráfico (pestaña Configuración).
 *
 * Presenta dos clases de controles según el gráfico:
 *  - Asignación de variables: un selector por rol, poblado con las variables
 *    compatibles del conjunto de datos (gráficos descriptivos y de asociación).
 *  - Parámetros: entradas numéricas (media, desviación, n, p, λ, gl…) para los
 *    gráficos teóricos como las distribuciones de probabilidad.
 *
 * Al cambiar cualquier control, publica la nueva configuración para que el
 * lienzo se redibuje. La intención es que el usuario sienta que ajusta un
 * gráfico, no que rellena un formulario: cada control explica su papel.
 */

import { bus, EVENTS } from "../core/events.js";
import {
  getRoles,
  getParamRoles,
  isDataless,
  usesAllNumeric,
  compatibleVariables,
} from "../charts/builders.js";

/**
 * Dibuja el panel de configuración.
 * @param {HTMLElement} panelEl
 * @param {Object} payload  { chart, dataset, config }
 */
export function renderConfig(panelEl, payload) {
  const { chart, dataset, config } = payload;
  const blocks = [];

  if (usesAllNumeric(chart.id)) {
    const numeric = dataset.variables.filter((v) => v.storageType === "numeric");
    blocks.push(`
      <div class="field-group">
        <span class="field-group__label">Variables</span>
        <p class="field-group__hint">
          Usa automáticamente todas las variables numéricas del conjunto
          (${numeric.length}): ${numeric.map((v) => v.name).join(", ")}.
        </p>
      </div>`);
  }

  const params = getParamRoles(chart.id);
  if (params.length) {
    blocks.push(`
      <div class="field-group">
        <span class="field-group__label">Parámetros</span>
        <div class="cfg-fields">${params.map((p) => paramControl(p, config)).join("")}</div>
      </div>`);
  }

  const roles = getRoles(chart.id);
  if (roles.length) {
    const heading = usesAllNumeric(chart.id) ? "Opciones" : "Asignación de variables";
    blocks.push(`
      <div class="field-group">
        <span class="field-group__label">${heading}</span>
        <div class="cfg-fields">${roles.map((r) => roleControl(r, dataset, config)).join("")}</div>
      </div>`);
  }

  blocks.push(sourceNote(chart, dataset));
  panelEl.innerHTML = blocks.join("");
  wire(panelEl, payload);
}

/** Nota sobre el origen de los datos (o aviso de modelo teórico). */
function sourceNote(chart, dataset) {
  if (isDataless(chart.id)) {
    return `<p class="cfg-source">Modelo <b>teórico</b>: la figura se genera a partir de los parámetros, sin datos.</p>`;
  }
  const isExample = dataset.source === "ejemplo";
  const text = isExample
    ? `Mostrando el <b>ejemplo</b> del gráfico (${dataset.name}). Carga tus datos para usarlos aquí.`
    : `Usando <b>tus datos</b> (${dataset.name}, n = ${dataset.n}).`;
  return `<p class="cfg-source">${text}</p>`;
}

/** Selector para un rol de variable. */
function roleControl(role, dataset, config) {
  const options = compatibleVariables(dataset, role);
  const current = config[role.key] || "";
  const optionHtml = options
    .map((v) => `<option value="${v.name}"${v.name === current ? " selected" : ""}>${v.name}</option>`)
    .join("");
  const noneOption = role.required
    ? ""
    : `<option value=""${current === "" ? " selected" : ""}>— ninguna —</option>`;
  const disabled = options.length === 0 ? " disabled" : "";
  const empty = options.length === 0
    ? `<span class="cfg-empty">No hay variables compatibles en estos datos.</span>`
    : "";
  return `
    <div class="cfg-field">
      <label class="cfg-field__label" for="cfg-${role.key}">${role.label}</label>
      <select class="level-select" id="cfg-${role.key}" data-role="${role.key}"${disabled}>
        ${noneOption}${optionHtml}
      </select>
      ${role.hint ? `<span class="cfg-field__hint">${role.hint}</span>` : ""}
      ${empty}
    </div>`;
}

/** Entrada numérica para un parámetro. */
function paramControl(p, config) {
  const value = config[p.key] != null ? config[p.key] : p.default;
  const attrs = [
    p.min != null ? `min="${p.min}"` : "",
    p.max != null ? `max="${p.max}"` : "",
    p.step != null ? `step="${p.step}"` : "",
  ].join(" ");
  return `
    <div class="cfg-field">
      <label class="cfg-field__label" for="cfgp-${p.key}">${p.label}</label>
      <input class="cfg-number" type="number" id="cfgp-${p.key}" data-param="${p.key}"
             value="${value}" ${attrs} inputmode="decimal" />
      ${p.hint ? `<span class="cfg-field__hint">${p.hint}</span>` : ""}
    </div>`;
}

/** Recoge selectores y parámetros y publica la nueva configuración. */
function wire(panelEl, payload) {
  const emit = () => {
    const next = { ...payload.config };
    panelEl.querySelectorAll(".level-select[data-role]").forEach((s) => {
      next[s.dataset.role] = s.value || undefined;
    });
    panelEl.querySelectorAll(".cfg-number[data-param]").forEach((inp) => {
      let v = Number(inp.value);
      if (!Number.isFinite(v)) v = Number(inp.defaultValue);
      if (inp.min !== "" && v < Number(inp.min)) v = Number(inp.min);
      if (inp.max !== "" && v > Number(inp.max)) v = Number(inp.max);
      next[inp.dataset.param] = v;
    });
    bus.emit(EVENTS.CHART_CONFIG_CHANGED, { config: next });
  };

  panelEl.querySelectorAll(".level-select[data-role]").forEach((sel) =>
    sel.addEventListener("change", emit)
  );
  panelEl.querySelectorAll(".cfg-number[data-param]").forEach((inp) =>
    inp.addEventListener("change", emit)
  );
}
