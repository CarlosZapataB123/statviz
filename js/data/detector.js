/**
 * detector.js — Inferencia de tipo de dato y nivel de medición.
 *
 * Para cada columna produce un descriptor con:
 *  - Tipo de almacenamiento (numérico, categórico, lógico, temporal,
 *    identificador, vacío) y, si es numérico, si es discreto o continuo.
 *  - Una SUGERENCIA de nivel de medición (nominal, ordinal, intervalo, razón),
 *    con su justificación, una confianza cualitativa y alternativas plausibles.
 *  - Resumen estadístico (numéricas) o tabla de categorías (categóricas) y el
 *    recuento de valores perdidos y únicos.
 *
 * Advertencia metodológica deliberada: el nivel de medición NO es una
 * propiedad de los datos, sino una decisión teórica sobre qué representa la
 * variable y cómo se midió (Stevens, 1946; Hernández-Sampieri; Kerlinger). El
 * programa solo PROPONE; la confirmación corresponde siempre al investigador.
 * Por eso cada descriptor expone `levelAlternatives` y queda `isUserConfirmed`
 * en falso hasta que la persona lo valide.
 */

/** Niveles de medición reconocidos. */
export const LEVELS = Object.freeze({
  NOMINAL: "nominal",
  ORDINAL: "ordinal",
  INTERVALO: "intervalo",
  RAZON: "razon",
  TEMPORAL: "temporal",
  ID: "id",
});

/** Etiquetas legibles de cada nivel. */
export const LEVEL_LABEL = Object.freeze({
  nominal: "Nominal",
  ordinal: "Ordinal",
  intervalo: "Intervalo",
  razon: "Razón",
  temporal: "Temporal",
  id: "Identificador",
});

/** Tokens que se interpretan como valor perdido (sin distinción de may/min). */
const MISSING_TOKENS = new Set([
  "",
  "na",
  "n/a",
  "null",
  "nan",
  "none",
  "nd",
  "s/d",
]);

/**
 * Léxico ordinal: familias de categorías que suelen implicar orden. La
 * detección es orientativa; el usuario puede corregirla.
 */
const ORDINAL_LEXICON = [
  ["totalmente en desacuerdo", "en desacuerdo", "neutral", "de acuerdo", "totalmente de acuerdo"],
  ["muy en desacuerdo", "en desacuerdo", "ni de acuerdo ni en desacuerdo", "de acuerdo", "muy de acuerdo"],
  ["nunca", "casi nunca", "a veces", "casi siempre", "siempre"],
  ["nada", "poco", "algo", "bastante", "mucho"],
  ["muy bajo", "bajo", "medio", "alto", "muy alto"],
  ["bajo", "medio", "alto"],
  ["leve", "moderado", "grave", "severo"],
  ["primaria", "secundaria", "bachillerato", "técnico", "universitario", "posgrado"],
  ["malo", "regular", "bueno", "muy bueno", "excelente"],
  ["strongly disagree", "disagree", "neutral", "agree", "strongly agree"],
  ["never", "rarely", "sometimes", "often", "always"],
  ["low", "medium", "high"],
  ["poor", "fair", "good", "very good", "excellent"],
];

/** Quita acentos y normaliza a minúsculas para comparar categorías. */
function stripAccents(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** ¿La celda representa un valor perdido? */
export function isMissing(value) {
  if (value == null) return true;
  return MISSING_TOKENS.has(String(value).trim().toLowerCase());
}

/**
 * Convierte una celda a número respetando el separador decimal detectado.
 * Devuelve NaN si no es numérica.
 * @param {string} value
 * @param {"."|","} decimal
 */
export function parseNumber(value, decimal = ".") {
  if (isMissing(value)) return NaN;
  let s = String(value).trim();
  if (decimal === ",") {
    s = s.replace(/\./g, "").replace(",", "."); // miles '.' y decimal ','
  } else {
    s = s.replace(/,/g, ""); // miles ','
  }
  // Permite signo, exponente y porcentaje simple.
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?%?$/i.test(s)) return NaN;
  const pct = s.endsWith("%");
  const num = Number(pct ? s.slice(0, -1) : s);
  return pct ? num / 100 : num;
}

