/**
 * recommender.js — Recomendador de gráficos (sistema experto).
 *
 * A partir del perfil de variables del usuario (cuántas numéricas, categóricas
 * o temporales) y de un objetivo analítico, propone gráficos del catálogo con
 * una justificación metodológica. Es una base de reglas curada: codifica qué
 * visualización conviene en cada situación, no una heurística opaca.
 *
 * Sin objetivo, agrega las recomendaciones de todos los objetivos compatibles
 * con la forma de los datos. Sin perfil (no hay datos cargados), recomienda los
 * gráficos canónicos de cada objetivo (cada uno trae su propio ejemplo).
 */

/** Objetivos analíticos que guían la recomendación. */
export const GOALS = [
  { id: "distribucion", label: "Describir una distribución", hint: "Forma, centro y dispersión de una variable." },
  { id: "comparacion", label: "Comparar grupos", hint: "Una variable numérica entre categorías." },
  { id: "relacion", label: "Explorar una relación", hint: "Cómo se asocian dos o más variables." },
  { id: "evolucion", label: "Ver evolución temporal", hint: "Cómo cambia algo a lo largo del tiempo." },
  { id: "composicion", label: "Mostrar composición", hint: "Partes de un todo o flujos entre categorías." },
  { id: "estructura", label: "Descubrir estructura", hint: "Reducir dimensiones o agrupar casos." },
  { id: "incertidumbre", label: "Cuantificar incertidumbre", hint: "Intervalos, efectos y clasificación." },
  { id: "geografia", label: "Cartografiar", hint: "Datos asociados a un territorio." },
];

/**
 * Perfil de un conjunto de datos: recuento por tipo de variable.
 * (booleanas cuentan como categóricas; identificadores se ignoran.)
 */
export function profileFromDataset(dataset) {
  const p = { numeric: 0, categorical: 0, temporal: 0, n: dataset?.n || (dataset?.rows ? dataset.rows.length : 0) };
  for (const v of dataset?.variables || []) {
    if (v.storageType === "numeric") p.numeric += 1;
    else if (v.storageType === "categorical" || v.storageType === "boolean") p.categorical += 1;
    else if (v.storageType === "temporal") p.temporal += 1;
  }
  return p;
}

/* Base de reglas: id de gráfico, objetivo, requisitos de datos, puntuación
   base, bonificación opcional según el perfil y la justificación. */
