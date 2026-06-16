/**
 * parser.js — Lector de CSV/TSV sin dependencias.
 *
 * Resuelve los problemas reales de la ingesta tabular:
 *  - Detección de delimitador (coma, punto y coma, tabulador, barra vertical).
 *    Relevante en contextos hispanos/europeos, donde es habitual `;` como
 *    separador de campo y `,` como separador decimal.
 *  - Comillas según RFC 4180: campos entrecomillados con delimitadores y
 *    saltos de línea internos, y comillas escapadas ("").
 *  - Finales de línea LF, CRLF y CR; marca de orden de bytes (BOM).
 *  - Detección del separador decimal y normalización numérica.
 *
 * No infiere tipos ni niveles de medición: solo entrega una matriz de cadenas
 * y los metadatos del formato. La interpretación corre a cargo de detector.js.
 */

/** Delimitadores candidatos, en orden de preferencia ante empate. */
const DELIMITER_CANDIDATES = [",", ";", "\t", "|"];

/** Tamaño de muestra (en filas) para inferir delimitador y decimal. */
const SAMPLE_ROWS = 50;

/**
 * Máquina de estados que convierte el texto en una matriz de cadenas,
 * respetando comillas y saltos de línea internos.
 * @param {string} text
 * @param {string} delimiter
 * @returns {string[][]}
 */
function tokenize(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const n = text.length;
  let i = 0;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // comilla escapada
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += text[i + 1] === "\n" ? 2 : 1; // CRLF o CR
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // Último campo / última fila.
  row.push(field);
  rows.push(row);
  return rows;
}

/** Cuenta apariciones de un carácter fuera de comillas en una línea. */
function countOutsideQuotes(line, ch) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ch && !inQuotes) count += 1;
  }
  return count;
}

/**
 * Infiere el delimitador a partir de la primera línea no vacía: elige el
 * candidato con más apariciones consistentes; ante empate, sigue el orden de
 * preferencia.
 */
function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\r|\n/).find((l) => l.trim() !== "") || "";
  let best = ",";
  let bestCount = -1;
  for (const cand of DELIMITER_CANDIDATES) {
    const count = countOutsideQuotes(firstLine, cand);
    if (count > bestCount) {
      best = cand;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : ",";
}

/**
 * Infiere el separador decimal sobre una muestra de campos. Si el delimitador
 * es la coma, el decimal solo puede ser el punto. En otro caso, compara
 * patrones de coma-decimal frente a punto-decimal.
 */
function detectDecimal(matrix, delimiter) {
  if (delimiter === ",") return ".";
  let comma = 0;
  let dot = 0;
  const reComma = /^-?\d{1,3}(\.\d{3})*,\d+$|^-?\d+,\d+$/;
  const reDot = /^-?\d{1,3}(,\d{3})*\.\d+$|^-?\d+\.\d+$/;
  const limit = Math.min(matrix.length, SAMPLE_ROWS);
  for (let r = 0; r < limit; r += 1) {
    for (const cell of matrix[r]) {
      const v = cell.trim();
      if (reComma.test(v)) comma += 1;
      else if (reDot.test(v)) dot += 1;
    }
  }
  return comma > dot ? "," : ".";
}

/**
 * Analiza texto CSV/TSV completo.
 * @param {string} text
 * @param {Object} [opts]
 * @param {string} [opts.delimiter]  Forzar delimitador (si no, se detecta)
 * @param {boolean} [opts.header=true]  La primera fila contiene encabezados
 * @returns {{
 *   headers: string[],
 *   matrix: string[][],
 *   delimiter: string,
 *   decimal: "."|",",
 *   meta: { totalRows:number, droppedEmptyRows:number, raggedRows:number }
 * }}
 */
export function parseCSV(text, opts = {}) {
  if (typeof text !== "string") {
    throw new TypeError("parseCSV espera una cadena de texto.");
  }
  // Quitar BOM.
  let src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // Normalizar el final del archivo para no generar una fila vacía espuria.
  src = src.replace(/(\r\n|\r|\n)+$/, "");

  const header = opts.header !== false;
  const delimiter = opts.delimiter || detectDelimiter(src);

  const all = tokenize(src, delimiter);

  // Descartar filas completamente vacías (todas las celdas en blanco).
  const isEmptyRow = (row) => row.every((c) => c.trim() === "");
  const nonEmpty = all.filter((row) => !isEmptyRow(row));
  const droppedEmptyRows = all.length - nonEmpty.length;

  let headers;
  let dataRows;
  if (header) {
    headers = (nonEmpty[0] || []).map((h, idx) => {
      const name = h.trim();
      return name === "" ? `columna_${idx + 1}` : name;
    });
    dataRows = nonEmpty.slice(1);
  } else {
    const width = nonEmpty[0] ? nonEmpty[0].length : 0;
    headers = Array.from({ length: width }, (_, idx) => `columna_${idx + 1}`);
    dataRows = nonEmpty;
  }

  // Igualar el ancho de cada fila al de los encabezados (rellena o recorta).
  const width = headers.length;
  let raggedRows = 0;
  const matrix = dataRows.map((row) => {
    if (row.length !== width) raggedRows += 1;
    const fixed = row.slice(0, width);
    while (fixed.length < width) fixed.push("");
    return fixed.map((c) => c.trim());
  });

  const decimal = detectDecimal(matrix, delimiter);

  return {
    headers,
    matrix,
    delimiter,
    decimal,
    meta: {
      totalRows: matrix.length,
      droppedEmptyRows,
      raggedRows,
    },
  };
}

/** Nombre legible del delimitador (para la UI). */
export function delimiterLabel(delimiter) {
  return (
    {
      ",": "coma",
      ";": "punto y coma",
      "\t": "tabulador",
      "|": "barra vertical",
    }[delimiter] || delimiter
  );
}