/** Resumen estadístico de un vector numérico (ignora NaN). */
export function numericSummary(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) {
    return { n: 0, min: null, max: null, mean: null, median: null, sd: null, q1: null, q3: null, range: null };
  }
  const quantile = (p) => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return xs[lo];
    return xs[lo] + (xs[hi] - xs[lo]) * (idx - lo);
  };
  const sum = xs.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance =
    n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    min: xs[0],
    max: xs[n - 1],
    mean,
    median: quantile(0.5),
    sd: Math.sqrt(variance),
    q1: quantile(0.25),
    q3: quantile(0.75),
    range: xs[n - 1] - xs[0],
  };
}

/** Tabla de frecuencias de un vector de categorías (orden descendente). */
export function frequencyTable(values) {
  const present = values.filter((v) => !isMissing(v)).map((v) => String(v).trim());
  const counts = new Map();
  for (const v of present) counts.set(v, (counts.get(v) || 0) + 1);
  const total = present.length || 1;
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, pct: count / total }))
    .sort((a, b) => b.count - a.count);
}

/** ¿La cadena tiene forma de fecha reconocible (ISO o dd/mm/aaaa)? */
function looksLikeDate(value) {
  const s = String(value).trim();
  return (
    /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(s) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)
  );
}

/** ¿El conjunto de categorías coincide con alguna familia ordinal conocida? */
function matchesOrdinalLexicon(categoryValues) {
  const set = new Set(categoryValues.map(stripAccents));
  for (const scale of ORDINAL_LEXICON) {
    const scaleSet = new Set(scale);
    let overlap = 0;
    for (const c of set) if (scaleSet.has(c)) overlap += 1;
    // La mayoría de las categorías pertenecen a una escala ordenada conocida.
    if (set.size >= 2 && overlap >= Math.ceil(set.size * 0.6)) return true;
  }
  return false;
}

/**
 * Propone un nivel de medición y su justificación a partir del perfil
 * estructural de la columna. Devuelve { level, confidence, rationale,
 * alternatives }.
 */