const RULES = [
  // — Distribución —
  { id: "histogram", goal: "distribucion", need: { numeric: 1 }, base: 100, reason: "El estándar para ver la forma de una variable continua: agrupa los valores en intervalos." },
  { id: "density", goal: "distribucion", need: { numeric: 1 }, base: 88, reason: "Suaviza el histograma en una curva continua; no depende del ancho de los intervalos." },
  { id: "boxplot", goal: "distribucion", need: { numeric: 1 }, base: 82, reason: "Resume centro, dispersión y atípicos con el resumen de cinco números." },
  { id: "violin", goal: "distribucion", need: { numeric: 1 }, base: 78, reason: "Caja más densidad: muestra además la forma, como la bimodalidad." },
  { id: "stem-leaf", goal: "distribucion", need: { numeric: 1 }, base: 58, bonus: (p) => (p.n && p.n <= 60 ? 18 : -10), reason: "Conserva los valores individuales; ideal con muestras pequeñas." },
  { id: "frequency-polygon", goal: "distribucion", need: { numeric: 1 }, base: 55, reason: "Línea en vez de barras; facilita superponer varias distribuciones." },
  { id: "dot-plot", goal: "distribucion", need: { numeric: 1 }, base: 52, bonus: (p) => (p.n && p.n <= 50 ? 12 : -8), reason: "Un punto por valor; muy claro con pocos datos." },
  { id: "frequencies", goal: "distribucion", need: { categorical: 1 }, base: 90, reason: "Reparto de frecuencias de una variable categórica." },
  { id: "bars-simple", goal: "distribucion", need: { categorical: 1 }, base: 84, reason: "Barras de frecuencia por categoría." },
  { id: "pareto", goal: "distribucion", need: { categorical: 1 }, base: 64, reason: "Barras ordenadas con curva acumulada; resalta las categorías dominantes." },

  // — Comparación de grupos —
  { id: "boxplot", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 100, reason: "Compara la distribución de una variable numérica entre grupos de forma robusta." },
  { id: "violin", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 88, reason: "Como el diagrama de caja, pero mostrando la forma completa de cada grupo." },
  { id: "raincloud", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 82, reason: "Caja, densidad y puntos por grupo: la vista más completa." },
  { id: "ridgeline", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 74, reason: "Densidades por grupo superpuestas; ideal con varios grupos." },
  { id: "beeswarm", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 70, bonus: (p) => (p.n && p.n <= 120 ? 14 : -10), reason: "Muestra cada observación sin solaparla; bueno con pocos datos por grupo." },
  { id: "strip", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 60, reason: "Puntos por grupo (dispersión simple)." },
  { id: "bars-grouped", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 58, reason: "Barras por grupo; menos informativo que la caja, pero familiar." },
  { id: "bars-diverging", goal: "comparacion", need: { categorical: 1, numeric: 1 }, base: 56, reason: "Desviaciones de cada grupo respecto a la media general." },

  // — Relación —
  { id: "scatter", goal: "relacion", need: { numeric: 2 }, base: 100, reason: "El estándar para ver la relación entre dos variables continuas." },
  { id: "hexbin", goal: "relacion", need: { numeric: 2 }, base: 72, bonus: (p) => (p.n && p.n >= 200 ? 24 : -6), reason: "Con muchos puntos, agrupa por densidad y evita el solapamiento." },
  { id: "bubble", goal: "relacion", need: { numeric: 3 }, base: 78, reason: "Añade una tercera variable continua como tamaño de burbuja." },
  { id: "scatter-matrix", goal: "relacion", need: { numeric: 3 }, base: 86, reason: "Todas las relaciones por pares de varias variables a la vez." },
  { id: "pairplot", goal: "relacion", need: { numeric: 3 }, base: 82, reason: "Matriz de dispersión que puede colorearse por una categoría." },
  { id: "correlogram", goal: "relacion", need: { numeric: 3 }, base: 78, reason: "Matriz de correlaciones como círculos (tamaño y color = r)." },
  { id: "corr-heatmap", goal: "relacion", need: { numeric: 3 }, base: 76, reason: "Matriz de correlaciones como mapa de calor." },
  { id: "assoc-network", goal: "relacion", need: { numeric: 3 }, base: 60, reason: "Red de variables unidas por sus correlaciones fuertes." },
  { id: "bars-grouped", goal: "relacion", need: { categorical: 2 }, base: 68, reason: "Relación entre dos variables categóricas (frecuencias por combinación)." },

  // — Evolución temporal —
  { id: "line", goal: "evolucion", need: { temporal: 1, numeric: 1 }, base: 100, reason: "El estándar para una serie temporal." },
  { id: "area", goal: "evolucion", need: { temporal: 1, numeric: 1 }, base: 76, reason: "Línea con relleno; enfatiza el volumen acumulado." },
  { id: "multiline", goal: "evolucion", need: { temporal: 1, numeric: 2 }, base: 88, reason: "Compara varias series sobre el mismo eje temporal." },
  { id: "area-stacked", goal: "evolucion", need: { temporal: 1, numeric: 2 }, base: 74, reason: "Composición acumulada a lo largo del tiempo." },
  { id: "streamgraph", goal: "evolucion", need: { temporal: 1, numeric: 2 }, base: 64, reason: "Composición con línea base centrada; estético con muchas series." },
  { id: "seasonal", goal: "evolucion", need: { temporal: 1, numeric: 1 }, base: 70, reason: "Superpone ciclos para revelar estacionalidad." },
  { id: "acf", goal: "evolucion", need: { temporal: 1, numeric: 1 }, base: 66, reason: "Autocorrelación: detecta dependencia temporal y periodicidad." },

  // — Composición / flujos —
  { id: "bars-stacked", goal: "composicion", need: { categorical: 2 }, base: 90, reason: "Partes de un todo apiladas dentro de cada categoría." },
  { id: "sankey", goal: "composicion", need: { categorical: 2 }, base: 86, reason: "Flujos entre las categorías de dos variables." },
  { id: "bars-grouped", goal: "composicion", need: { categorical: 2 }, base: 76, reason: "Compara las subcategorías lado a lado." },
  { id: "chord", goal: "composicion", need: { categorical: 2 }, base: 72, reason: "Relaciones entre categorías en disposición circular." },
  { id: "frequencies", goal: "composicion", need: { categorical: 1 }, base: 70, reason: "Reparto de una única variable categórica." },
  { id: "pareto", goal: "composicion", need: { categorical: 1 }, base: 64, reason: "Qué pocas categorías concentran el grueso del total." },
  { id: "area-stacked", goal: "composicion", need: { temporal: 1, numeric: 2 }, base: 68, reason: "Cómo cambia la composición en el tiempo." },

  // — Estructura multivariante —
  { id: "pca", goal: "estructura", need: { numeric: 3 }, base: 100, reason: "Resume muchas variables en pocas componentes (lineal e interpretable)." },
  { id: "clustering", goal: "estructura", need: { numeric: 3 }, base: 86, reason: "Agrupa los casos en k cúmulos con k-medias." },
  { id: "biplot", goal: "estructura", need: { numeric: 3 }, base: 84, reason: "PCA que muestra además cómo contribuye cada variable." },
  { id: "dendrogram", goal: "estructura", need: { numeric: 3 }, base: 78, reason: "Agrupamiento jerárquico: cómo se fusionan los casos." },
  { id: "umap", goal: "estructura", need: { numeric: 3 }, base: 76, reason: "Embebido no lineal que preserva bien la estructura global." },
  { id: "mds", goal: "estructura", need: { numeric: 3 }, base: 74, reason: "Mapa 2D que conserva las distancias entre casos." },
  { id: "tsne", goal: "estructura", need: { numeric: 3 }, base: 72, reason: "Embebido no lineal que resalta la estructura local." },

  // — Incertidumbre / inferencia —
  { id: "conf-interval", goal: "incertidumbre", need: { categorical: 1, numeric: 1 }, base: 100, reason: "Intervalos de confianza de la media por grupo." },
  { id: "forest", goal: "incertidumbre", need: {}, base: 84, reason: "Combina estimaciones de varios estudios o grupos (meta-análisis)." },
  { id: "roc", goal: "incertidumbre", need: {}, base: 80, reason: "Capacidad discriminativa de un clasificador (AUC)." },
  { id: "pr-curve", goal: "incertidumbre", need: {}, base: 74, reason: "Precisión-recall, útil con clases desbalanceadas." },
  { id: "volcano", goal: "incertidumbre", need: {}, base: 70, reason: "Efecto frente a significación para muchas comparaciones a la vez." },
  { id: "funnel", goal: "incertidumbre", need: {}, base: 64, reason: "Efecto frente a precisión; ayuda a detectar sesgo de publicación." },

  // — Geografía —
  { id: "choropleth", goal: "geografia", need: { categorical: 1, numeric: 1 }, base: 90, reason: "Colorea regiones por una métrica (requiere nombres de país o códigos ISO)." },
  { id: "bubble-map", goal: "geografia", need: { numeric: 2 }, base: 88, reason: "Magnitudes como círculos sobre coordenadas (latitud/longitud)." },
  { id: "density-map", goal: "geografia", need: { numeric: 2 }, base: 76, reason: "Densidad de eventos (KDE) sobre el mapa." },
  { id: "heat-map", goal: "geografia", need: { numeric: 2 }, base: 72, reason: "Interpola una variable sobre el territorio (IDW)." },
];

function meetsNeed(need, profile) {
  if (!profile) return true; // modo solo-objetivo: el gráfico trae su ejemplo
  return Object.entries(need || {}).every(([k, v]) => (profile[k] || 0) >= v);
}

/**
 * Recomienda gráficos.
 * @param {Object|null} profile  perfil de datos (o null si no hay datos)
 * @param {string} [goal]        id de objetivo; si se omite, agrega todos
 * @returns {Array<{id:string, goal:string, score:number, reason:string}>}
 */
export function recommend(profile, goal) {
  const pool = RULES.filter((r) => (goal ? r.goal === goal : true) && meetsNeed(r.need, profile));
  const scored = pool.map((r) => ({
    id: r.id,
    goal: r.goal,
    reason: r.reason,
    score: r.base + (profile && r.bonus ? r.bonus(profile) : 0),
  }));

  if (goal) return scored.sort((a, b) => b.score - a.score);

  // Sin objetivo: una entrada por gráfico (la de mayor puntuación).
  const best = new Map();
  for (const s of scored) {
    const prev = best.get(s.id);
    if (!prev || s.score > prev.score) best.set(s.id, s);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
}
