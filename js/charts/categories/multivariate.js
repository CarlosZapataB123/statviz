/**
 * multivariate.js — Constructores de la categoría Multivariado.
 *
 * Reducción de dimensionalidad y agrupamiento calculados con el motor
 * js/stats/multivariate.js: componentes principales (PCA y biplot), k-medias,
 * escalado multidimensional clásico (MDS), dendrograma jerárquico y t-SNE.
 * Todos operan sobre las variables numéricas del conjunto, estandarizadas.
 */

import { num } from "../format.js";
import {
  pca, kmeans, classicalMDS, distanceMatrix, hclust, tsne, standardizeColumns,
} from "../../stats/multivariate.js";

/* ----------------------------- Utilidades ------------------------------ */
function numericData(dataset) {
  const names = dataset.variables.filter((v) => v.storageType === "numeric").map((v) => v.name);
  const rows = dataset.rows.filter((r) => names.every((nm) => typeof r[nm] === "number" && Number.isFinite(r[nm])));
  const M = rows.map((r) => names.map((nm) => r[nm]));
  return { names, rows, M };
}

/** Etiquetas de color alineadas a las filas, o null si no hay variable. */
function colorLabels(rows, colorVar) {
  if (!colorVar) return null;
  return rows.map((r) => String(r[colorVar] ?? "—").trim());
}

/** Construye trazas de dispersión, una por categoría si hay etiquetas. */
function scatterByGroup(xy, labels, hov) {
  if (!labels) {
    return [{ type: "scatter", mode: "markers", name: "Casos",
      x: xy.map((p) => p[0]), y: xy.map((p) => p[1]),
      marker: { size: 8, opacity: 0.8 }, hovertemplate: hov }];
  }
  const groups = new Map();
  xy.forEach((p, i) => {
    const g = labels[i];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  });
  return [...groups].map(([g, pts]) => ({
    type: "scatter", mode: "markers", name: g,
    x: pts.map((p) => p[0]), y: pts.map((p) => p[1]),
    marker: { size: 8, opacity: 0.8 },
  }));
}

const COLOR_ROLE = { key: "color", label: "Colorear por (opcional)", accepts: ["categorical"], required: false,
  hint: "Tiñe los puntos según una variable categórica." };

/* =============================== PCA =================================== */
const pcaChart = {
  usesAllNumeric: true,
  roles: [COLOR_ROLE],
  build(dataset, config) {
    const { names, rows, M } = numericData(dataset);
    const r = pca(M, 2);
    const labels = colorLabels(rows, config.color);
    return {
      traces: scatterByGroup(r.scores, labels, "PC1 %{x:.2f}<br>PC2 %{y:.2f}<extra></extra>"),
      layout: {
        xaxis: { title: { text: `PC1 (${num(r.explained[0] * 100, 1)} %)` } },
        yaxis: { title: { text: `PC2 (${num(r.explained[1] * 100, 1)} %)` } },
        showlegend: Boolean(labels),
      },
      reading: {
        lead: `Las dos primeras componentes resumen ${names.length} variables y retienen el ${num((r.explained[0] + r.explained[1]) * 100, 1)} % de la varianza total (PC1 ${num(r.explained[0] * 100, 1)} %, PC2 ${num(r.explained[1] * 100, 1)} %).`,
        stats: [
          { k: "Variables", v: num(names.length, 0) },
          { k: "PC1", v: `${num(r.explained[0] * 100, 1)} %` },
          { k: "PC2", v: `${num(r.explained[1] * 100, 1)} %` },
          { k: "Acumulado", v: `${num((r.explained[0] + r.explained[1]) * 100, 1)} %` },
        ],
        notes: [
          "Cada punto es un caso proyectado; la cercanía indica perfiles parecidos en las variables originales.",
          "El PCA se calcula sobre la matriz de correlación (variables estandarizadas), por lo que no depende de las unidades.",
        ],
        cautions: ["Si las dos primeras componentes retienen poca varianza, la proyección 2D distorsiona la estructura real."],
      },
    };
  },
};

