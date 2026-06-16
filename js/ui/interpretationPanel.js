/**
 * interpretationPanel.js — Panel de interpretación (pestaña Interpretación).
 *
 * Convierte la "lectura" estructurada que devuelve cada constructor en una
 * explicación legible: un enunciado principal basado en los valores, un
 * resumen de estadísticos, notas de lectura y advertencias. No usa textos
 * fijos: todo procede de los datos del gráfico actual. La interpretación
 * automática más rica (recomendaciones, supuestos) llega en la Fase 6.
 */

/**
 * Dibuja el panel de interpretación.
 * @param {HTMLElement} panelEl
 * @param {Object} payload  { reading, warnings }
 */
export function renderInterpretation(panelEl, payload) {
  const reading = payload && payload.reading;
  if (!reading) {
    panelEl.innerHTML = `
      <div class="inspector-empty">
        <p class="inspector-empty__text">
          La lectura guiada aparecerá aquí cuando el gráfico se dibuje con datos.
        </p>
      </div>`;
    return;
  }

  const stats = (reading.stats || [])
    .map(
      (s) => `<div class="reading-stat"><dt>${s.k}</dt><dd>${s.v}</dd></div>`
    )
    .join("");

  const notes = (reading.notes || [])
    .map((n) => `<li>${n}</li>`)
    .join("");

  const cautions = (reading.cautions || [])
    .map((c) => `<li>${c}</li>`)
    .join("");

  const warnings = (payload.warnings || [])
    .map((w) => `<li>${w}</li>`)
    .join("");

  panelEl.innerHTML = `
    <div class="field-group">
      <span class="field-group__label">Lectura</span>
      <p class="reading-lead">${reading.lead || ""}</p>
    </div>

    ${stats ? `
    <div class="field-group">
      <span class="field-group__label">Resumen</span>
      <dl class="reading-stats">${stats}</dl>
    </div>` : ""}

    ${notes ? `
    <div class="field-group">
      <span class="field-group__label">Cómo leerlo</span>
      <ul class="reading-list">${notes}</ul>
    </div>` : ""}

    ${cautions || warnings ? `
    <div class="field-group">
      <span class="field-group__label">Advertencias</span>
      <ul class="reading-list reading-list--caution">${cautions}${warnings}</ul>
    </div>` : ""}`;
}
