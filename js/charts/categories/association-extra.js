/**
 * association-extra.js — Variantes de asociación que completan el catálogo.
 *
 *  - hexbin: binning hexagonal de una nube saturada (densidad por celda).
 *  - correlogram: matriz de correlaciones como círculos (tamaño y color = r).
 *  - pairplot: matriz de dispersión (SPLOM) coloreada por una categoría.
 *  - scatter-matrix: matriz de dispersión de todas las variables numéricas.
 */

import { num, label } from "../format.js";
import { hexbin } from "../../stats/hexbin.js";
import { correlationMatrix, standardizeColumns } from "../../stats/multivariate.js";

const SEQ_A = [[0, "#eef2fb"], [0.5, "#7d93e8"], [1, "#1f2f8f"]];
const DIV = [[0, "#e0823d"], [0.5, "#eef0f5"], [1, "#2b44c9"]];

function numCols(dataset) {
  const names = dataset.variables.filter((v) => v.storageType === "numeric").map((v) => v.name);
  const rows = dataset.rows.filter((r) => names.every((nm) => typeof r[nm] === "number" && Number.isFinite(r[nm])));
  return { names, rows };
}

/* =============================== Hexbin =============================== */
const hexbinChart = {
  roles: [
    { key: "x", label: "Eje X", accepts: ["numeric"], required: true },
    { key: "y", label: "Eje Y", accepts: ["numeric"], required: true },
  ],
  paramRoles: [
    { key: "resolucion", label: "Resolución (hexágonos a lo ancho)", type: "number", min: 8, max: 30, step: 1, default: 16,
      hint: "Más hexágonos = celdas más pequeñas." },
  ],
  build(dataset, config) {
    const pts = dataset.rows.filter((r) => typeof r[config.x] === "number" && typeof r[config.y] === "number");
    const xs = pts.map((r) => r[config.x]);
    const ys = pts.map((r) => r[config.y]);
    const nx = Math.round(config.resolucion ?? 16);
    const { cells, max } = hexbin(xs, ys, nx);

    return {
      traces: [{
        type: "scatter", mode: "markers",
        x: cells.map((c) => c.x), y: cells.map((c) => c.y),
        marker: {
          symbol: "hexagon", size: Math.max(8, 280 / nx),
          color: cells.map((c) => c.count), colorscale: SEQ_A, cmin: 0, cmax: max,
          colorbar: { title: { text: "Conteo" }, thickness: 12, len: 0.7 },
          line: { width: 0.5, color: "rgba(255,255,255,0.4)" },
        },
        hovertemplate: "%{marker.color} puntos<extra></extra>",
      }],
      layout: {
        xaxis: { title: { text: label(dataset, config.x) } },
        yaxis: { title: { text: label(dataset, config.y) } },
        showlegend: false,
      },
      reading: {
        lead: `Binning hexagonal de ${pts.length} puntos: cada hexágono agrupa los casos próximos y su color indica cuántos contiene (hasta ${max}). Resuelve el solapamiento de un diagrama de dispersión saturado.`,
        stats: [
          { k: "Puntos", v: num(pts.length, 0) },
          { k: "Celdas ocupadas", v: num(cells.length, 0) },
          { k: "Celda más densa", v: num(max, 0) },
        ],
        notes: ["Cuando hay miles de puntos, el color por densidad muestra dónde se concentran los datos mejor que puntos superpuestos.", "El hexágono tesela el plano sin huecos y con vecindad uniforme, a diferencia del cuadrado."],
        cautions: ["La resolución cambia la lectura: pocas celdas ocultan estructura fina; demasiadas, la fragmentan."],
      },
    };
  },
};