/* ============================== Biplot ================================= */
const biplotChart = {
  usesAllNumeric: true,
  roles: [COLOR_ROLE],
  build(dataset, config) {
    const { names, rows, M } = numericData(dataset);
    const r = pca(M, 2);
    const labels = colorLabels(rows, config.color);

    const scoreMax = Math.max(...r.scores.flatMap((p) => p.map(Math.abs))) || 1;
    const loadMax = Math.max(...r.loadings.flatMap((p) => p.map(Math.abs))) || 1;
    const scale = (scoreMax / loadMax) * 0.85;

    const annotations = names.map((nm, j) => ({
      x: r.loadings[j][0] * scale, y: r.loadings[j][1] * scale,
      ax: 0, ay: 0, axref: "x", ayref: "y",
      text: nm, showarrow: true, arrowhead: 3, arrowsize: 1, arrowwidth: 1.2,
      arrowcolor: "rgba(110,120,140,0.9)", font: { size: 11 },
    }));

    return {
      traces: scatterByGroup(r.scores, labels, "PC1 %{x:.2f}<br>PC2 %{y:.2f}<extra></extra>"),
      layout: {
        xaxis: { title: { text: `PC1 (${num(r.explained[0] * 100, 1)} %)` } },
        yaxis: { title: { text: `PC2 (${num(r.explained[1] * 100, 1)} %)` } },
        annotations,
        showlegend: Boolean(labels),
      },
      reading: {
        lead: `Biplot: superpone los casos (puntos) y las variables (flechas) en el plano de las dos primeras componentes (${num((r.explained[0] + r.explained[1]) * 100, 1)} % de varianza).`,
        stats: names.map((nm, j) => ({ k: nm, v: `(${num(r.loadings[j][0], 2)}, ${num(r.loadings[j][1], 2)})` })),
        notes: [
          "Flechas largas y en la misma dirección señalan variables correlacionadas positivamente; opuestas, correlación negativa; perpendiculares, independencia aproximada.",
          "Un caso se proyecta alto en una variable si está en la dirección de su flecha.",
        ],
        cautions: ["La interpretación de las flechas solo es fiable si las dos componentes retienen suficiente varianza."],
      },
    };
  },
};

/* ============================= Clustering ============================== */
const clusteringChart = {
  usesAllNumeric: true,
  paramRoles: [
    { key: "k", label: "Número de grupos (k)", type: "number", min: 2, max: 8, step: 1, default: 3,
      hint: "Cuántos cúmulos busca el algoritmo k-medias." },
  ],
  build(dataset, config) {
    const { names, M } = numericData(dataset);
    const k = Math.max(2, Math.round(config.k ?? 3));
    const { Z } = standardizeColumns(M);
    const km = kmeans(Z, k, { seed: 42 });
    const r = pca(M, 2);
    const labels = km.labels.map((c) => `Grupo ${c + 1}`);
    const sizes = Array.from({ length: k }, (_, c) => km.labels.filter((l) => l === c).length);

    return {
      traces: scatterByGroup(r.scores, labels, "PC1 %{x:.2f}<br>PC2 %{y:.2f}<extra></extra>"),
      layout: {
        xaxis: { title: { text: `PC1 (${num(r.explained[0] * 100, 1)} %)` } },
        yaxis: { title: { text: `PC2 (${num(r.explained[1] * 100, 1)} %)` } },
        showlegend: true,
      },
      reading: {
        lead: `k-medias con k = ${k} sobre ${names.length} variables estandarizadas, proyectado en las dos primeras componentes. Tamaños de los grupos: ${sizes.join(", ")}.`,
        stats: [
          { k: "Grupos (k)", v: num(k, 0) },
          { k: "Inercia", v: num(km.inertia) },
          ...sizes.map((s, c) => ({ k: `Grupo ${c + 1}`, v: `${s} casos` })),
        ],
        notes: [
          "k-medias minimiza la distancia de cada caso al centro de su grupo; la inercia es esa suma de distancias al cuadrado.",
          "Para elegir k, busca el “codo” donde añadir más grupos deja de reducir la inercia notablemente.",
        ],
        cautions: ["k-medias asume grupos esféricos y de tamaño similar, y depende de la inicialización (aquí fijada). Estandariza siempre antes."],
      },
    };
  },
};