function suggestLevel(profile) {
  const {
    storageType,
    numericKind,
    isInteger,
    uniqueCount,
    min,
    max,
    hasNegative,
    categoryValues,
  } = profile;

  const NOTE_THEORY =
    "El nivel de medición es una decisión teórica sobre qué representa la variable; confírmalo según su definición y forma de medición.";

  if (storageType === "temporal") {
    return {
      level: LEVELS.TEMPORAL,
      confidence: "alta",
      rationale:
        "Los valores tienen forma de fecha. Se tratan como variable temporal para ordenar y construir series; como escala equivale a un nivel de intervalo.",
      alternatives: [{ level: LEVELS.INTERVALO, note: "Si interesa la magnitud entre fechas." }],
    };
  }

  if (storageType === "identifier") {
    return {
      level: LEVELS.ID,
      confidence: "alta",
      rationale:
        "Casi todos los valores son distintos: la columna identifica casos, no mide un atributo. No participa como variable en los análisis.",
      alternatives: [{ level: LEVELS.NOMINAL, note: "Solo si las etiquetas agrupan casos." }],
    };
  }

  if (storageType === "boolean") {
    return {
      level: LEVELS.NOMINAL,
      confidence: "alta",
      rationale: `Variable dicotómica (dos categorías sin orden intrínseco). ${NOTE_THEORY}`,
      alternatives: [{ level: LEVELS.ORDINAL, note: "Solo si las dos categorías implican un orden." }],
    };
  }

  if (storageType === "categorical") {
    if (matchesOrdinalLexicon(categoryValues)) {
      return {
        level: LEVELS.ORDINAL,
        confidence: "media",
        rationale: `Las categorías coinciden con una escala ordenada (p. ej. tipo Likert): hay orden, pero las distancias entre niveles no son necesariamente iguales. ${NOTE_THEORY}`,
        alternatives: [{ level: LEVELS.NOMINAL, note: "Si decides ignorar el orden." }],
      };
    }
    if (uniqueCount === 2) {
      return {
        level: LEVELS.NOMINAL,
        confidence: "alta",
        rationale: `Variable categórica dicotómica (dos categorías sin orden). ${NOTE_THEORY}`,
        alternatives: [{ level: LEVELS.ORDINAL, note: "Solo si las categorías están ordenadas." }],
      };
    }
    return {
      level: LEVELS.NOMINAL,
      confidence: "alta",
      rationale: `Categorías sin orden cuantificable. ${NOTE_THEORY}`,
      alternatives: [{ level: LEVELS.ORDINAL, note: "Si las categorías admiten un orden (p. ej. niveles)." }],
    };
  }

  if (storageType === "numeric") {
    // Binaria 0/1.
    if (isInteger && uniqueCount === 2 && min === 0 && max === 1) {
      return {
        level: LEVELS.NOMINAL,
        confidence: "alta",
        rationale: `Variable indicadora 0/1: codifica presencia/ausencia o pertenencia a un grupo, no una magnitud. ${NOTE_THEORY}`,
        alternatives: [{ level: LEVELS.RAZON, note: "Solo si 0/1 representan un conteo real." }],
      };
    }
    // Pocos enteros consecutivos: típico de escalas tipo Likert o códigos.
    const likertLike =
      isInteger && uniqueCount > 2 && uniqueCount <= 7 && min >= 0 && max <= 10;
    if (likertLike) {
      return {
        level: LEVELS.ORDINAL,
        confidence: "baja",
        rationale:
          "Pocos enteros consecutivos: suele ser una escala ordenada (tipo Likert). Caso ambiguo clásico: también podrían ser CATEGORÍAS CODIFICADAS (nominal, p. ej. 1=hombre, 2=mujer). Decide según el significado de los códigos.",
        alternatives: [
          { level: LEVELS.NOMINAL, note: "Si los números son etiquetas de categorías." },
          { level: LEVELS.INTERVALO, note: "Si asumes distancias iguales entre niveles (uso frecuente, pero discutible)." },
        ],
      };
    }
    // Conteo entero amplio, no negativo.
    if (isInteger && min >= 0) {
      return {
        level: LEVELS.RAZON,
        confidence: "media",
        rationale: `Conteo entero con cero absoluto (ausencia de la cantidad): admite razones (“el doble que”). ${NOTE_THEORY}`,
        alternatives: [{ level: LEVELS.INTERVALO, note: "Si el cero no significa ausencia." }],
      };
    }
    // Continua.
    if (numericKind === "continuous") {
      if (hasNegative) {
        return {
          level: LEVELS.INTERVALO,
          confidence: "media",
          rationale:
            "Variable continua con valores negativos: probablemente de intervalo (sin cero absoluto), como puntuaciones estandarizadas o temperatura en °C. Las razones no son interpretables.",
          alternatives: [{ level: LEVELS.RAZON, note: "Solo si existe un cero absoluto genuino." }],
        };
      }
      return {
        level: LEVELS.RAZON,
        confidence: "media",
        rationale:
          "Variable continua no negativa: si el cero indica ausencia de la magnitud (tiempo, peso, ingresos), es de razón. Confirma que el cero sea absoluto.",
        alternatives: [{ level: LEVELS.INTERVALO, note: "Si el cero es convencional, no absoluto." }],
      };
    }
  }

  // Indeterminado.
  return {
    level: LEVELS.NOMINAL,
    confidence: "baja",
    rationale: `No fue posible perfilar la columna con seguridad. ${NOTE_THEORY}`,
    alternatives: [],
  };
}

