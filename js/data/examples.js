/**
 * examples.js — Datasets de ejemplo asociados a cada gráfico.
 *
 * Requisito del proyecto: todo gráfico debe poder mostrarse con un dataset de
 * ejemplo cuando el usuario aún no ha cargado el suyo. Este módulo es el
 * catálogo de esos datasets. La clave coincide con `exampleKey` del registro.
 *
 * Cada dataset declara metadatos de variables (tipo y nivel de medición) que
 * en fases posteriores alimentarán el detector automático y el recomendador.
 *
 * Temática deliberada (bienestar emocional y psicológico en entornos
 * profesionales) para que los ejemplos resulten pertinentes al dominio.
 *
 * @typedef {Object} Dataset
 * @property {string} name
 * @property {string} description
 * @property {string} source        Atribución u origen ("simulado", etc.)
 * @property {Array<{name:string,type:string,level:string,unit?:string}>} variables
 * @property {Array<Object>} rows
 */

/** @type {Record<string, Dataset>} */
export const EXAMPLES = {
  /* Histograma: puntuaciones de una escala de bienestar laboral (0–100). */
  histogram: {
    name: "Bienestar laboral (escala 0–100)",
    description:
      "Puntuaciones de bienestar psicológico en una muestra de profesionales. Variable continua apta para examinar forma, asimetría y curtosis.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "bienestar", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { bienestar: 62 }, { bienestar: 58 }, { bienestar: 71 }, { bienestar: 49 },
      { bienestar: 66 }, { bienestar: 73 }, { bienestar: 55 }, { bienestar: 68 },
      { bienestar: 60 }, { bienestar: 64 }, { bienestar: 77 }, { bienestar: 52 },
      { bienestar: 69 }, { bienestar: 63 }, { bienestar: 57 }, { bienestar: 74 },
      { bienestar: 61 }, { bienestar: 65 }, { bienestar: 70 }, { bienestar: 59 },
      { bienestar: 67 }, { bienestar: 54 }, { bienestar: 72 }, { bienestar: 66 },
      { bienestar: 63 }, { bienestar: 60 }, { bienestar: 78 }, { bienestar: 56 },
      { bienestar: 64 }, { bienestar: 68 }, { bienestar: 62 }, { bienestar: 71 },
    ],
  },

  /* Diagrama de caja: agotamiento por departamento (comparación de grupos). */
  boxplot: {
    name: "Agotamiento emocional por departamento",
    description:
      "Puntuaciones de agotamiento emocional (MBI) en tres departamentos. Variable continua agrupada por una categórica: ideal para comparar medianas y dispersión.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "departamento", type: "categorica", level: "nominal" },
      { name: "agotamiento", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { departamento: "Atención", agotamiento: 28 }, { departamento: "Atención", agotamiento: 32 },
      { departamento: "Atención", agotamiento: 25 }, { departamento: "Atención", agotamiento: 35 },
      { departamento: "Atención", agotamiento: 30 }, { departamento: "Atención", agotamiento: 38 },
      { departamento: "Atención", agotamiento: 27 }, { departamento: "Atención", agotamiento: 41 },
      { departamento: "Administración", agotamiento: 18 }, { departamento: "Administración", agotamiento: 22 },
      { departamento: "Administración", agotamiento: 15 }, { departamento: "Administración", agotamiento: 24 },
      { departamento: "Administración", agotamiento: 20 }, { departamento: "Administración", agotamiento: 19 },
      { departamento: "Administración", agotamiento: 26 }, { departamento: "Administración", agotamiento: 21 },
      { departamento: "Dirección", agotamiento: 23 }, { departamento: "Dirección", agotamiento: 29 },
      { departamento: "Dirección", agotamiento: 31 }, { departamento: "Dirección", agotamiento: 26 },
      { departamento: "Dirección", agotamiento: 34 }, { departamento: "Dirección", agotamiento: 27 },
      { departamento: "Dirección", agotamiento: 33 }, { departamento: "Dirección", agotamiento: 30 },
    ],
  },

  /* Dispersión: horas de sueño frente a agotamiento (relación bivariada). */
  scatter: {
    name: "Horas de sueño y agotamiento",
    description:
      "Relación entre horas de sueño nocturno y agotamiento emocional. Dos variables continuas para explorar dirección, forma e intensidad de la asociación.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "sueno", type: "continua", level: "razon", unit: "horas" },
      { name: "agotamiento", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { sueno: 4.5, agotamiento: 41 }, { sueno: 5.0, agotamiento: 38 },
      { sueno: 5.5, agotamiento: 36 }, { sueno: 6.0, agotamiento: 33 },
      { sueno: 6.2, agotamiento: 31 }, { sueno: 6.5, agotamiento: 30 },
      { sueno: 6.8, agotamiento: 28 }, { sueno: 7.0, agotamiento: 27 },
      { sueno: 7.2, agotamiento: 25 }, { sueno: 7.5, agotamiento: 24 },
      { sueno: 7.8, agotamiento: 22 }, { sueno: 8.0, agotamiento: 21 },
      { sueno: 8.2, agotamiento: 20 }, { sueno: 8.5, agotamiento: 18 },
      { sueno: 5.2, agotamiento: 39 }, { sueno: 6.6, agotamiento: 29 },
      { sueno: 7.4, agotamiento: 26 }, { sueno: 8.1, agotamiento: 19 },
    ],
  },

  /* Línea: nivel medio de estrés percibido por semana (serie temporal). */
  line: {
    name: "Estrés percibido por semana",
    description:
      "Promedio semanal de estrés percibido a lo largo de un trimestre. Variable continua indexada por tiempo: muestra tendencia y fluctuación.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "semana", type: "temporal", level: "ordinal" },
      { name: "estres", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { semana: 1, estres: 5.2 }, { semana: 2, estres: 5.4 }, { semana: 3, estres: 5.1 },
      { semana: 4, estres: 5.8 }, { semana: 5, estres: 6.0 }, { semana: 6, estres: 6.3 },
      { semana: 7, estres: 6.1 }, { semana: 8, estres: 6.6 }, { semana: 9, estres: 6.4 },
      { semana: 10, estres: 5.9 }, { semana: 11, estres: 5.6 }, { semana: 12, estres: 5.3 },
    ],
  },

  /* Barras simples: estrategias de afrontamiento más reportadas. */
  "bars-simple": {
    name: "Estrategias de afrontamiento",
    description:
      "Frecuencia con que se reportan distintas estrategias de afrontamiento. Una variable categórica con su recuento.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "estrategia", type: "categorica", level: "nominal" },
      { name: "frecuencia", type: "discreta", level: "razon", unit: "casos" },
    ],
    rows: [
      { estrategia: "Apoyo social", frecuencia: 84 },
      { estrategia: "Reestructuración", frecuencia: 67 },
      { estrategia: "Ejercicio", frecuencia: 58 },
      { estrategia: "Evitación", frecuencia: 41 },
      { estrategia: "Mindfulness", frecuencia: 39 },
    ],
  },

  /* Mapa de calor de correlaciones: matriz entre constructos psicológicos. */
  "corr-heatmap": {
    name: "Correlaciones entre constructos",
    description:
      "Matriz de correlaciones entre constructos de bienestar. Varias variables continuas para visualizar la fuerza y el signo de sus relaciones.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "bienestar", type: "continua", level: "intervalo" },
      { name: "sueno", type: "continua", level: "razon" },
      { name: "agotamiento", type: "continua", level: "intervalo" },
      { name: "estres", type: "continua", level: "intervalo" },
      { name: "apoyo", type: "continua", level: "intervalo" },
    ],
    rows: [
      { bienestar: 71, sueno: 7.8, agotamiento: 22, estres: 4.1, apoyo: 68 },
      { bienestar: 58, sueno: 5.5, agotamiento: 36, estres: 6.2, apoyo: 49 },
      { bienestar: 66, sueno: 7.0, agotamiento: 28, estres: 5.0, apoyo: 60 },
      { bienestar: 49, sueno: 4.5, agotamiento: 41, estres: 7.0, apoyo: 38 },
      { bienestar: 73, sueno: 8.2, agotamiento: 20, estres: 3.8, apoyo: 72 },
      { bienestar: 60, sueno: 6.2, agotamiento: 31, estres: 5.6, apoyo: 55 },
      { bienestar: 68, sueno: 7.4, agotamiento: 26, estres: 4.6, apoyo: 64 },
      { bienestar: 55, sueno: 5.2, agotamiento: 38, estres: 6.5, apoyo: 45 },
    ],
  },

  /* Tabla cruzada: nivel de bienestar por género (dos variables categóricas). */
  crosstab: {
    name: "Nivel de bienestar por género",
    description:
      "Distribución conjunta de dos variables categóricas (género y nivel de bienestar). Base de las barras agrupadas y apiladas y de la tabla de contingencia.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "genero", type: "categorica", level: "nominal" },
      { name: "nivel_bienestar", type: "categorica", level: "ordinal" },
    ],
    rows: [
      { genero: "Mujer", nivel_bienestar: "Alto" }, { genero: "Mujer", nivel_bienestar: "Medio" },
      { genero: "Mujer", nivel_bienestar: "Alto" }, { genero: "Mujer", nivel_bienestar: "Bajo" },
      { genero: "Mujer", nivel_bienestar: "Medio" }, { genero: "Mujer", nivel_bienestar: "Alto" },
      { genero: "Mujer", nivel_bienestar: "Medio" }, { genero: "Mujer", nivel_bienestar: "Alto" },
      { genero: "Mujer", nivel_bienestar: "Bajo" }, { genero: "Mujer", nivel_bienestar: "Medio" },
      { genero: "Mujer", nivel_bienestar: "Alto" }, { genero: "Mujer", nivel_bienestar: "Medio" },
      { genero: "Hombre", nivel_bienestar: "Medio" }, { genero: "Hombre", nivel_bienestar: "Bajo" },
      { genero: "Hombre", nivel_bienestar: "Bajo" }, { genero: "Hombre", nivel_bienestar: "Medio" },
      { genero: "Hombre", nivel_bienestar: "Alto" }, { genero: "Hombre", nivel_bienestar: "Bajo" },
      { genero: "Hombre", nivel_bienestar: "Medio" }, { genero: "Hombre", nivel_bienestar: "Bajo" },
      { genero: "Hombre", nivel_bienestar: "Medio" }, { genero: "Hombre", nivel_bienestar: "Alto" },
      { genero: "Hombre", nivel_bienestar: "Bajo" }, { genero: "Hombre", nivel_bienestar: "Medio" },
      { genero: "No binario", nivel_bienestar: "Medio" }, { genero: "No binario", nivel_bienestar: "Alto" },
      { genero: "No binario", nivel_bienestar: "Bajo" }, { genero: "No binario", nivel_bienestar: "Medio" },
    ],
  },

  /* Burbujas: tres variables continuas (posición X, Y y tamaño). */
  bubble: {
    name: "Sueño, agotamiento y carga laboral",
    description:
      "Tres variables continuas: horas de sueño (X), agotamiento (Y) y carga laboral semanal (tamaño de la burbuja). Permite leer una tercera dimensión sin recurrir al 3D.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "sueno", type: "continua", level: "razon", unit: "horas" },
      { name: "agotamiento", type: "continua", level: "intervalo", unit: "puntos" },
      { name: "carga", type: "discreta", level: "razon", unit: "horas/sem" },
    ],
    rows: [
      { sueno: 4.6, agotamiento: 40, carga: 52 }, { sueno: 5.1, agotamiento: 37, carga: 48 },
      { sueno: 5.6, agotamiento: 35, carga: 45 }, { sueno: 6.0, agotamiento: 33, carga: 44 },
      { sueno: 6.3, agotamiento: 31, carga: 42 }, { sueno: 6.6, agotamiento: 30, carga: 40 },
      { sueno: 6.9, agotamiento: 28, carga: 39 }, { sueno: 7.1, agotamiento: 27, carga: 38 },
      { sueno: 7.3, agotamiento: 25, carga: 36 }, { sueno: 7.6, agotamiento: 24, carga: 35 },
      { sueno: 7.9, agotamiento: 22, carga: 33 }, { sueno: 8.1, agotamiento: 21, carga: 31 },
      { sueno: 8.3, agotamiento: 19, carga: 30 }, { sueno: 8.6, agotamiento: 18, carga: 28 },
    ],
  },

  /* Meta-análisis: tamaños de efecto con IC (forest y funnel). */
  meta: {
    name: "Efecto de una intervención (meta-análisis)",
    description:
      "Tamaños de efecto (g de Hedges) de varios estudios sobre una intervención de bienestar, con sus intervalos de confianza. Base de los gráficos forest y funnel.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "estudio", type: "categorica", level: "nominal" },
      { name: "efecto", type: "continua", level: "intervalo", unit: "g" },
      { name: "ic_inf", type: "continua", level: "intervalo" },
      { name: "ic_sup", type: "continua", level: "intervalo" },
    ],
    rows: [
      { estudio: "García 2019", efecto: 0.45, ic_inf: 0.10, ic_sup: 0.80 },
      { estudio: "López 2020", efecto: 0.30, ic_inf: -0.05, ic_sup: 0.65 },
      { estudio: "Martín 2020", efecto: 0.62, ic_inf: 0.28, ic_sup: 0.96 },
      { estudio: "Ruiz 2021", efecto: 0.18, ic_inf: -0.20, ic_sup: 0.56 },
      { estudio: "Sanz 2021", efecto: 0.51, ic_inf: 0.20, ic_sup: 0.82 },
      { estudio: "Vidal 2022", efecto: 0.40, ic_inf: 0.02, ic_sup: 0.78 },
      { estudio: "Ortega 2022", efecto: 0.73, ic_inf: 0.30, ic_sup: 1.16 },
      { estudio: "Castro 2023", efecto: 0.25, ic_inf: -0.10, ic_sup: 0.60 },
    ],
  },

  /* Diferencial: efecto frente a significación por variable (volcano). */
  diffexp: {
    name: "Asociaciones por variable (diferencial)",
    description:
      "Tamaño de efecto y valor p de muchas variables comparadas entre dos condiciones. Base del volcano plot.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "variable", type: "categorica", level: "nominal" },
      { name: "efecto", type: "continua", level: "intervalo" },
      { name: "p_valor", type: "continua", level: "razon" },
    ],
    rows: [
      { variable: "Agotamiento", efecto: 0.92, p_valor: 0.0003 },
      { variable: "Cinismo", efecto: 0.74, p_valor: 0.0021 },
      { variable: "Sobrecarga", efecto: 1.21, p_valor: 0.00005 },
      { variable: "Ambigüedad", efecto: 0.33, p_valor: 0.084 },
      { variable: "Conflicto rol", efecto: 0.58, p_valor: 0.012 },
      { variable: "Autonomía", efecto: -0.81, p_valor: 0.0009 },
      { variable: "Apoyo jefe", efecto: -0.66, p_valor: 0.004 },
      { variable: "Apoyo pares", efecto: -0.49, p_valor: 0.031 },
      { variable: "Reconocimiento", efecto: -0.72, p_valor: 0.0018 },
      { variable: "Sentido", efecto: -0.95, p_valor: 0.0002 },
      { variable: "Edad", efecto: 0.12, p_valor: 0.42 },
      { variable: "Antigüedad", efecto: 0.21, p_valor: 0.19 },
      { variable: "Horas extra", efecto: 0.44, p_valor: 0.058 },
      { variable: "Pausas", efecto: -0.28, p_valor: 0.14 },
      { variable: "Teletrabajo", efecto: -0.15, p_valor: 0.38 },
      { variable: "Formación", efecto: -0.39, p_valor: 0.067 },
    ],
  },

  /* Clasificador: puntaje continuo y clase binaria (ROC y PR). */
  classifier: {
    name: "Cribado de riesgo (clasificador)",
    description:
      "Puntuación de un instrumento de cribado y la condición real (caso/control). Base de las curvas ROC y de precisión–recall.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "puntaje", type: "continua", level: "intervalo", unit: "puntos" },
      { name: "grupo", type: "categorica", level: "nominal" },
    ],
    rows: [
      { puntaje: 71, grupo: "Caso" }, { puntaje: 65, grupo: "Caso" },
      { puntaje: 80, grupo: "Caso" }, { puntaje: 58, grupo: "Caso" },
      { puntaje: 74, grupo: "Caso" }, { puntaje: 62, grupo: "Caso" },
      { puntaje: 69, grupo: "Caso" }, { puntaje: 77, grupo: "Caso" },
      { puntaje: 55, grupo: "Caso" }, { puntaje: 83, grupo: "Caso" },
      { puntaje: 60, grupo: "Caso" }, { puntaje: 72, grupo: "Caso" },
      { puntaje: 67, grupo: "Caso" }, { puntaje: 79, grupo: "Caso" },
      { puntaje: 51, grupo: "Caso" }, { puntaje: 64, grupo: "Caso" },
      { puntaje: 48, grupo: "Control" }, { puntaje: 55, grupo: "Control" },
      { puntaje: 42, grupo: "Control" }, { puntaje: 60, grupo: "Control" },
      { puntaje: 38, grupo: "Control" }, { puntaje: 52, grupo: "Control" },
      { puntaje: 45, grupo: "Control" }, { puntaje: 58, grupo: "Control" },
      { puntaje: 34, grupo: "Control" }, { puntaje: 49, grupo: "Control" },
      { puntaje: 56, grupo: "Control" }, { puntaje: 41, grupo: "Control" },
      { puntaje: 47, grupo: "Control" }, { puntaje: 63, grupo: "Control" },
      { puntaje: 39, grupo: "Control" }, { puntaje: 53, grupo: "Control" },
      { puntaje: 44, grupo: "Control" }, { puntaje: 50, grupo: "Control" },
    ],
  },

  /* Serie multivariada: indicadores semanales (multiline, área apilada, stream). */
  "timeseries-multi": {
    name: "Indicadores semanales de bienestar",
    description:
      "Promedios semanales de tres indicadores a lo largo de un trimestre. Varias series numéricas sobre un mismo eje temporal.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "semana", type: "temporal", level: "ordinal" },
      { name: "estres", type: "continua", level: "intervalo", unit: "puntos" },
      { name: "agotamiento", type: "continua", level: "intervalo", unit: "puntos" },
      { name: "satisfaccion", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { semana: 1, estres: 5.2, agotamiento: 4.0, satisfaccion: 7.1 },
      { semana: 2, estres: 5.4, agotamiento: 4.2, satisfaccion: 7.0 },
      { semana: 3, estres: 5.1, agotamiento: 4.3, satisfaccion: 6.8 },
      { semana: 4, estres: 5.8, agotamiento: 4.6, satisfaccion: 6.5 },
      { semana: 5, estres: 6.0, agotamiento: 4.9, satisfaccion: 6.3 },
      { semana: 6, estres: 6.3, agotamiento: 5.3, satisfaccion: 6.0 },
      { semana: 7, estres: 6.1, agotamiento: 5.5, satisfaccion: 5.9 },
      { semana: 8, estres: 6.6, agotamiento: 5.8, satisfaccion: 5.6 },
      { semana: 9, estres: 6.4, agotamiento: 6.0, satisfaccion: 5.7 },
      { semana: 10, estres: 5.9, agotamiento: 5.7, satisfaccion: 6.0 },
      { semana: 11, estres: 5.6, agotamiento: 5.4, satisfaccion: 6.3 },
      { semana: 12, estres: 5.3, agotamiento: 5.1, satisfaccion: 6.6 },
    ],
  },

  /* Serie estacional: dos años mensuales (estacional, lag, autocorrelación). */
  "seasonal-series": {
    name: "Carga emocional mensual (dos años)",
    description:
      "Promedio mensual con un patrón estacional anual repetido durante dos años. Útil para gráficos estacionales, de retardo y de autocorrelación.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "mes", type: "temporal", level: "ordinal" },
      { name: "valor", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { mes: 1, valor: 62 }, { mes: 2, valor: 60 }, { mes: 3, valor: 57 },
      { mes: 4, valor: 54 }, { mes: 5, valor: 51 }, { mes: 6, valor: 49 },
      { mes: 7, valor: 48 }, { mes: 8, valor: 50 }, { mes: 9, valor: 53 },
      { mes: 10, valor: 57 }, { mes: 11, valor: 60 }, { mes: 12, valor: 63 },
      { mes: 13, valor: 64 }, { mes: 14, valor: 62 }, { mes: 15, valor: 59 },
      { mes: 16, valor: 56 }, { mes: 17, valor: 53 }, { mes: 18, valor: 51 },
      { mes: 19, valor: 50 }, { mes: 20, valor: 52 }, { mes: 21, valor: 55 },
      { mes: 22, valor: 59 }, { mes: 23, valor: 62 }, { mes: 24, valor: 65 },
    ],
  },

  /* Multivariado: perfiles por departamento (PCA, clustering, MDS, t-SNE…). */
  multivar: {
    name: "Perfiles laborales por departamento",
    description:
      "Cuatro indicadores numéricos por persona, agrupadas por departamento. Base de PCA, biplot, clustering, MDS, dendrograma y t-SNE.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "departamento", type: "categorica", level: "nominal" },
      { name: "agotamiento", type: "continua", level: "intervalo", unit: "puntos" },
      { name: "sueno", type: "continua", level: "razon", unit: "horas" },
      { name: "apoyo", type: "continua", level: "intervalo", unit: "puntos" },
      { name: "satisfaccion", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { departamento: "Atención", agotamiento: 38, sueno: 5.2, apoyo: 45, satisfaccion: 5.0 },
      { departamento: "Atención", agotamiento: 36, sueno: 5.5, apoyo: 48, satisfaccion: 5.2 },
      { departamento: "Atención", agotamiento: 41, sueno: 4.9, apoyo: 42, satisfaccion: 4.6 },
      { departamento: "Atención", agotamiento: 34, sueno: 5.8, apoyo: 50, satisfaccion: 5.4 },
      { departamento: "Atención", agotamiento: 39, sueno: 5.1, apoyo: 44, satisfaccion: 4.9 },
      { departamento: "Atención", agotamiento: 37, sueno: 5.4, apoyo: 47, satisfaccion: 5.1 },
      { departamento: "Atención", agotamiento: 40, sueno: 5.0, apoyo: 43, satisfaccion: 4.7 },
      { departamento: "Administración", agotamiento: 18, sueno: 7.8, apoyo: 68, satisfaccion: 7.6 },
      { departamento: "Administración", agotamiento: 22, sueno: 7.4, apoyo: 64, satisfaccion: 7.2 },
      { departamento: "Administración", agotamiento: 16, sueno: 8.1, apoyo: 71, satisfaccion: 8.0 },
      { departamento: "Administración", agotamiento: 24, sueno: 7.2, apoyo: 62, satisfaccion: 7.0 },
      { departamento: "Administración", agotamiento: 20, sueno: 7.6, apoyo: 66, satisfaccion: 7.4 },
      { departamento: "Administración", agotamiento: 19, sueno: 7.9, apoyo: 69, satisfaccion: 7.8 },
      { departamento: "Administración", agotamiento: 21, sueno: 7.5, apoyo: 65, satisfaccion: 7.3 },
      { departamento: "Dirección", agotamiento: 28, sueno: 6.6, apoyo: 55, satisfaccion: 6.2 },
      { departamento: "Dirección", agotamiento: 31, sueno: 6.4, apoyo: 52, satisfaccion: 6.0 },
      { departamento: "Dirección", agotamiento: 26, sueno: 6.9, apoyo: 58, satisfaccion: 6.6 },
      { departamento: "Dirección", agotamiento: 30, sueno: 6.5, apoyo: 54, satisfaccion: 6.1 },
      { departamento: "Dirección", agotamiento: 27, sueno: 6.8, apoyo: 57, satisfaccion: 6.5 },
      { departamento: "Dirección", agotamiento: 33, sueno: 6.3, apoyo: 51, satisfaccion: 6.0 },
      { departamento: "Dirección", agotamiento: 29, sueno: 6.7, apoyo: 56, satisfaccion: 6.4 },
    ],
  },

  /* Geográfico — países: métrica por país (choropleth). Nombres en inglés
     para casar con el mapa base de Plotly (locationmode "country names"). */
  "geo-countries": {
    name: "Índice de bienestar por país",
    description:
      "Una métrica agregada por país. Base del mapa de coropletas; los nombres están en inglés para coincidir con el mapa base.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "pais", type: "categorica", level: "nominal" },
      { name: "bienestar", type: "continua", level: "intervalo", unit: "índice" },
    ],
    rows: [
      { pais: "Spain", bienestar: 71 }, { pais: "Portugal", bienestar: 68 },
      { pais: "France", bienestar: 66 }, { pais: "Germany", bienestar: 70 },
      { pais: "Italy", bienestar: 63 }, { pais: "Mexico", bienestar: 58 },
      { pais: "Colombia", bienestar: 55 }, { pais: "Argentina", bienestar: 60 },
      { pais: "Chile", bienestar: 62 }, { pais: "Peru", bienestar: 54 },
      { pais: "Brazil", bienestar: 57 }, { pais: "United States", bienestar: 67 },
    ],
  },

  /* Geográfico — ciudades: magnitud sobre coordenadas (mapa de burbujas). */
  "geo-cities": {
    name: "Participantes por ciudad",
    description:
      "Número de participantes en cada ciudad, con sus coordenadas. Base del mapa de burbujas.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "ciudad", type: "categorica", level: "nominal" },
      { name: "lat", type: "continua", level: "razon", unit: "°" },
      { name: "lon", type: "continua", level: "razon", unit: "°" },
      { name: "participantes", type: "continua", level: "razon", unit: "personas" },
    ],
    rows: [
      { ciudad: "Madrid", lat: 40.42, lon: -3.70, participantes: 320 },
      { ciudad: "Barcelona", lat: 41.39, lon: 2.17, participantes: 240 },
      { ciudad: "Ciudad de México", lat: 19.43, lon: -99.13, participantes: 410 },
      { ciudad: "Bogotá", lat: 4.71, lon: -74.07, participantes: 280 },
      { ciudad: "Buenos Aires", lat: -34.60, lon: -58.38, participantes: 260 },
      { ciudad: "Lima", lat: -12.05, lon: -77.04, participantes: 190 },
      { ciudad: "Santiago", lat: -33.45, lon: -70.67, participantes: 175 },
      { ciudad: "Montevideo", lat: -34.90, lon: -56.16, participantes: 95 },
      { ciudad: "Quito", lat: -0.18, lon: -78.47, participantes: 120 },
      { ciudad: "Lisboa", lat: 38.72, lon: -9.14, participantes: 150 },
    ],
  },

  /* Geográfico — eventos: puntos con intensidad (densidad y calor). Tres
     focos (Iberia, Valle de México, Río de la Plata). */
  "geo-events": {
    name: "Eventos georreferenciados",
    description:
      "Ubicaciones de eventos con una intensidad asociada, concentradas en tres focos. Base de los mapas de densidad y de calor.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "lat", type: "continua", level: "razon", unit: "°" },
      { name: "lon", type: "continua", level: "razon", unit: "°" },
      { name: "intensidad", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: [
      { lat: 40.4, lon: -3.7, intensidad: 82 }, { lat: 40.6, lon: -3.5, intensidad: 75 },
      { lat: 40.2, lon: -3.9, intensidad: 68 }, { lat: 41.0, lon: -4.1, intensidad: 60 },
      { lat: 39.9, lon: -3.4, intensidad: 71 }, { lat: 40.5, lon: -4.0, intensidad: 66 },
      { lat: 41.4, lon: 2.2, intensidad: 64 }, { lat: 41.6, lon: 2.0, intensidad: 58 },
      { lat: 41.2, lon: 1.9, intensidad: 52 }, { lat: 38.7, lon: -9.1, intensidad: 55 },
      { lat: 19.4, lon: -99.1, intensidad: 88 }, { lat: 19.6, lon: -99.0, intensidad: 80 },
      { lat: 19.2, lon: -99.3, intensidad: 74 }, { lat: 19.5, lon: -98.9, intensidad: 69 },
      { lat: 19.3, lon: -99.2, intensidad: 77 }, { lat: 19.7, lon: -99.2, intensidad: 63 },
      { lat: 20.6, lon: -100.4, intensidad: 51 }, { lat: 18.8, lon: -99.2, intensidad: 47 },
      { lat: -34.6, lon: -58.4, intensidad: 79 }, { lat: -34.8, lon: -58.2, intensidad: 72 },
      { lat: -34.5, lon: -58.6, intensidad: 65 }, { lat: -34.9, lon: -58.5, intensidad: 61 },
      { lat: -34.4, lon: -58.3, intensidad: 70 }, { lat: -34.7, lon: -58.7, intensidad: 58 },
      { lat: -34.6, lon: -58.0, intensidad: 54 }, { lat: -33.0, lon: -58.3, intensidad: 44 },
    ],
  },

  /* Grupos con distribución: una variable numérica por grupo (ridgeline,
     beeswarm, raincloud). Generado de forma determinista. */
  "groups-dist": {
    name: "Puntaje de bienestar por turno",
    description:
      "Distribución de un puntaje en tres turnos, con varias observaciones por grupo. Base de ridgeline, beeswarm y raincloud.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "turno", type: "categorica", level: "nominal" },
      { name: "puntaje", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: (function () {
      let s = 20260614 >>> 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const norm = (m, sd) => { const u = Math.max(rnd(), 1e-9); const v = rnd(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
      const groups = [["Mañana", 58, 8], ["Tarde", 64, 7], ["Noche", 49, 9]];
      const out = [];
      for (const [g, m, sd] of groups) for (let i = 0; i < 16; i += 1) out.push({ turno: g, puntaje: Math.round(norm(m, sd) * 10) / 10 });
      return out;
    })(),
  },

  /* Nube densa: dos variables numéricas correlacionadas (hexbin). */
  "scatter-cloud": {
    name: "Sueño y agotamiento (nube densa)",
    description:
      "Relación entre horas de sueño y agotamiento con muchos puntos, ideal para binning hexagonal. Generado de forma determinista.",
    source: "Datos simulados con fines ilustrativos",
    variables: [
      { name: "horas_sueno", type: "continua", level: "razon", unit: "horas" },
      { name: "agotamiento", type: "continua", level: "intervalo", unit: "puntos" },
    ],
    rows: (function () {
      let s = 987654321 >>> 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const norm = (m, sd) => { const u = Math.max(rnd(), 1e-9); const v = rnd(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
      const out = [];
      for (let i = 0; i < 120; i += 1) {
        const sueno = Math.max(3.5, Math.min(9.5, norm(6.8, 1.0)));
        const agot = Math.max(5, Math.min(60, 70 - 6 * sueno + norm(0, 5)));
        out.push({ horas_sueno: Math.round(sueno * 10) / 10, agotamiento: Math.round(agot * 10) / 10 });
      }
      return out;
    })(),
  },
};

/**
 * Devuelve el dataset de ejemplo asociado a una clave (o null si aún no se ha
 * sembrado uno para ese gráfico).
 */
export function getExample(key) {
  return EXAMPLES[key] || null;
}

/** Indica si existe dataset de ejemplo para una clave dada. */
export function hasExample(key) {
  return Object.prototype.hasOwnProperty.call(EXAMPLES, key);
}
