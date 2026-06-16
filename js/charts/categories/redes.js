/**
 * redes.js — Constructores de la categoría Redes (y la red de asociación de
 * la categoría Asociación, que comparte motor).
 *
 *  - network / force-directed: grafo de co-ocurrencia entre dos variables
 *    categóricas; difieren en la disposición (circular vs. por fuerzas).
 *  - sankey: diagrama de flujos entre categorías (trazo nativo de Plotly).
 *  - chord: relaciones entre categorías dispuestas en círculo, con conectores
 *    curvos cuyo grosor codifica la magnitud.
 *  - assoc-network: red de correlación entre variables numéricas.
 */

import { num } from "../format.js";
import { contingencyTable } from "../../data/transformer.js";
import { circleLayout, forceLayout, forceLayout3d, correlationEdges } from "../../stats/networks.js";
import { correlationMatrix, standardizeColumns } from "../../stats/multivariate.js";

const GROUP_ROLES = [
  { key: "source", label: "Origen", accepts: ["categorical"], required: true, hint: "Categorías de partida." },
  { key: "target", label: "Destino", accepts: ["categorical"], required: true, hint: "Categorías de llegada." },
];

const PALETTE = ["#2b44c9", "#1f9d8b", "#e0823d", "#b3477f", "#5a7d2a", "#3f8fce"];

/* ----------------------------- Utilidades ------------------------------ */
/** Grafo bipartito de co-ocurrencia entre dos variables categóricas. */
function buildBipartite(dataset, aVar, bVar) {
  const { rows: rks, cols: cks, matrix } = contingencyTable(dataset.rows, aVar, bVar);
  const nodes = [...rks.map((l) => ({ label: l, group: 0 })), ...cks.map((l) => ({ label: l, group: 1 }))];
  const edges = [];
  rks.forEach((_, i) => cks.forEach((__, j) => {
    const w = matrix[i][j];
    if (w > 0) edges.push({ source: i, target: rks.length + j, weight: w });
  }));
  return { nodes, edges, rks, cks, matrix };
}

/** Trazas de un grafo: una línea por arista + nodos agrupados por color. */
function drawGraph(nodes, edges, pos) {
  const traces = [];
  const maxW = Math.max(...edges.map((e) => e.weight), 1);
  for (const e of edges) {
    traces.push({
      type: "scatter", mode: "lines",
      x: [pos[e.source].x, pos[e.target].x], y: [pos[e.source].y, pos[e.target].y],
      line: { width: 1 + 5 * (e.weight / maxW), color: "rgba(110,120,140,0.4)" },
      hoverinfo: "text", text: `${nodes[e.source].label} — ${nodes[e.target].label}: ${e.weight}`,
      showlegend: false,
    });
  }
  const groups = [...new Set(nodes.map((n) => n.group))];
  for (const g of groups) {
    const sel = nodes.map((n, i) => ({ n, i })).filter((o) => o.n.group === g);
    traces.push({
      type: "scatter", mode: "markers+text",
      x: sel.map((o) => pos[o.i].x), y: sel.map((o) => pos[o.i].y),
      text: sel.map((o) => o.n.label), textposition: "top center",
      marker: { size: 15, opacity: 0.9, line: { width: 1, color: "rgba(255,255,255,0.6)" } },
      name: groups.length > 1 ? (g === 0 ? "Origen" : "Destino") : "Nodos",
      hovertemplate: "%{text}<extra></extra>",
    });
  }
  return traces;
}

const SQUARE_LAYOUT = {
  xaxis: { visible: false, range: [-1.35, 1.35] },
  yaxis: { visible: false, range: [-1.35, 1.35], scaleanchor: "x" },
  showlegend: true,
};

/* =========================== Network graph ============================= */
const networkChart = {
  roles: GROUP_ROLES,
  build(dataset, config) {
    const { nodes, edges } = buildBipartite(dataset, config.source, config.target);
    const pos = circleLayout(nodes.length, 1);
    return {
      traces: drawGraph(nodes, edges, pos),
      layout: SQUARE_LAYOUT,
      reading: {
        lead: `Red de co-ocurrencia entre “${config.source}” y “${config.target}”: ${nodes.length} nodos y ${edges.length} aristas. El grosor de cada arista es la frecuencia conjunta.`,
        stats: [
          { k: "Nodos", v: num(nodes.length, 0) },
          { k: "Aristas", v: num(edges.length, 0) },
          { k: "Frecuencia máx.", v: num(Math.max(...edges.map((e) => e.weight), 0), 0) },
        ],
        notes: [
          "La disposición circular muestra la topología sin imponer una interpretación espacial.",
          "Aristas gruesas indican combinaciones de categorías frecuentes.",
        ],
        cautions: ["La posición de los nodos en el círculo es arbitraria; solo importan las conexiones."],
      },
    };
  },
};

