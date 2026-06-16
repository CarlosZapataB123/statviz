/**
 * data.test.mjs — Pruebas del motor de datos (sin dependencias).
 *
 * Ejecutar con: node tests/data.test.mjs
 * Valida el parser (delimitadores, comillas, decimales, BOM, filas
 * irregulares), el detector (tipos y niveles de medición) y el transformador.
 */

import { parseCSV, delimiterLabel } from "../js/data/parser.js";
import {
  detectVariables,
  parseNumber,
  numericSummary,
  isMissing,
  LEVELS,
} from "../js/data/detector.js";
import {
  dropMissing,
  binNumeric,
  groupBy,
  contingencyTable,
} from "../js/data/transformer.js";
import {
  buildDatasetFromText,
  buildDatasetFromExample,
} from "../js/data/dataset.js";

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(msg);
  }
}
function eq(a, b, msg) {
  assert(a === b, `${msg} — esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
}
function near(a, b, msg, tol = 1e-9) {
  assert(Math.abs(a - b) <= tol, `${msg} — esperado ≈${b}, obtenido ${a}`);
}

/* ----------------------------------------------------------------------- */
/* Parser                                                                  */
/* ----------------------------------------------------------------------- */

// Coma como delimitador.
{
  const r = parseCSV("a,b,c\n1,2,3\n4,5,6");
  eq(r.delimiter, ",", "delimitador coma");
  eq(r.headers.join("|"), "a|b|c", "encabezados");
  eq(r.matrix.length, 2, "número de filas");
  eq(r.matrix[1][2], "6", "celda [1][2]");
}

// Punto y coma + decimal con coma (caso europeo).
{
  const r = parseCSV("x;y\n1,5;2,75\n3,0;4,25");
  eq(r.delimiter, ";", "delimitador punto y coma");
  eq(r.decimal, ",", "decimal coma");
  eq(parseNumber(r.matrix[0][0], r.decimal), 1.5, "parseNumber decimal coma");
}

// Tabulador.
{
  const r = parseCSV("a\tb\n1\t2");
  eq(r.delimiter, "\t", "delimitador tabulador");
  eq(delimiterLabel("\t"), "tabulador", "etiqueta tabulador");
}

// Campos entrecomillados con delimitador y salto de línea internos.
{
  const r = parseCSV('nombre,nota\n"Pérez, Ana","línea 1\nlínea 2"\n"Li","ok"');
  eq(r.matrix.length, 2, "comillas: filas");
  eq(r.matrix[0][0], "Pérez, Ana", "comillas: coma interna");
  eq(r.matrix[0][1], "línea 1\nlínea 2", "comillas: salto de línea interno");
}

// Comillas escapadas ("").
{
  const r = parseCSV('t\n"dijo ""hola"""');
  eq(r.matrix[0][0], 'dijo "hola"', "comillas escapadas");
}

// BOM + CRLF + fila vacía + fila irregular.
{
  const r = parseCSV("\ufeffa,b\r\n1,2\r\n\r\n3", { });
  eq(r.headers[0], "a", "BOM eliminado");
  eq(r.meta.droppedEmptyRows >= 1, true, "fila vacía descartada");
  eq(r.matrix.length, 2, "filas tras limpiar vacías");
  // La fila "3" es irregular (1 col frente a 2): se rellena y se cuenta.
  eq(r.matrix[1][1], "", "relleno de fila irregular");
  eq(r.meta.raggedRows >= 1, true, "fila irregular contada");
}

/* ----------------------------------------------------------------------- */
/* parseNumber / isMissing / numericSummary                                */
/* ----------------------------------------------------------------------- */

eq(Number.isNaN(parseNumber("NA")), true, "NA es NaN");
eq(isMissing("n/a"), true, "isMissing n/a");
eq(isMissing("0"), false, "0 no es perdido");
eq(parseNumber("1.234,56", ","), 1234.56, "miles punto, decimal coma");
eq(parseNumber("1,234.56", "."), 1234.56, "miles coma, decimal punto");
eq(parseNumber("50%"), 0.5, "porcentaje");

{
  const s = numericSummary([1, 2, 3, 4, 5]);
  eq(s.n, 5, "summary n");
  near(s.mean, 3, "summary media");
  near(s.median, 3, "summary mediana");
  near(s.sd, Math.sqrt(2.5), "summary desviación (n-1)");
  near(s.q1, 2, "summary Q1");
  near(s.q3, 4, "summary Q3");
}

/* ----------------------------------------------------------------------- */
/* Detector: tipos y niveles                                               */
/* ----------------------------------------------------------------------- */

function detectOne(header, values, decimal = ".") {
  const matrix = values.map((v) => [v]);
  return detectVariables([header], matrix, { decimal })[0];
}

// Continua no negativa → razón.
{
  const d = detectOne("tiempo", ["1.5", "2.3", "0.7", "4.1", "3.3", "2.0"]);
  eq(d.storageType, "numeric", "continua: tipo numérico");
  eq(d.numericKind, "continuous", "continua: subtipo");
  eq(d.level, LEVELS.RAZON, "continua no negativa → razón");
}

// Continua con negativos → intervalo.
{
  const d = detectOne("z", ["-1.2", "0.4", "2.1", "-0.8", "1.0", "-2.5"]);
  eq(d.level, LEVELS.INTERVALO, "continua con negativos → intervalo");
}

// Enteros 1..5 (Likert) → ordinal, con alternativa nominal.
{
  const d = detectOne("likert", ["1", "2", "3", "4", "5", "3", "2", "4"]);
  eq(d.storageType, "numeric", "Likert: numérico");
  eq(d.level, LEVELS.ORDINAL, "Likert 1..5 → ordinal sugerido");
  eq(d.levelConfidence, "baja", "Likert: confianza baja (ambigüedad)");
  eq(d.levelAlternatives.some((a) => a.level === LEVELS.NOMINAL), true, "Likert: alternativa nominal ofrecida");
}

// Binaria 0/1 → nominal.
{
  const d = detectOne("indicador", ["0", "1", "1", "0", "1", "0"]);
  eq(d.level, LEVELS.NOMINAL, "0/1 → nominal");
}

// Conteo entero amplio → razón.
{
  const d = detectOne("conteo", ["0", "3", "7", "12", "5", "9", "21", "15", "2", "8"]);
  eq(d.level, LEVELS.RAZON, "conteo entero amplio → razón");
}

// Texto de baja cardinalidad → nominal.
{
  const d = detectOne("ciudad", ["Madrid", "Bilbao", "Madrid", "Sevilla", "Bilbao"]);
  eq(d.storageType, "categorical", "texto: categórico");
  eq(d.level, LEVELS.NOMINAL, "texto sin orden → nominal");
  eq(d.categories[0].value, "Madrid", "categoría más frecuente");
}

// Léxico ordinal (bajo/medio/alto) → ordinal.
{
  const d = detectOne("nivel", ["bajo", "alto", "medio", "alto", "bajo", "medio"]);
  eq(d.level, LEVELS.ORDINAL, "bajo/medio/alto → ordinal");
}

// Lógico (sí/no) → nominal dicotómica.
{
  const d = detectOne("fuma", ["sí", "no", "no", "sí", "no"]);
  eq(d.storageType, "boolean", "sí/no → lógico");
  eq(d.level, LEVELS.NOMINAL, "sí/no → nominal");
}

// Identificador de alta cardinalidad.
{
  const ids = Array.from({ length: 30 }, (_, i) => `case_${i + 1}`);
  const d = detectOne("id", ids);
  eq(d.storageType, "identifier", "alta cardinalidad → identificador");
  eq(d.level, LEVELS.ID, "identificador → nivel id");
}

// Conteo de perdidos.
{
  const d = detectOne("v", ["1.0", "", "2.5", "NA", "3.1"]);
  eq(d.missing, 2, "perdidos contados");
}

/* ----------------------------------------------------------------------- */
/* Transformador                                                           */
/* ----------------------------------------------------------------------- */

{
  const rows = [
    { g: "A", y: 10 },
    { g: "A", y: 20 },
    { g: "B", y: 30 },
    { g: "B", y: null },
  ];
  const { rows: kept, removed } = dropMissing(rows, ["y"]);
  eq(removed, 1, "dropMissing elimina 1");
  eq(kept.length, 3, "dropMissing conserva 3");

  const g = groupBy(kept, "g", "y", "mean");
  eq(g.length, 2, "groupBy: 2 grupos");
  near(g.find((x) => x.group === "A").value, 15, "groupBy media A");
  near(g.find((x) => x.group === "B").value, 30, "groupBy media B");
}

{
  const bins = binNumeric([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { bins: 5 });
  eq(bins.length, 5, "binNumeric: 5 clases");
  const totalCount = bins.reduce((a, b) => a + b.count, 0);
  eq(totalCount, 10, "binNumeric: conserva n");
}

{
  const rows = [
    { s: "M", d: "sí" },
    { s: "M", d: "no" },
    { s: "F", d: "sí" },
    { s: "F", d: "sí" },
  ];
  const ct = contingencyTable(rows, "s", "d");
  eq(ct.rows.join(","), "F,M", "contingencia: filas ordenadas");
  eq(ct.cols.length, 2, "contingencia: 2 columnas");
  const fSi = ct.matrix[ct.rows.indexOf("F")][ct.cols.indexOf("sí")];
  eq(fSi, 2, "contingencia: F∧sí = 2");
}

/* ----------------------------------------------------------------------- */
/* Dataset                                                                 */
/* ----------------------------------------------------------------------- */

{
  const text = "edad,sexo,puntaje\n34,M,7.5\n28,F,8.2\n,F,6.9\n41,M,";
  const ds = buildDatasetFromText(text, { name: "Prueba" });
  eq(ds.source, "csv", "dataset: fuente csv");
  eq(ds.n, 4, "dataset: n filas");
  eq(ds.variables.length, 3, "dataset: 3 variables");
  eq(typeof ds.rows[0].edad, "number", "dataset: edad numérica tipada");
  eq(ds.rows[2].edad, null, "dataset: perdido → null");
  const sexo = ds.variables.find((v) => v.name === "sexo");
  eq(sexo.level, LEVELS.NOMINAL, "dataset: sexo nominal");
}

{
  const example = {
    name: "Mini",
    source: "Demo",
    variables: [
      { name: "grupo", type: "categorical", level: "nominal" },
      { name: "valor", type: "numeric", level: "razon", unit: "u" },
    ],
    rows: [
      { grupo: "A", valor: 10 },
      { grupo: "B", valor: 20 },
      { grupo: "A", valor: 30 },
    ],
  };
  const ds = buildDatasetFromExample(example);
  eq(ds.source, "ejemplo", "ejemplo: fuente");
  eq(ds.variables[1].isUserConfirmed, true, "ejemplo: nivel confirmado de origen");
  near(ds.variables[1].stats.mean, 20, "ejemplo: media calculada");
  eq(ds.variables[0].categories.length, 2, "ejemplo: categorías calculadas");
}

/* ----------------------------------------------------------------------- */
/* Reporte                                                                 */
/* ----------------------------------------------------------------------- */

console.log(`\n  Pruebas del motor de datos`);
console.log(`  ${passed} correctas, ${failed} fallidas\n`);
if (failed > 0) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
} else {
  console.log("  ✓ Todo correcto\n");
}