/* ============================= Correlogram =========================== */
const correlogramChart = {
  usesAllNumeric: true,
  build(dataset) {
    const { names, rows } = numCols(dataset);
    const M = rows.map((r) => names.map((nm) => r[nm]));
    const { Z } = standardizeColumns(M);
    const C = correlationMatrix(Z);
    const p = names.length;

    const x = [];
    const y = [];
    const sizes = [];
    const colors = [];
    let strongest = { r: 0, a: "", b: "" };
    for (let i = 0; i < p; i += 1) {
      for (let j = 0; j < p; j += 1) {
        x.push(j); y.push(i);
        sizes.push(6 + Math.abs(C[i][j]) * 34);
        colors.push(C[i][j]);
        if (i < j && Math.abs(C[i][j]) > Math.abs(strongest.r)) strongest = { r: C[i][j], a: names[i], b: names[j] };
      }
    }

    return {
      traces: [{
        type: "scatter", mode: "markers", x, y,
        marker: {
          size: sizes, sizemode: "diameter", color: colors, colorscale: DIV, cmin: -1, cmax: 1,
          colorbar: { title: { text: "r" }, thickness: 12, len: 0.7, tickvals: [-1, 0, 1] },
          line: { width: 0.5, color: "rgba(120,130,145,0.4)" },
        },
        hovertemplate: "r = %{marker.color:.2f}<extra></extra>",
      }],
      layout: {
        xaxis: { tickvals: names.map((_, i) => i), ticktext: names, tickangle: -45, range: [-0.6, p - 0.4] },
        yaxis: { tickvals: names.map((_, i) => i), ticktext: names, autorange: "reversed", scaleanchor: "x", range: [-0.6, p - 0.4] },
        showlegend: false,
      },
      reading: {
        lead: `Correlograma de ${p} variables: cada círculo es una correlación; el tamaño crece con |r| y el color va de naranja (negativa) a azul (positiva). La asociación más fuerte es ${strongest.a}–${strongest.b} (r = ${num(strongest.r, 2)}).`,
        stats: [
          { k: "Variables", v: num(p, 0) },
          { k: "Más fuerte", v: `${strongest.a}–${strongest.b}` },
          { k: "r", v: num(strongest.r, 2) },
        ],
        notes: ["Codificar r con tamaño y color a la vez facilita localizar de un vistazo los pares relevantes.", "La diagonal (r = 1) sirve de referencia visual del círculo de máxima magnitud."],
        cautions: ["Mide solo asociación lineal: una relación curva fuerte puede mostrar un r bajo."],
      },
    };
  },
};

/* ============================== Pairplot ============================= */
const pairplotChart = {
  usesAllNumeric: true,
  roles: [{ key: "color", label: "Colorear por (opcional)", accepts: ["categorical"], required: false, hint: "Tiñe los puntos según una categoría." }],
  build(dataset, config) {
    const { names, rows } = numCols(dataset);
    const dims = (sel) => names.map((nm) => ({ label: nm, values: sel.map((r) => r[nm]) }));

    let traces;
    if (config.color) {
      const groups = new Map();
      for (const r of rows) {
        const g = String(r[config.color] ?? "—").trim();
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(r);
      }
      traces = [...groups].map(([g, sel]) => ({
        type: "splom", name: g, dimensions: dims(sel),
        showupperhalf: false, diagonal: { visible: false },
        marker: { size: 5, opacity: 0.7 },
      }));
    } else {
      traces = [{
        type: "splom", dimensions: dims(rows),
        showupperhalf: false, diagonal: { visible: false },
        marker: { size: 5, opacity: 0.7 },
      }];
    }

    return {
      traces, layout: { showlegend: Boolean(config.color), dragmode: "select" },
      reading: {
        lead: `Matriz de dispersión de ${names.length} variables${config.color ? `, coloreada por “${config.color}”` : ""}: cada celda enfrenta dos variables, de modo que se inspeccionan todas las relaciones por pares a la vez.`,
        stats: [
          { k: "Variables", v: num(names.length, 0) },
          { k: "Paneles", v: num((names.length * (names.length - 1)) / 2, 0) },
          { k: "Casos", v: num(rows.length, 0) },
        ],
        notes: ["Es la vista exploratoria por excelencia: detecta correlaciones, agrupamientos y atípicos en todas las parejas.", config.color ? "El color por grupo revela si las relaciones difieren entre categorías." : "Asignar un color por categoría añade una capa de comparación entre grupos."],
        cautions: ["El número de paneles crece de forma cuadrática: con muchas variables se vuelve ilegible."],
      },
    };
  },
};

/* =========================== Scatter matrix ========================== */
const scatterMatrixChart = {
  usesAllNumeric: true,
  build(dataset) {
    const { names, rows } = numCols(dataset);
    const dimensions = names.map((nm) => ({ label: nm, values: rows.map((r) => r[nm]) }));
    return {
      traces: [{
        type: "splom", dimensions, showupperhalf: false, diagonal: { visible: false },
        marker: { size: 5, opacity: 0.7, line: { width: 0.3, color: "rgba(255,255,255,0.4)" } },
      }],
      layout: { showlegend: false, dragmode: "select" },
      reading: {
        lead: `Matriz de dispersión (SPLOM) de ${names.length} variables numéricas sobre ${rows.length} casos: una rejilla con todas las combinaciones por pares.`,
        stats: [
          { k: "Variables", v: num(names.length, 0) },
          { k: "Paneles", v: num((names.length * (names.length - 1)) / 2, 0) },
          { k: "Casos", v: num(rows.length, 0) },
        ],
        notes: ["Equivalente al pairplot sin agrupar: ideal para una primera lectura de la estructura conjunta.", "Cada panel es un diagrama de dispersión; busca tendencias, curvaturas y puntos alejados."],
        cautions: ["No cuantifica las relaciones: combínalo con una matriz de correlación para ponerles número."],
      },
    };
  },
};

/* ------------------------------ Exportación ---------------------------- */
export const associationExtraBuilders = {
  hexbin: hexbinChart,
  correlogram: correlogramChart,
  pairplot: pairplotChart,
  "scatter-matrix": scatterMatrixChart,
};
