/**
 * registry.js — Registro central del catálogo de visualizaciones.
 *
 * Fuente única de verdad sobre QUÉ gráficos existen y sus metadatos. El motor
 * de renderizado (Fases 3+), el recomendador (Fase 6) y la navegación leen de
 * aquí. En esta Fase 1 se declara el catálogo completo del brief (la barra
 * lateral muestra el alcance real); el contenido pedagógico extenso y la lógica
 * de render de cada gráfico se incorporan en sus fases respectivas.
 *
 * Cada gráfico declara `exampleKey`: por requisito del proyecto, todo gráfico
 * debe poder mostrarse con un dataset de ejemplo cuando el usuario no aporta el
 * suyo (ver js/data/examples.js).
 *
 * Vocabulario controlado de tipos de variable:
 *   "continua" | "discreta" | "categorica" | "ordinal" | "temporal" | "geografica"
 */

/** Categorías en orden de presentación. */
export const CATEGORIES = [
  { id: "descriptiva", name: "Estadística descriptiva", blurb: "Forma, posición y dispersión de una o pocas variables." },
  { id: "asociacion", name: "Asociación y correlación", blurb: "Relación y dependencia entre variables." },
  { id: "series", name: "Series temporales", blurb: "Evolución y estructura a lo largo del tiempo." },
  { id: "probabilidad", name: "Probabilidad", blurb: "Modelos teóricos de distribución." },
  { id: "inferencia", name: "Inferencia", blurb: "Estimación, contraste y evidencia." },
  { id: "regresion", name: "Regresión", blurb: "Modelado de relaciones y diagnóstico de supuestos." },
  { id: "multivariado", name: "Multivariado", blurb: "Reducción de dimensionalidad y estructura latente." },
  { id: "redes", name: "Redes", blurb: "Relaciones y flujos entre entidades." },
  { id: "geograficos", name: "Geográficos", blurb: "Distribución espacial sobre el territorio." },
];

/**
 * Catálogo de gráficos.
 * @typedef {Object} ChartDef
 * @property {string} id
 * @property {string} name
 * @property {string} category    Id de la categoría
 * @property {boolean} supports3D
 * @property {string[]} vars       Tipos de variable admitidos
 * @property {string} exampleKey   Clave del dataset de ejemplo
 * @property {string} summary      Descripción breve (registro; la ficha
 *                                 pedagógica completa llega en fases de render)
 * @property {boolean} implemented Si el render ya está disponible
 */