/* ============================ MDS clásico ============================== */
const mdsChart = {
  usesAllNumeric: true,
  roles: [COLOR_ROLE],
  build(dataset, config) {
    const { names, rows, M } = numericData(dataset);
    const { Z } = standardizeColumns(M);
    const D = distanceMatrix(Z);
    const { coords, explained } = classicalMDS(D, 2);
    const labels = colorLabels(rows, config.color);
    return {
      traces: scatterByGroup(coords, labels, "Dim1 %{x:.2f}<br>Dim2 %{y:.2f}<extra></extra>"),
      layout: {
        xaxis: { title: { text: `Dimensión 1 (${num(explained[0] * 100, 1)} %)` } },
        yaxis: { title: { text: `Dimensión 2 (${num(explained[1] * 100, 1)} %)` } },
        showlegend: Boolean(labels),
      },
      reading: {
        lead: `Escalado multidimensional clásico: sitúa ${rows.length} casos en 2D preservando sus distancias en el espacio de ${names.length} variables. Las dos dimensiones recogen el ${num((explained[0] + explained[1]) * 100, 1)} % de la variabilidad.`,
        stats: [
          { k: "Casos", v: num(rows.length, 0) },
          { k: "Dim 1", v: `${num(explained[0] * 100, 1)} %` },
          { k: "Dim 2", v: `${num(explained[1] * 100, 1)} %` },
        ],
        notes: [
          "Lo que importa son las distancias relativas: casos cercanos en el mapa son similares en las variables originales.",
          "Con distancias euclídeas, el MDS clásico coincide con un PCA sobre los mismos datos.",
        ],
        cautions: ["Los ejes no tienen interpretación directa; no los leas como variables."],
      },
    };
  },
};

/* ============================ Dendrograma ============================== */
const dendrogramChart = {
  usesAllNumeric: true,
  roles: [{ key: "label", label: "Etiqueta de hoja (opcional)", accepts: ["categorical"], required: false,
    hint: "Texto bajo cada hoja; si se omite, se usa el índice." }],
  build(dataset, config) {
    const { names, rows, M } = numericData(dataset);
    const { Z } = standardizeColumns(M);
    const D = distanceMatrix(Z);
    const h = hclust(D);

    // Segmentos en una sola traza, separados por null.
    const x = [];
    const y = [];
    for (const seg of h.segments) {
      x.push(...seg.x, null);
      y.push(...seg.y, null);
    }
    const leafText = h.leafOrder.map((idx) => (config.label ? String(rows[idx][config.label]) : `#${idx + 1}`));

    return {
      traces: [{ type: "scatter", mode: "lines", x, y, line: { width: 1.5 }, hoverinfo: "skip" }],
      layout: {
        xaxis: { title: { text: "" }, tickvals: h.leafOrder.map((_, i) => i), ticktext: leafText,
          tickangle: leafText.some((t) => t.length > 3) ? -45 : 0 },
        yaxis: { title: { text: "Distancia (enlace promedio)" }, rangemode: "tozero" },
        showlegend: false,
      },
      reading: {
        lead: `Agrupamiento jerárquico de ${rows.length} casos por enlace promedio sobre ${names.length} variables. La altura de cada unión es la distancia a la que se fusionan los grupos; la mayor es ${num(h.maxHeight)}.`,
        stats: [{ k: "Casos", v: num(rows.length, 0) }, { k: "Altura máxima", v: num(h.maxHeight) }],
        notes: [
          "Cortar el árbol a una altura define los grupos: cuanto más bajo el corte, más grupos.",
          "Uniones a baja altura agrupan casos muy parecidos; las uniones altas separan bloques distintos.",
        ],
        cautions: ["El número de grupos depende de dónde cortes y del tipo de enlace; no hay una respuesta única."],
      },
    };
  },
};

