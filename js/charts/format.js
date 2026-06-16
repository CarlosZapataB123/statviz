/**
 * format.js — Ayudantes de formato compartidos por los constructores.
 *
 * Centralizados para evitar duplicarlos entre categorías de gráficos.
 */

/** Formatea un número con d decimales (es-ES); "—" si no es finito. */
export function num(x, d = 2) {
  return Number.isFinite(x)
    ? x.toLocaleString("es-ES", {
        maximumFractionDigits: d,
        minimumFractionDigits: 0,
      })
    : "—";
}

/** Etiqueta de una variable con su unidad, si la tiene. */
export function label(dataset, name) {
  const v = dataset.variables.find((x) => x.name === name);
  return v && v.unit ? `${name} (${v.unit})` : name;
}