/**
 * Analiza una columna (vector de cadenas crudas) y devuelve su descriptor.
 * @param {string} name
 * @param {number} index
 * @param {string[]} raw
 * @param {"."|","} decimal
 */
function describeColumn(name, index, raw, decimal) {
  const total = raw.length;
  const present = raw.filter((v) => !isMissing(v));
  const missing = total - present.length;
  const uniqueSet = new Set(present.map((v) => String(v).trim()));
  const uniqueCount = uniqueSet.size;
  const uniqueRatio = present.length ? uniqueCount / present.length : 0;

  // Pruebas de tipo sobre los valores presentes.
  const numbers = present.map((v) => parseNumber(v, decimal));
  const numericRatio = present.length
    ? numbers.filter((x) => Number.isFinite(x)).length / present.length
    : 0;
  const dateRatio = present.length
    ? present.filter(looksLikeDate).length / present.length
    : 0;

  const boolSets = [
    new Set(["true", "false"]),
    new Set(["verdadero", "falso"]),
    new Set(["si", "no"]),
    new Set(["sí", "no"]),
    new Set(["yes", "no"]),
  ];
  const lowerUnique = new Set([...uniqueSet].map((v) => v.toLowerCase()));
  const isBoolean =
    uniqueCount <= 2 &&
    boolSets.some((bs) => [...lowerUnique].every((v) => bs.has(v))) &&
    lowerUnique.size > 0;

  let storageType;
  let numericKind = null;

  if (present.length === 0) {
    storageType = "empty";
  } else if (isBoolean) {
    storageType = "boolean";
  } else if (dateRatio >= 0.95) {
    storageType = "temporal";
  } else if (numericRatio >= 0.95) {
    storageType = "numeric";
    const finite = numbers.filter((x) => Number.isFinite(x));
    const allInt = finite.every((x) => Number.isInteger(x));
    // Continua si hay decimales o si, siendo entera, tiene muchos valores.
    numericKind = !allInt || uniqueCount > 20 ? "continuous" : "discrete";
  } else if (uniqueRatio >= 0.9 && uniqueCount > 20) {
    storageType = "identifier";
  } else {
    storageType = "categorical";
  }

  // Estadística o categorías según el tipo.
  let stats = null;
  let categories = null;
  let min = null;
  let max = null;
  let hasNegative = false;
  let isInteger = false;

  if (storageType === "numeric") {
    stats = numericSummary(numbers);
    min = stats.min;
    max = stats.max;
    hasNegative = (min ?? 0) < 0;
    isInteger = numbers.filter((x) => Number.isFinite(x)).every((x) => Number.isInteger(x));
  } else if (storageType === "categorical" || storageType === "boolean") {
    categories = frequencyTable(raw);
  }

  const categoryValues = categories ? categories.map((c) => c.value) : [];

  const suggestion = suggestLevel({
    storageType,
    numericKind,
    isInteger,
    uniqueCount,
    min,
    max,
    hasNegative,
    categoryValues,
  });

  return {
    name,
    index,
    storageType,
    numericKind,
    level: suggestion.level,
    levelSuggested: suggestion.level,
    levelConfidence: suggestion.confidence,
    levelRationale: suggestion.rationale,
    levelAlternatives: suggestion.alternatives,
    isUserConfirmed: false,
    missing,
    missingPct: total ? missing / total : 0,
    unique: uniqueCount,
    sampleValues: [...uniqueSet].slice(0, 6),
    categories,
    stats,
  };
}

/**
 * Detecta los descriptores de todas las variables de una matriz.
 * @param {string[]} headers
 * @param {string[][]} matrix  Filas de datos (sin encabezado)
 * @param {Object} [opts]
 * @param {"."|","} [opts.decimal="."]
 * @returns {Array<Object>} descriptores de variable
 */
export function detectVariables(headers, matrix, opts = {}) {
  const decimal = opts.decimal || ".";
  return headers.map((name, col) => {
    const column = matrix.map((row) => row[col]);
    return describeColumn(name, col, column, decimal);
  });
}