/* =========================== Force-directed =========================== */
const forceDirectedChart = {
  roles: GROUP_ROLES,
  build(dataset, config) {
    const { nodes, edges } = buildBipartite(dataset, config.source, config.target);
    const pos = forceLayout(nodes.length, edges, { seed: 42, iters: 300 });
    return {
      traces: drawGraph(nodes, edges, pos),
      layout: SQUARE_LAYOUT,
      reading: {
        lead: `Misma red con disposición por fuerzas: las aristas actúan como resortes y los nodos se repelen, de modo que los grupos muy conectados se acercan y emergen comunidades.`,
        stats: [
          { k: "Nodos", v: num(nodes.length, 0) },
          { k: "Aristas", v: num(edges.length, 0) },
        ],
        notes: [
          "Nodos próximos comparten muchas conexiones; los periféricos están débilmente vinculados.",
          "La disposición es reproducible (semilla fija), pero su orientación absoluta no tiene significado.",
        ],
        cautions: ["La distancia exacta entre nodos no es una métrica; léela de forma cualitativa."],
      },
    };
  },
};

/* =============================== Sankey ================================ */
const sankeyChart = {
  roles: GROUP_ROLES,
  build(dataset, config) {
    const { rows: rks, cols: cks, matrix } = contingencyTable(dataset.rows, config.source, config.target);
    const labels = [...rks, ...cks];
    const source = [];
    const target = [];
    const value = [];
    let maxLink = { v: 0, s: "", t: "" };
    rks.forEach((rk, i) => cks.forEach((ck, j) => {
      if (matrix[i][j] > 0) {
        source.push(i); target.push(rks.length + j); value.push(matrix[i][j]);
        if (matrix[i][j] > maxLink.v) maxLink = { v: matrix[i][j], s: rk, t: ck };
      }
    }));
    const total = value.reduce((s, v) => s + v, 0);
    return {
      traces: [{
        type: "sankey", orientation: "h",
        node: { label: labels, pad: 18, thickness: 16, line: { width: 0 } },
        link: { source, target, value },
      }],
      layout: { showlegend: false },
      reading: {
        lead: `Flujo entre “${config.source}” y “${config.target}” sobre ${total} casos. El mayor flujo va de “${maxLink.s}” a “${maxLink.t}” (${maxLink.v} casos).`,
        stats: [
          { k: "Casos totales", v: num(total, 0) },
          { k: "Enlaces", v: num(value.length, 0) },
          { k: "Flujo máx.", v: `${maxLink.s}→${maxLink.t} (${maxLink.v})` },
        ],
        notes: [
          "El ancho de cada banda es proporcional al número de casos que la recorren.",
          "La altura de cada nodo es la suma de los flujos que entran o salen de él.",
        ],
        cautions: ["Muestra magnitudes, no causalidad: un flujo no implica que una categoría provoque la otra."],
      },
    };
  },
};

/* ================================ Chord =============================== */
function bezier(p0, p1, steps = 26) {
  const xs = [];
  const ys = [];
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const mt = 1 - t;
    xs.push(mt * mt * p0.x + t * t * p1.x); // punto de control en el origen
    ys.push(mt * mt * p0.y + t * t * p1.y);
  }
  return { xs, ys };
}

