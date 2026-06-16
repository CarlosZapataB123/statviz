/**
 * dataset.js — Modelo canónico de conjunto de datos y sus constructores.
 *
 * Unifica la salida del parser y del detector en una sola estructura que el
 * resto de la aplicación consume (barra de estado, panel de variables, motor
 * de gráficos e interpretación). Hay dos puntos de entrada:
 *  - buildDatasetFromText: a partir de texto CSV/TSV pegado o subido.
 *  - buildDatasetFromExample: a partir de un ejemplo del catálogo, cuyos
 *    niveles de medición vienen declarados (autoritativos) y se enriquecen con
 *    estadística y recuentos calculados.
 *
 * @typedef {Object} Dataset
 * @property {string} name
 * @property {"csv"|"manual"|"ejemplo"} source
 * @property {string|null} attribution
 * @property {string|null} delimiter
 * @property {"."|","|null} decimal
 * @property {Array<Object>} variables   Descriptores (véase detector.js)
 * @property {Array<Object>} rows        Filas tipadas (columna → valor)
 * @property {number} n
 * @property {Object} meta
 */

import { parseCSV } from "./parser.js";
import {
  detectVariables,
  parseNumber,
  isMissing,
  numericSummary,
  frequencyTable,
} from "./detector.js";

/**
 * Tipa una matriz de cadenas según los descriptores, devolviendo filas como
 * objetos { nombreVariable: valor }, con números reales en columnas numéricas,
 * cadenas en categóricas y null en los perdidos.
 */
function buildRows(headers, matrix, variables, decimal) {
  const typeByName = new Map(variables.map((v) => [v.name, v.storageType]));
  return matrix.map((row) => {
    const obj = {};
    headers.forEach((name, col) => {
      const raw = row[col];
      const type = typeByName.get(name);
      if (isMissing(raw)) {
        obj[name] = null;
      } else if (type === "numeric") {
        const num = parseNumber(raw, decimal);
        obj[name] = Number.isFinite(num) ? num : null;
      } else {
        obj[name] = String(raw).trim();
      }
    });
    return obj;
  });
}

/**
 * Construye un Dataset a partir de texto CSV/TSV.
 * @param {string} text
 * @param {Object} [opts]
 * @param {string} [opts.name="Datos cargados"]
 * @param {string} [opts.delimiter]  Forzar delimitador
 * @param {boolean} [opts.header=true]
 * @returns {Dataset}
 */
export function buildDatasetFromText(text, opts = {}) {
  const parsed = parseCSV(text, {
    delimiter: opts.delimiter,
    header: opts.header,
  });
  const variables = detectVariables(parsed.headers, parsed.matrix, {
    decimal: parsed.decimal,
  });
  const rows = buildRows(parsed.headers, parsed.matrix, variables, parsed.decimal);

  return {
    name: opts.name || "Datos cargados",
    source: "csv",
    attribution: null,
    delimiter: parsed.delimiter,
    decimal: parsed.decimal,
    variables,
    rows,
    n: rows.length,
    meta: parsed.meta,
  };
}

/**
 * Construye un Dataset a partir de un ejemplo del catálogo. Respeta el nivel de
 * medición declarado (el ejemplo conoce la teoría de sus variables) y añade
 * estadística, recuentos y categorías calculadas para alimentar la UI.
 * @param {Object} example  Entrada de examples.js: { name, description, source, variables, rows }
 * @returns {Dataset}
 */
export function buildDatasetFromExample(example) {
  const rows = example.rows || [];
  const decl = example.variables || [];

  const NUMERIC_TYPES = new Set([
    "numeric",
    "continua",
    "continuous",
    "discreta",
    "discrete",
  ]);

  const variables = decl.map((dv, index) => {
    const values = rows.map((r) => r[dv.name]);
    const present = values.filter((v) => !isMissing(v));
    const missing = values.length - present.length;
    const uniqueSet = new Set(present.map((v) => String(v).trim()));

    const isNumeric = NUMERIC_TYPES.has(dv.type);
    const isTemporal = dv.type === "temporal";
    const storageType = isTemporal
      ? "temporal"
      : isNumeric
        ? "numeric"
        : "categorical";
    const numericKind = isNumeric
      ? dv.type === "discreta" || dv.type === "discrete"
        ? "discrete"
        : "continuous"
      : null;

    const stats = isNumeric
      ? numericSummary(
          values.map((v) => (typeof v === "number" ? v : parseNumber(v, ".")))
        )
      : null;
    const categories = isNumeric || isTemporal ? null : frequencyTable(values);

    // Nivel declarado por el ejemplo (autoritativo); confirmado de origen.
    const level = dv.level || (isNumeric ? "razon" : "nominal");

    return {
      name: dv.name,
      index,
      storageType,
      numericKind,
      level,
      levelSuggested: level,
      levelConfidence: "alta",
      levelRationale:
        "Nivel declarado por el conjunto de ejemplo, cuya teoría de medición se conoce de antemano.",
      levelAlternatives: [],
      isUserConfirmed: true,
      unit: dv.unit || null,
      missing,
      missingPct: values.length ? missing / values.length : 0,
      unique: uniqueSet.size,
      sampleValues: [...uniqueSet].slice(0, 6),
      categories,
      stats,
    };
  });

  return {
    name: example.name || "Ejemplo",
    source: "ejemplo",
    attribution: example.source || null,
    delimiter: null,
    decimal: null,
    variables,
    rows,
    n: rows.length,
    meta: { totalRows: rows.length, droppedEmptyRows: 0, raggedRows: 0 },
  };
}

/** Recuento de variables por nivel de medición (para resúmenes de la UI). */
export function levelBreakdown(dataset) {
  const counts = {};
  for (const v of dataset.variables) {
    counts[v.level] = (counts[v.level] || 0) + 1;
  }
  return counts;
}