export const CHARTS = [
  /* --- Estadística descriptiva ------------------------------------------ */
  { id: "histogram", name: "Histograma", category: "descriptiva", supports3D: false, vars: ["continua"], summary: "Distribución de frecuencias de una variable continua mediante intervalos de clase." },
  { id: "frequencies", name: "Frecuencias", category: "descriptiva", supports3D: false, vars: ["categorica", "discreta"], summary: "Recuento de categorías; base de la mayoría de gráficos descriptivos." },
  { id: "bars-simple", name: "Barras simples", category: "descriptiva", supports3D: false, vars: ["categorica"], summary: "Comparación de una métrica entre categorías de una variable nominal u ordinal." },
  { id: "bars-grouped", name: "Barras agrupadas", category: "descriptiva", supports3D: false, vars: ["categorica"], summary: "Comparación de una métrica cruzando dos variables categóricas." },
  { id: "bars-stacked", name: "Barras apiladas", category: "descriptiva", supports3D: false, vars: ["categorica"], summary: "Composición de un total descompuesto por subcategorías." },
  { id: "bars-diverging", name: "Barras divergentes", category: "descriptiva", supports3D: false, vars: ["ordinal"], summary: "Escalas tipo Likert con polaridad: acuerdo frente a desacuerdo desde un eje neutro." },
  { id: "pareto", name: "Pareto", category: "descriptiva", supports3D: false, vars: ["categorica"], summary: "Barras ordenadas con curva acumulada para identificar las categorías dominantes." },
  { id: "frequency-polygon", name: "Polígono de frecuencias", category: "descriptiva", supports3D: false, vars: ["continua"], summary: "Trazo continuo que une los puntos medios de las clases de un histograma." },
  { id: "ogive", name: "Ojiva", category: "descriptiva", supports3D: false, vars: ["continua"], summary: "Curva de frecuencia acumulada; lectura directa de percentiles." },
  { id: "dot-plot", name: "Dot plot", category: "descriptiva", supports3D: false, vars: ["continua", "categorica"], summary: "Puntos individuales que evitan la distorsión de área de las barras." },
  { id: "stem-leaf", name: "Tallo y hojas", category: "descriptiva", supports3D: false, vars: ["continua"], summary: "Resumen que preserva los valores originales mostrando la forma de la distribución." },
  { id: "boxplot", name: "Diagrama de caja", category: "descriptiva", supports3D: false, vars: ["continua", "categorica"], summary: "Mediana, cuartiles, rango intercuartílico y valores atípicos." },
  { id: "violin", name: "Violín", category: "descriptiva", supports3D: false, vars: ["continua", "categorica"], summary: "Densidad estimada por grupo; revela bimodalidad que la caja oculta." },
  { id: "ridgeline", name: "Ridgeline", category: "descriptiva", supports3D: false, vars: ["continua", "categorica"], summary: "Densidades solapadas para comparar muchas distribuciones de un vistazo." },
  { id: "density", name: "Densidad", category: "descriptiva", supports3D: false, vars: ["continua"], summary: "Estimación de densidad por núcleo (KDE) como alternativa suave al histograma." },
  { id: "beeswarm", name: "Enjambre", category: "descriptiva", supports3D: false, vars: ["continua", "categorica"], summary: "Puntos desplazados para no solaparse; muestra cada observación y su densidad." },
  { id: "strip", name: "Strip plot", category: "descriptiva", supports3D: false, vars: ["continua", "categorica"], summary: "Dispersión unidimensional de observaciones por categoría." },
  { id: "raincloud", name: "Raincloud", category: "descriptiva", supports3D: false, vars: ["continua", "categorica"], summary: "Combina densidad, caja y puntos crudos en una sola lectura transparente." },

  /* --- Asociación y correlación ----------------------------------------- */
  { id: "scatter", name: "Dispersión", category: "asociacion", supports3D: true, vars: ["continua"], summary: "Relación entre dos variables continuas; base del análisis bivariado." },
  { id: "bubble", name: "Burbujas", category: "asociacion", supports3D: true, vars: ["continua"], summary: "Dispersión con una tercera variable codificada en el tamaño del punto." },
  { id: "hexbin", name: "Hexbin", category: "asociacion", supports3D: false, vars: ["continua"], summary: "Agregación hexagonal para nubes de puntos densas con solapamiento." },
  { id: "correlogram", name: "Correlograma", category: "asociacion", supports3D: false, vars: ["continua"], summary: "Matriz visual de correlaciones entre múltiples variables." },
  { id: "pairplot", name: "Pair plot", category: "asociacion", supports3D: false, vars: ["continua"], summary: "Rejilla de dispersiones y distribuciones para todos los pares de variables." },
  { id: "scatter-matrix", name: "Matriz de dispersión", category: "asociacion", supports3D: false, vars: ["continua"], summary: "Exploración simultánea de relaciones bivariadas en un conjunto de variables." },
  { id: "corr-heatmap", name: "Mapa de calor de correlaciones", category: "asociacion", supports3D: false, vars: ["continua"], summary: "Coeficientes de correlación codificados en color sobre una matriz." },
  { id: "assoc-network", name: "Red de asociación", category: "asociacion", supports3D: false, vars: ["continua"], summary: "Variables como nodos y correlaciones relevantes como aristas." },

  /* --- Series temporales ------------------------------------------------ */
  { id: "line", name: "Línea simple", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Evolución de una variable a lo largo del tiempo." },
  { id: "multiline", name: "Líneas múltiples", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Comparación de varias series temporales en un mismo eje." },
  { id: "area", name: "Área", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Línea con relleno que enfatiza la magnitud acumulada." },
  { id: "area-stacked", name: "Área apilada", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Composición de un total y su evolución temporal por componentes." },
  { id: "streamgraph", name: "Streamgraph", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Áreas apiladas con línea base flotante para enfatizar el flujo." },
  { id: "horizon", name: "Horizon plot", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Series compactas con bandas de color; ideal para muchas series en poco espacio." },
  { id: "seasonal", name: "Seasonal plot", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Superposición de ciclos para revelar estacionalidad." },
  { id: "lag", name: "Lag plot", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Valor frente a su rezago; diagnostico de autocorrelación y aleatoriedad." },
  { id: "acf", name: "Autocorrelación", category: "series", supports3D: false, vars: ["temporal", "continua"], summary: "Correlograma temporal (ACF/PACF) para identificar estructura y memoria." },

  /* --- Probabilidad ----------------------------------------------------- */
  { id: "normal-dist", name: "Normal", category: "probabilidad", supports3D: false, vars: ["continua"], summary: "Distribución gaussiana; fundamento de la inferencia paramétrica." },
  { id: "binomial-dist", name: "Binomial", category: "probabilidad", supports3D: false, vars: ["discreta"], summary: "Número de éxitos en ensayos de Bernoulli independientes." },
  { id: "poisson-dist", name: "Poisson", category: "probabilidad", supports3D: false, vars: ["discreta"], summary: "Conteo de eventos raros en un intervalo fijo." },
  { id: "exponential-dist", name: "Exponencial", category: "probabilidad", supports3D: false, vars: ["continua"], summary: "Tiempos de espera entre eventos en un proceso de Poisson." },
  { id: "weibull-dist", name: "Weibull", category: "probabilidad", supports3D: false, vars: ["continua"], summary: "Fiabilidad y análisis de supervivencia con tasa de fallo variable." },
  { id: "gamma-dist", name: "Gamma", category: "probabilidad", supports3D: false, vars: ["continua"], summary: "Tiempos de espera agregados; flexible y asimétrica positiva." },
  { id: "beta-dist", name: "Beta", category: "probabilidad", supports3D: false, vars: ["continua"], summary: "Modelado de proporciones y probabilidades en el intervalo [0, 1]." },
  { id: "dist-compare", name: "Distribuciones comparadas", category: "probabilidad", supports3D: false, vars: ["continua"], summary: "Superposición de modelos teóricos para contrastar forma y colas." },

  /* --- Inferencia ------------------------------------------------------- */
  { id: "conf-interval", name: "Intervalos de confianza", category: "inferencia", supports3D: false, vars: ["continua", "categorica"], summary: "Estimación por intervalo de un parámetro con su incertidumbre." },
  { id: "forest", name: "Forest plot", category: "inferencia", supports3D: false, vars: ["continua"], summary: "Tamaños de efecto e intervalos por estudio; estándar en metaanálisis." },
  { id: "funnel", name: "Funnel plot", category: "inferencia", supports3D: false, vars: ["continua"], summary: "Precisión frente a efecto; diagnostico de sesgo de publicación." },
  { id: "volcano", name: "Volcano plot", category: "inferencia", supports3D: false, vars: ["continua"], summary: "Significación frente a magnitud en contrastes múltiples (ómicas)." },
  { id: "roc", name: "Curva ROC", category: "inferencia", supports3D: false, vars: ["continua", "categorica"], summary: "Sensibilidad frente a 1−especificidad; capacidad discriminante (AUC)." },
  { id: "pr-curve", name: "Precision–Recall", category: "inferencia", supports3D: false, vars: ["continua", "categorica"], summary: "Precisión frente a exhaustividad; preferible ante clases desbalanceadas." },

  /* --- Regresión -------------------------------------------------------- */
  { id: "linear-reg", name: "Regresión lineal", category: "regresion", supports3D: false, vars: ["continua"], summary: "Recta de mínimos cuadrados con banda de confianza e intervalo de predicción." },
  { id: "multiple-reg", name: "Regresión múltiple", category: "regresion", supports3D: true, vars: ["continua"], summary: "Superficie de respuesta con dos predictores; coeficientes parciales." },
  { id: "fitted-curves", name: "Curvas ajustadas", category: "regresion", supports3D: false, vars: ["continua"], summary: "Ajustes polinómicos, LOESS o splines frente a la relación lineal." },
  { id: "residuals", name: "Residuos", category: "regresion", supports3D: false, vars: ["continua"], summary: "Residuos frente a valores ajustados; diagnostico de linealidad y homocedasticidad." },
  { id: "influence", name: "Influencia", category: "regresion", supports3D: false, vars: ["continua"], summary: "Distancia de Cook y DFBETAS para detectar observaciones influyentes." },
  { id: "leverage", name: "Leverage", category: "regresion", supports3D: false, vars: ["continua"], summary: "Apalancamiento frente a residuos estandarizados (gráfico de influencia)." },
  { id: "reg-diagnostics", name: "Diagnósticos", category: "regresion", supports3D: false, vars: ["continua"], summary: "Panel de supuestos: normalidad (Q–Q), escala-localización y residuos." },

  /* --- Multivariado ----------------------------------------------------- */
  { id: "pca", name: "PCA", category: "multivariado", supports3D: true, vars: ["continua"], summary: "Análisis de componentes principales; varianza explicada y proyección." },
  { id: "biplot", name: "Biplot", category: "multivariado", supports3D: false, vars: ["continua"], summary: "Observaciones y cargas de variables superpuestas en el espacio de componentes." },
  { id: "clustering", name: "Clustering", category: "multivariado", supports3D: true, vars: ["continua"], summary: "Agrupamiento (k-medias, jerárquico) proyectado sobre los datos." },
  { id: "dendrogram", name: "Dendrograma", category: "multivariado", supports3D: false, vars: ["continua"], summary: "Árbol de fusión del agrupamiento jerárquico y sus distancias." },
  { id: "mds", name: "MDS", category: "multivariado", supports3D: true, vars: ["continua"], summary: "Escalamiento multidimensional que preserva distancias en baja dimensión." },
  { id: "tsne", name: "t-SNE", category: "multivariado", supports3D: true, vars: ["continua"], summary: "Embebido no lineal que preserva la estructura local de vecindad." },
  { id: "umap", name: "UMAP", category: "multivariado", supports3D: true, vars: ["continua"], summary: "Reducción no lineal que equilibra estructura local y global." },

  /* --- Redes ------------------------------------------------------------ */
  { id: "network", name: "Network graph", category: "redes", supports3D: true, vars: ["categorica"], summary: "Nodos y aristas; topología de relaciones entre entidades." },
  { id: "force-directed", name: "Force-directed", category: "redes", supports3D: true, vars: ["categorica"], summary: "Disposición por simulación física que revela comunidades." },
  { id: "sankey", name: "Sankey", category: "redes", supports3D: false, vars: ["categorica", "continua"], summary: "Flujos y transferencias cuyo grosor codifica la magnitud." },
  { id: "chord", name: "Chord", category: "redes", supports3D: false, vars: ["categorica", "continua"], summary: "Relaciones bidireccionales entre categorías dispuestas en círculo." },

  /* --- Geográficos ------------------------------------------------------ */
  { id: "choropleth", name: "Choropleth", category: "geograficos", supports3D: false, vars: ["geografica", "continua"], summary: "Regiones coloreadas según una métrica; normalizar por población." },
  { id: "bubble-map", name: "Mapa de burbujas", category: "geograficos", supports3D: false, vars: ["geografica", "continua"], summary: "Magnitudes como círculos proporcionales sobre coordenadas." },
  { id: "density-map", name: "Mapa de densidad", category: "geograficos", supports3D: false, vars: ["geografica"], summary: "Concentración espacial de eventos mediante densidad por núcleo." },
  { id: "heat-map", name: "Mapa de calor geográfico", category: "geograficos", supports3D: false, vars: ["geografica", "continua"], summary: "Intensidad continua de una variable sobre el territorio." },
];

/* ------------------------------------------------------------------------
   Normalización: cada gráfico recibe exampleKey e implemented. Los gráficos
   con render disponible (Fase 3: descriptiva y asociación) se enumeran en
   IMPLEMENTED, donde el valor es la clave del dataset de ejemplo que mejor se
   ajusta a su FORMA (varios gráficos univariados comparten un mismo ejemplo).
   ------------------------------------------------------------------------ */
const IMPLEMENTED = {
  // Descriptiva
  histogram: "histogram",
  density: "histogram",
  "frequency-polygon": "histogram",
  ogive: "histogram",
  strip: "boxplot",
  boxplot: "boxplot",
  violin: "boxplot",
  "bars-simple": "bars-simple",
  frequencies: "bars-simple",
  pareto: "bars-simple",
  "dot-plot": "bars-simple",
  "bars-grouped": "crosstab",
  "bars-stacked": "crosstab",
  // Asociación
  scatter: "scatter",
  bubble: "bubble",
  "corr-heatmap": "corr-heatmap",
  // Probabilidad (gráficos teóricos, definidos por parámetros, sin dataset)
  "normal-dist": true,
  "binomial-dist": true,
  "poisson-dist": true,
  "exponential-dist": true,
  "weibull-dist": true,
  "gamma-dist": true,
  "beta-dist": true,
  "dist-compare": true,
  // Inferencia
  "conf-interval": "boxplot",
  forest: "meta",
  funnel: "meta",
  volcano: "diffexp",
  roc: "classifier",
  "pr-curve": "classifier",
  // Regresión
  "linear-reg": "scatter",
  "multiple-reg": "corr-heatmap",
  "fitted-curves": "scatter",
  residuals: "scatter",
  influence: "scatter",
  leverage: "scatter",
  "reg-diagnostics": "scatter",
  // Series temporales
  line: "line",
  multiline: "timeseries-multi",
  area: "line",
  "area-stacked": "timeseries-multi",
  streamgraph: "timeseries-multi",
  horizon: "seasonal-series",
  seasonal: "seasonal-series",
  lag: "seasonal-series",
  acf: "seasonal-series",
  // Multivariado (UMAP queda pendiente: una implementación fiel excede un port estático)
  pca: "multivar",
  biplot: "multivar",
  clustering: "multivar",
  mds: "multivar",
  dendrogram: "multivar",
  tsne: "multivar",
  // Redes
  network: "crosstab",
  "force-directed": "crosstab",
  sankey: "crosstab",
  chord: "crosstab",
  // Red de asociación (categoría Asociación)
  "assoc-network": "corr-heatmap",
  // Geográficos
  choropleth: "geo-countries",
  "bubble-map": "geo-cities",
  "density-map": "geo-events",
  "heat-map": "geo-events",
  // Variantes descriptivas
  "bars-diverging": "groups-dist",
  "stem-leaf": "histogram",
  ridgeline: "groups-dist",
  beeswarm: "groups-dist",
  raincloud: "groups-dist",
  // Variantes de asociación
  hexbin: "scatter-cloud",
  correlogram: "corr-heatmap",
  pairplot: "multivar",
  "scatter-matrix": "multivar",
  // Multivariado (UMAP)
  umap: "multivar",
};

CHARTS.forEach((c) => {
  const mapped = IMPLEMENTED[c.id];
  if (c.implemented === undefined) c.implemented = mapped !== undefined;
  if (c.exampleKey === undefined) {
    c.exampleKey = typeof mapped === "string" ? mapped : c.id;
  }
});

/* ------------------------------------------------------------------------
   Índices y utilidades de consulta.
   ------------------------------------------------------------------------ */
const CHART_INDEX = new Map(CHARTS.map((c) => [c.id, c]));
const CATEGORY_INDEX = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Devuelve la definición de un gráfico por id (o null). */
export function getChart(id) {
  return CHART_INDEX.get(id) || null;
}

/** Devuelve la definición de una categoría por id (o null). */
export function getCategory(id) {
  return CATEGORY_INDEX.get(id) || null;
}

/** Devuelve los gráficos de una categoría, en orden de declaración. */
export function getChartsByCategory(categoryId) {
  return CHARTS.filter((c) => c.category === categoryId);
}

/** Número total de gráficos del catálogo. */
export const TOTAL_CHARTS = CHARTS.length;

/** Número de gráficos ya implementados (con render disponible). */
export function implementedCount() {
  return CHARTS.reduce((n, c) => n + (c.implemented ? 1 : 0), 0);
}