const chordChart = {
  roles: GROUP_ROLES,
  build(dataset, config) {
    const { rows: rks, cols: cks, matrix } = contingencyTable(dataset.rows, config.source, config.target);
    const nodes = [...rks.map((l) => ({ label: l, group: 0 })), ...cks.map((l) => ({ label: l, group: 1 }))];
    const pos = circleLayout(nodes.length, 1);
    const maxW = Math.max(...matrix.flat(), 1);

    const traces = [];
    let maxLink = { v: 0, s: "", t: "" };
    rks.forEach((rk, i) => cks.forEach((ck, j) => {
      const w = matrix[i][j];
      if (w <= 0) return;
      const { xs, ys } = bezier(pos[i], pos[rks.length + j]);
      traces.push({
        type: "scatter", mode: "lines", x: xs, y: ys,
        line: { width: 1 + 6 * (w / maxW), color: PALETTE[i % PALETTE.length], shape: "spline" },
        opacity: 0.55, hoverinfo: "text", text: `${rk} — ${ck}: ${w}`, showlegend: false,
      });
      if (w > maxLink.v) maxLink = { v: w, s: rk, t: ck };
    }));
    // Nodos por grupo.
    [0, 1].forEach((g) => {
      const sel = nodes.map((n, i) => ({ n, i })).filter((o) => o.n.group === g);
      traces.push({
        type: "scatter", mode: "markers+text",
        x: sel.map((o) => pos[o.i].x), y: sel.map((o) => pos[o.i].y),
        text: sel.map((o) => o.n.label), textposition: "top center",
        marker: { size: 13, line: { width: 1, color: "rgba(255,255,255,0.6)" } },
        name: g === 0 ? config.source : config.target, hovertemplate: "%{text}<extra></extra>",
      });
    });

    return {
      traces, layout: SQUARE_LAYOUT,
      reading: {
        lead: `Diagrama de cuerdas entre “${config.source}” y “${config.target}”. Cada conector enlaza dos categorías y su grosor es la frecuencia conjunta; el mayor une “${maxLink.s}” y “${maxLink.t}” (${maxLink.v}).`,
        stats: [
          { k: "Categorías", v: num(nodes.length, 0) },
          { k: "Conexión máx.", v: `${maxLink.s}–${maxLink.t} (${maxLink.v})` },
        ],
        notes: [
          "Las categorías se disponen en círculo y los conectores cruzan el centro; el color identifica la categoría de origen.",
          "Es útil para comparar de un vistazo qué relaciones concentran más casos.",
        ],
        cautions: ["Con muchas categorías los conectores se solapan; conviene reservarlo para pocos niveles."],
      },
    };
  },
};

/* ====================== Red de asociación (Asociación) ================= */
const assocNetworkChart = {
  usesAllNumeric: true,
  paramRoles: [
    { key: "threshold", label: "Umbral de |r|", type: "number", min: 0.1, max: 0.95, step: 0.05, default: 0.5,
      hint: "Correlación absoluta mínima para dibujar una arista." },
  ],
  build(dataset, config) {
    const names = dataset.variables.filter((v) => v.storageType === "numeric").map((v) => v.name);
    const rows = dataset.rows.filter((r) => names.every((nm) => typeof r[nm] === "number" && Number.isFinite(r[nm])));
    const M = rows.map((r) => names.map((nm) => r[nm]));
    const { Z } = standardizeColumns(M);
    const C = correlationMatrix(Z);
    const threshold = config.threshold ?? 0.5;
    const edges = correlationEdges(C, threshold);
    const pos = circleLayout(names.length, 1);

    const traces = [];
    const maxW = Math.max(...edges.map((e) => e.weight), 1);
    let strongest = { r: 0, a: "", b: "" };
    for (const e of edges) {
      traces.push({
        type: "scatter", mode: "lines",
        x: [pos[e.source].x, pos[e.target].x], y: [pos[e.source].y, pos[e.target].y],
        line: { width: 1 + 5 * (e.weight / maxW), color: e.r >= 0 ? "rgba(43,68,201,0.55)" : "rgba(224,130,61,0.6)" },
        hoverinfo: "text", text: `${names[e.source]} — ${names[e.target]}: r = ${num(e.r, 2)}`, showlegend: false,
      });
      if (Math.abs(e.r) > Math.abs(strongest.r)) strongest = { r: e.r, a: names[e.source], b: names[e.target] };
    }
    traces.push({
      type: "scatter", mode: "markers+text",
      x: pos.map((p) => p.x), y: pos.map((p) => p.y), text: names, textposition: "top center",
      marker: { size: 16, opacity: 0.9, line: { width: 1, color: "rgba(255,255,255,0.6)" } },
      name: "Variables", hovertemplate: "%{text}<extra></extra>",
    });

    return {
      traces, layout: SQUARE_LAYOUT,
      reading: {
        lead: `Red de correlación entre ${names.length} variables: se dibuja una arista cuando |r| ≥ ${num(threshold, 2)}. Hay ${edges.length} relación(es); la más fuerte es ${strongest.a}–${strongest.b} (r = ${num(strongest.r, 2)}).`,
        stats: [
          { k: "Variables", v: num(names.length, 0) },
          { k: "Aristas", v: num(edges.length, 0) },
          { k: "Umbral |r|", v: num(threshold, 2) },
        ],
        notes: [
          "Azul = correlación positiva, naranja = negativa; el grosor crece con |r|.",
          "Variables sin aristas no superan el umbral con ninguna otra: están relativamente aisladas.",
        ],
        cautions: ["Correlación no es causalidad, y un umbral alto puede ocultar relaciones moderadas pero reales."],
      },
    };
  },
};

