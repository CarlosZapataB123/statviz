/**
 * umap.js (categoría) — Constructor del gráfico UMAP.
 *
 * Proyecta todas las variables numéricas a 2D con el motor js/stats/umap.js y
 * colorea opcionalmente por una categoría. Completa la categoría Multivariado.
 */

import { num } from "../format.js";
import { umap } from "../../stats/umap.js";

function numericMatrix(dataset) {
  const names = dataset.variables.filter((v) => v.storageType === "numeric").map((v) => v.name);
  const rows = dataset.rows.filter((r) => names.every((nm) => typeof r[nm] === "number" && Number.isFinite(r[nm])));
  return { names, rows, M: rows.map((r) => names.map((nm) => r[nm])) };
}

function groupedScatter(xy, labels) {
  if (!labels) {
    return [{ type: "scatter", mode: "markers", name: "Casos",
      x: xy.map((p) => p[0]), y: xy.map((p) => p[1]), marker: { size: 8, opacity: 0.8 },
      hovertemplate: "%{x:.2f}, %{y:.2f}<extra></extra>" }];
  }
  const groups = new Map();
  xy.forEach((p, i) => {
    const g = labels[i];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  });
  return [...groups].map(([g, pts]) => ({
    type: "scatter", mode: "markers", name: g,
    x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), marker: { size: 8, opacity: 0.8 },
  }));
}

const HUE_ROLE = { key: "color", label: "Colorear por (opcional)", accepts: ["categorical"], required: false,
  hint: "Tiñe los puntos según una variable categórica." };

const umapChart = {
  usesAllNumeric: true,
  roles: [HUE_ROLE],
  paramRoles: [
    { key: "vecinos", label: "Vecinos (n_neighbors)", type: "number", min: 2, max: 50, step: 1, default: 8,
      hint: "Tamaño del vecindario: bajo resalta estructura local; alto, global." },
    { key: "minDist", label: "Distancia mínima", type: "number", min: 0, max: 0.99, step: 0.05, default: 0.1,
      hint: "Cuán juntos pueden quedar los puntos en el mapa." },
    { key: "epocas", label: "Épocas", type: "number", min: 50, max: 800, step: 50, default: 300,
      hint: "Iteraciones de optimización del layout." },
  ],
  build(dataset, config) {
    const { names, rows, M } = numericMatrix(dataset);
    const nNeighbors = Math.min(Math.round(config.vecinos ?? 8), Math.max(2, rows.length - 1));
    const minDist = config.minDist ?? 0.1;
    const nEpochs = Math.round(config.epocas ?? 300);
    const Y = umap(M, { nNeighbors, minDist, nEpochs, seed: 42 });
    const labels = config.color ? rows.map((r) => String(r[config.color] ?? "—").trim()) : null;

    return {
      traces: groupedScatter(Y, labels),
      layout: {
        xaxis: { title: { text: "UMAP 1" }, showticklabels: false },
        yaxis: { title: { text: "UMAP 2" }, showticklabels: false },
        showlegend: Boolean(labels),
      },
      reading: {
        lead: `UMAP proyecta ${rows.length} casos de ${names.length} variables a 2D (vecinos ${nNeighbors}, distancia mínima ${num(minDist, 2)}, ${nEpochs} épocas). Conserva la estructura local y, mejor que t-SNE, parte de la global.`,
        stats: [
          { k: "Casos", v: num(rows.length, 0) },
          { k: "Vecinos", v: num(nNeighbors, 0) },
          { k: "Distancia mín.", v: num(minDist, 2) },
        ],
        notes: [
          "Construye un grafo de vecindades difuso en alta dimensión y busca una disposición 2D que lo reproduzca.",
          "Pocos vecinos enfatizan agrupamientos finos; muchos, la forma global. La distancia mínima controla lo apretados que se ven los cúmulos.",
        ],
        cautions: [
          "Como en t-SNE, los tamaños de los cúmulos y las distancias entre ellos no son cuantitativamente interpretables.",
          "Es estocástico (aquí con semilla fija) y sensible a sus parámetros: contrasta varias configuraciones y apóyate en PCA.",
        ],
      },
    };
  },
};

function umapScatter3d(xyz, labels) {
  if (!labels) {
    return [{ type: "scatter3d", mode: "markers", name: "Casos",
      x: xyz.map((p) => p[0]), y: xyz.map((p) => p[1]), z: xyz.map((p) => p[2]), marker: { size: 4, opacity: 0.85 } }];
  }
  const groups = new Map();
  xyz.forEach((p, i) => { const g = labels[i]; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); });
  return [...groups].map(([g, pts]) => ({
    type: "scatter3d", mode: "markers", name: g,
    x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), z: pts.map((p) => p[2]), marker: { size: 4, opacity: 0.85 },
  }));
}

umapChart.build3d = (dataset, config) => {
  const { names, rows, M } = numericMatrix(dataset);
  const nNeighbors = Math.min(Math.round(config.vecinos ?? 8), Math.max(2, rows.length - 1));
  const minDist = config.minDist ?? 0.1;
  const nEpochs = Math.round(config.epocas ?? 300);
  const Y = umap(M, { nNeighbors, minDist, nEpochs, seed: 42, dims: 3 });
  const labels = config.color ? rows.map((r) => String(r[config.color] ?? "—").trim()) : null;
  return {
    traces: umapScatter3d(Y, labels),
    layout: { scene: { xaxis: { title: { text: "UMAP 1" } }, yaxis: { title: { text: "UMAP 2" } }, zaxis: { title: { text: "UMAP 3" } } }, showlegend: Boolean(labels) },
    reading: {
      lead: `UMAP a 3D de ${rows.length} casos de ${names.length} variables (vecinos ${nNeighbors}, distancia mínima ${num(minDist, 2)}). Tres dimensiones dan más margen para reflejar la estructura del grafo de vecindades.`,
      stats: [{ k: "Casos", v: num(rows.length, 0) }, { k: "Vecinos", v: num(nNeighbors, 0) }, { k: "Distancia mín.", v: num(minDist, 2) }],
      notes: ["La dimensión adicional suele preservar mejor la estructura global que el mapa 2D.", "Gira la escena para distinguir cúmulos que se solapaban al proyectar en un plano."],
      cautions: ["Como en 2D, tamaños y separaciones entre cúmulos no son cuantitativamente interpretables; es estocástico (semilla fija)."],
    },
  };
};

export const umapBuilders = { umap: umapChart };