/* =============================== t-SNE ================================= */
const tsneChart = {
  usesAllNumeric: true,
  roles: [COLOR_ROLE],
  paramRoles: [
    { key: "perplexity", label: "Perplejidad", type: "number", min: 2, max: 30, step: 1, default: 5,
      hint: "Tamaño efectivo del vecindario local." },
    { key: "iters", label: "Iteraciones", type: "number", min: 100, max: 800, step: 50, default: 300,
      hint: "Pasos de optimización del descenso por gradiente." },
  ],
  build(dataset, config) {
    const { names, rows, M } = numericData(dataset);
    const perplexity = Math.min(config.perplexity ?? 5, Math.max(2, rows.length - 1));
    const iters = Math.round(config.iters ?? 300);
    const Y = tsne(M, { perplexity, iters, seed: 42 });
    const labels = colorLabels(rows, config.color);
    return {
      traces: scatterByGroup(Y, labels, "%{x:.2f}, %{y:.2f}<extra></extra>"),
      layout: {
        xaxis: { title: { text: "t-SNE 1" }, showticklabels: false },
        yaxis: { title: { text: "t-SNE 2" }, showticklabels: false },
        showlegend: Boolean(labels),
      },
      reading: {
        lead: `t-SNE proyecta ${rows.length} casos de ${names.length} variables en 2D conservando la vecindad local (perplejidad ${num(perplexity, 0)}, ${iters} iteraciones). Los cúmulos compactos agrupan casos parecidos.`,
        stats: [
          { k: "Casos", v: num(rows.length, 0) },
          { k: "Perplejidad", v: num(perplexity, 0) },
          { k: "Iteraciones", v: num(iters, 0) },
        ],
        notes: [
          "Preserva la estructura LOCAL: los grupos cercanos son fiables, pero las distancias entre cúmulos y sus tamaños no son interpretables.",
          "La perplejidad equilibra atención local y global; pruébala entre 5 y 30 según el tamaño de la muestra.",
        ],
        cautions: ["t-SNE es estocástico (aquí con semilla fija) y puede formar cúmulos aparentes incluso sin estructura: contrástalo con PCA."],
      },
    };
  },
};

/* ---------------------- Variantes 3D (modo 3D) ------------------------- */
function scatterByGroup3d(xyz, labels) {
  if (!labels) {
    return [{ type: "scatter3d", mode: "markers", name: "Casos",
      x: xyz.map((p) => p[0]), y: xyz.map((p) => p[1]), z: xyz.map((p) => p[2]),
      marker: { size: 4, opacity: 0.85 } }];
  }
  const groups = new Map();
  xyz.forEach((p, i) => { const g = labels[i]; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); });
  return [...groups].map(([g, pts]) => ({
    type: "scatter3d", mode: "markers", name: g,
    x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), z: pts.map((p) => p[2]),
    marker: { size: 4, opacity: 0.85 },
  }));
}

pcaChart.build3d = (dataset, config) => {
  const { names, rows, M } = numericData(dataset);
  const r = pca(M, 3);
  const labels = colorLabels(rows, config.color);
  const pct = (i) => `${num((r.explained[i] || 0) * 100, 1)} %`;
  return {
    traces: scatterByGroup3d(r.scores, labels),
    layout: { scene: { xaxis: { title: { text: `PC1 (${pct(0)})` } }, yaxis: { title: { text: `PC2 (${pct(1)})` } }, zaxis: { title: { text: `PC3 (${pct(2)})` } } }, showlegend: Boolean(labels) },
    reading: {
      lead: `Tres primeras componentes de ${names.length} variables (PC1 ${pct(0)}, PC2 ${pct(1)}, PC3 ${pct(2)}); en conjunto retienen el ${num((r.explained[0] + r.explained[1] + r.explained[2]) * 100, 1)} %. Gira la escena para apreciar la estructura.`,
      stats: [{ k: "PC1", v: pct(0) }, { k: "PC2", v: pct(1) }, { k: "PC3", v: pct(2) }],
      notes: ["La tercera componente añade la varianza que el plano 2D no podía mostrar.", "La cercanía en el espacio 3D sigue indicando perfiles parecidos."],
      cautions: ["Aun con tres ejes, si la varianza retenida es baja la proyección distorsiona la realidad."],
    },
  };
};