/* ---------------------- Variantes 3D (modo 3D) ------------------------- */
/** Posiciones sobre una esfera (espiral de Fibonacci), deterministas. */
function spherePositions(n) {
  const pts = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = phi * i;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return pts;
}

/** Trazas 3D de un grafo: una línea por arista + nodos agrupados por color. */
function drawGraph3d(nodes, edges, pos) {
  const traces = [];
  const maxW = Math.max(...edges.map((e) => e.weight), 1);
  for (const e of edges) {
    traces.push({
      type: "scatter3d", mode: "lines",
      x: [pos[e.source].x, pos[e.target].x], y: [pos[e.source].y, pos[e.target].y], z: [pos[e.source].z, pos[e.target].z],
      line: { width: 1 + 5 * (e.weight / maxW), color: "rgba(110,120,140,0.45)" },
      hoverinfo: "text", text: `${nodes[e.source].label} — ${nodes[e.target].label}: ${e.weight}`, showlegend: false,
    });
  }
  const groups = [...new Set(nodes.map((n) => n.group))];
  for (const g of groups) {
    const sel = nodes.map((n, i) => ({ n, i })).filter((o) => o.n.group === g);
    traces.push({
      type: "scatter3d", mode: "markers+text",
      x: sel.map((o) => pos[o.i].x), y: sel.map((o) => pos[o.i].y), z: sel.map((o) => pos[o.i].z),
      text: sel.map((o) => o.n.label), textposition: "top center",
      marker: { size: 5, opacity: 0.9, line: { width: 1, color: "rgba(255,255,255,0.6)" } },
      name: groups.length > 1 ? (g === 0 ? "Origen" : "Destino") : "Nodos",
      hovertemplate: "%{text}<extra></extra>",
    });
  }
  return traces;
}

const SCENE3D = { xaxis: { visible: false }, yaxis: { visible: false }, zaxis: { visible: false } };

networkChart.build3d = (dataset, config) => {
  const { nodes, edges } = buildBipartite(dataset, config.source, config.target);
  const pos = spherePositions(nodes.length);
  return {
    traces: drawGraph3d(nodes, edges, pos),
    layout: { scene: SCENE3D, showlegend: true },
    reading: {
      lead: `Red de co-ocurrencia entre “${config.source}” y “${config.target}” dispuesta sobre una esfera: ${nodes.length} nodos y ${edges.length} aristas. Gira la escena para seguir las conexiones sin solapamientos.`,
      stats: [{ k: "Nodos", v: num(nodes.length, 0) }, { k: "Aristas", v: num(edges.length, 0) }],
      notes: ["Distribuir los nodos en una esfera reparte el espacio y reduce los cruces de aristas frente al círculo plano.", "El grosor de la arista sigue siendo la frecuencia conjunta."],
      cautions: ["La posición sobre la esfera es convencional; solo importan las conexiones."],
    },
  };
};

forceDirectedChart.build3d = (dataset, config) => {
  const { nodes, edges } = buildBipartite(dataset, config.source, config.target);
  const pos = forceLayout3d(nodes.length, edges, { seed: 42, iters: 300 });
  return {
    traces: drawGraph3d(nodes, edges, pos),
    layout: { scene: SCENE3D, showlegend: true },
    reading: {
      lead: `Disposición por fuerzas en 3D: los nodos se reorganizan en el espacio según sus conexiones, de modo que las comunidades se separan en volumen.`,
      stats: [{ k: "Nodos", v: num(nodes.length, 0) }, { k: "Aristas", v: num(edges.length, 0) }],
      notes: ["En tres dimensiones el algoritmo dispone de más libertad para separar grupos que en el plano.", "Reproducible con semilla fija; su orientación absoluta no significa nada."],
      cautions: ["Las distancias no son una métrica exacta; interpreta la cercanía de forma cualitativa."],
    },
  };
};

/* ------------------------------ Exportación ---------------------------- */
export const redesBuilders = {
  network: networkChart,
  "force-directed": forceDirectedChart,
  sankey: sankeyChart,
  chord: chordChart,
  "assoc-network": assocNetworkChart,
};