clusteringChart.build3d = (dataset, config) => {
  const { names, M } = numericData(dataset);
  const k = Math.max(2, Math.round(config.k ?? 3));
  const { Z } = standardizeColumns(M);
  const km = kmeans(Z, k, { seed: 42 });
  const r = pca(M, 3);
  const labels = km.labels.map((c) => `Grupo ${c + 1}`);
  return {
    traces: scatterByGroup3d(r.scores, labels),
    layout: { scene: { xaxis: { title: { text: "PC1" } }, yaxis: { title: { text: "PC2" } }, zaxis: { title: { text: "PC3" } } }, showlegend: true },
    reading: {
      lead: `k-medias (k = ${k}) sobre ${names.length} variables, proyectado en las tres primeras componentes. La tercera dimensión ayuda a separar grupos que en 2D se superponían.`,
      stats: [{ k: "Grupos (k)", v: num(k, 0) }, { k: "Inercia", v: num(km.inertia) }],
      notes: ["Rotar la nube revela si los cúmulos están realmente separados o solo lo parecían en una proyección."],
      cautions: ["k-medias asume grupos esféricos; la vista 3D no cambia ese supuesto."],
    },
  };
};

mdsChart.build3d = (dataset, config) => {
  const { names, rows, M } = numericData(dataset);
  const { Z } = standardizeColumns(M);
  const { coords, explained } = classicalMDS(distanceMatrix(Z), 3);
  const labels = colorLabels(rows, config.color);
  return {
    traces: scatterByGroup3d(coords, labels),
    layout: { scene: { xaxis: { title: { text: "Dim 1" } }, yaxis: { title: { text: "Dim 2" } }, zaxis: { title: { text: "Dim 3" } } }, showlegend: Boolean(labels) },
    reading: {
      lead: `MDS clásico a 3D de ${rows.length} casos; las tres dimensiones recogen el ${num((explained[0] + explained[1] + explained[2]) * 100, 1)} % de la variabilidad de las distancias.`,
      stats: [{ k: "Dim 1", v: `${num(explained[0] * 100, 1)} %` }, { k: "Dim 2", v: `${num(explained[1] * 100, 1)} %` }, { k: "Dim 3", v: `${num(explained[2] * 100, 1)} %` }],
      notes: ["Una dimensión más preserva mejor las distancias originales que el mapa plano."],
      cautions: ["Los ejes no tienen interpretación directa; léelos como distancias relativas."],
    },
  };
};

tsneChart.build3d = (dataset, config) => {
  const { names, rows, M } = numericData(dataset);
  const perplexity = Math.min(config.perplexity ?? 5, Math.max(2, rows.length - 1));
  const iters = Math.round(config.iters ?? 300);
  const Y = tsne(M, { perplexity, iters, seed: 42, dims: 3 });
  const labels = colorLabels(rows, config.color);
  return {
    traces: scatterByGroup3d(Y, labels),
    layout: { scene: { xaxis: { title: { text: "t-SNE 1" } }, yaxis: { title: { text: "t-SNE 2" } }, zaxis: { title: { text: "t-SNE 3" } } }, showlegend: Boolean(labels) },
    reading: {
      lead: `t-SNE a 3D de ${rows.length} casos de ${names.length} variables (perplejidad ${num(perplexity, 0)}). La vecindad local se conserva en tres dimensiones.`,
      stats: [{ k: "Casos", v: num(rows.length, 0) }, { k: "Perplejidad", v: num(perplexity, 0) }, { k: "Iteraciones", v: num(iters, 0) }],
      notes: ["Preserva la estructura local; tamaños y distancias entre cúmulos siguen sin ser interpretables."],
      cautions: ["Estocástico (semilla fija): contrástalo con PCA antes de concluir."],
    },
  };
};

/* ------------------------------ Exportación ---------------------------- */
export const multivariateBuilders = {
  pca: pcaChart,
  biplot: biplotChart,
  clustering: clusteringChart,
  mds: mdsChart,
  dendrogram: dendrogramChart,
  tsne: tsneChart,
};
