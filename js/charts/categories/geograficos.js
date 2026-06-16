/**
 * geograficos.js — Constructores de la categoría Geográficos.
 *
 * Usan el subsistema `geo` nativo de Plotly (fronteras y costas incluidas en
 * la propia librería, sin teselas ni tokens externos):
 *  - choropleth: regiones coloreadas por una métrica (mapa mundial).
 *  - bubble-map: magnitudes como círculos proporcionales sobre coordenadas.
 *  - density-map: densidad de eventos estimada por núcleo (KDE) sobre rejilla.
 *  - heat-map: intensidad de una variable interpolada por distancia (IDW).
 */

import { num, label } from "../format.js";
import { boundingBox, gridPoints, boxDiagonal, kde2d, idw } from "../../stats/geo.js";

/* Escala secuencial (cobalto) y cálida, como literales: los builders no leen CSS. */
const SEQ = [[0, "#eef2fb"], [0.5, "#7d93e8"], [1, "#1f2f8f"]];
const WARM = [[0, "#fff4e6"], [0.5, "#f0a85a"], [1, "#b3471f"]];

const GEO_BASE = {
  showframe: false,
  showcoastlines: true, coastlinecolor: "rgba(120,130,145,0.55)",
  showland: true, landcolor: "rgba(180,186,196,0.16)",
  showcountries: true, countrycolor: "rgba(120,130,145,0.45)",
  bgcolor: "rgba(0,0,0,0)",
  projection: { type: "natural earth" },
};

/** Filas con lat/lon (y opcionalmente un valor) numéricos válidos. */
function geoRows(dataset, latVar, lonVar, valVar) {
  return dataset.rows.filter((r) =>
    typeof r[latVar] === "number" && Number.isFinite(r[latVar]) &&
    typeof r[lonVar] === "number" && Number.isFinite(r[lonVar]) &&
    (!valVar || (typeof r[valVar] === "number" && Number.isFinite(r[valVar])))
  );
}

function fittedGeo(bbox) {
  return {
    ...GEO_BASE,
    lataxis: { range: [bbox.latMin, bbox.latMax] },
    lonaxis: { range: [bbox.lonMin, bbox.lonMax] },
  };
}

/* ============================= Choropleth ============================= */
const choroplethChart = {
  roles: [
    { key: "location", label: "Región", accepts: ["categorical"], required: true, hint: "Nombre de país o código ISO." },
    { key: "value", label: "Métrica", accepts: ["numeric"], required: true, hint: "Valor que se colorea." },
  ],
  build(dataset, config) {
    const rows = dataset.rows.filter((r) => r[config.location] != null && typeof r[config.value] === "number");
    const locations = rows.map((r) => String(r[config.location]));
    const z = rows.map((r) => r[config.value]);
    const maxI = z.indexOf(Math.max(...z));
    const minI = z.indexOf(Math.min(...z));
    return {
      traces: [{
        type: "choropleth", locationmode: "country names",
        locations, z, colorscale: SEQ, reversescale: false,
        marker: { line: { width: 0.4, color: "rgba(255,255,255,0.5)" } },
        colorbar: { title: { text: label(dataset, config.value) }, thickness: 12, len: 0.7 },
        hovertemplate: "%{location}<br>%{z}<extra></extra>",
      }],
      layout: { geo: { ...GEO_BASE, scope: "world" } },
      reading: {
        lead: `Coropletas de “${config.value}” sobre ${rows.length} regiones. El valor más alto corresponde a ${locations[maxI]} (${num(z[maxI])}) y el más bajo a ${locations[minI]} (${num(z[minI])}).`,
        stats: [
          { k: "Regiones", v: num(rows.length, 0) },
          { k: "Máximo", v: `${locations[maxI]} (${num(z[maxI])})` },
          { k: "Mínimo", v: `${locations[minI]} (${num(z[minI])})` },
        ],
        notes: [
          "El color codifica la métrica; regiones más oscuras, valores más altos.",
          "Las coropletas funcionan mejor con tasas o índices, no con conteos absolutos.",
        ],
        cautions: ["Normaliza por población o tamaño: de lo contrario, las regiones grandes o pobladas dominan el mapa (falacia del área)."],
      },
    };
  },
};

/* ============================= Bubble map ============================= */
const bubbleMapChart = {
  roles: [
    { key: "lat", label: "Latitud", accepts: ["numeric"], required: true },
    { key: "lon", label: "Longitud", accepts: ["numeric"], required: true },
    { key: "size", label: "Magnitud", accepts: ["numeric"], required: true, hint: "Determina el tamaño de cada círculo." },
    { key: "label", label: "Etiqueta (opcional)", accepts: ["categorical"], required: false },
  ],
  build(dataset, config) {
    const rows = geoRows(dataset, config.lat, config.lon, config.size);
    const lat = rows.map((r) => r[config.lat]);
    const lon = rows.map((r) => r[config.lon]);
    const size = rows.map((r) => r[config.size]);
    const text = config.label ? rows.map((r) => String(r[config.label])) : rows.map((_, i) => `Punto ${i + 1}`);
    const maxV = Math.max(...size, 1);
    const bbox = boundingBox(lat, lon, 0.25);
    const maxI = size.indexOf(maxV);

    return {
      traces: [{
        type: "scattergeo", mode: "markers", lat, lon, text,
        marker: {
          size, sizemode: "area", sizeref: (2 * maxV) / 38 ** 2, sizemin: 4,
          color: size, colorscale: SEQ, opacity: 0.78,
          line: { width: 0.6, color: "rgba(255,255,255,0.6)" },
          colorbar: { title: { text: label(dataset, config.size) }, thickness: 12, len: 0.7 },
        },
        hovertemplate: "%{text}<br>%{marker.size}<extra></extra>",
      }],
      layout: { geo: fittedGeo(bbox) },
      reading: {
        lead: `Mapa de burbujas de “${config.size}” en ${rows.length} ubicaciones. La mayor corresponde a ${text[maxI]} (${num(maxV)}).`,
        stats: [
          { k: "Ubicaciones", v: num(rows.length, 0) },
          { k: "Mayor", v: `${text[maxI]} (${num(maxV)})` },
          { k: "Total", v: num(size.reduce((s, v) => s + v, 0)) },
        ],
        notes: [
          "El área del círculo (no el radio) es proporcional a la magnitud, para no exagerar las diferencias.",
          "Es preferible a las coropletas cuando los datos son puntuales (ciudades, sedes, eventos).",
        ],
        cautions: ["Las burbujas se solapan en zonas densas; puede ocultar puntos pequeños."],
      },
    };
  },
};

/* ============================ Density map ============================= */
const densityMapChart = {
  roles: [
    { key: "lat", label: "Latitud", accepts: ["numeric"], required: true },
    { key: "lon", label: "Longitud", accepts: ["numeric"], required: true },
  ],
  paramRoles: [
    { key: "radio", label: "Suavizado (1=fino, 20=amplio)", type: "number", min: 4, max: 20, step: 1, default: 9,
      hint: "Ancho de banda del núcleo, como fracción del mapa." },
  ],
  build(dataset, config) {
    const rows = geoRows(dataset, config.lat, config.lon);
    const lat = rows.map((r) => r[config.lat]);
    const lon = rows.map((r) => r[config.lon]);
    const bbox = boundingBox(lat, lon, 0.3);
    const grid = gridPoints(bbox, 18, 18);
    const bandwidth = boxDiagonal(bbox) / (config.radio ?? 9);
    const dens = kde2d(lat, lon, grid, bandwidth);

    // Solo celdas con densidad apreciable, para no recargar el mapa.
    const cells = grid.map((g, i) => ({ g, d: dens[i] })).filter((c) => c.d > 0.06);

    return {
      traces: [
        {
          type: "scattergeo", mode: "markers",
          lat: cells.map((c) => c.g.lat), lon: cells.map((c) => c.g.lon),
          marker: {
            symbol: "square", size: 13, opacity: 0.5,
            color: cells.map((c) => c.d), colorscale: WARM, cmin: 0, cmax: 1,
            colorbar: { title: { text: "Densidad" }, thickness: 12, len: 0.7 },
            line: { width: 0 },
          },
          hoverinfo: "skip",
        },
        {
          type: "scattergeo", mode: "markers", lat, lon,
          marker: { size: 4, color: "rgba(40,46,60,0.8)" }, hoverinfo: "skip",
        },
      ],
      layout: { geo: fittedGeo(bbox) },
      reading: {
        lead: `Densidad de ${rows.length} eventos estimada por núcleo gaussiano sobre una rejilla. Las zonas cálidas concentran más eventos; los puntos oscuros son las ubicaciones originales.`,
        stats: [
          { k: "Eventos", v: num(rows.length, 0) },
          { k: "Celdas activas", v: num(cells.length, 0) },
          { k: "Suavizado", v: num(config.radio ?? 9, 0) },
        ],
        notes: [
          "La densidad por núcleo (KDE) suaviza los puntos en una superficie continua de concentración.",
          "El ancho de banda controla el detalle: pequeño revela focos finos; grande, patrones generales.",
        ],
        cautions: ["Un suavizado excesivo funde focos distintos; uno escaso fragmenta un mismo foco. Las distancias se miden en grados, sin corrección por latitud."],
      },
    };
  },
};

/* ============================== Heat map ============================== */
const heatMapChart = {
  roles: [
    { key: "lat", label: "Latitud", accepts: ["numeric"], required: true },
    { key: "lon", label: "Longitud", accepts: ["numeric"], required: true },
    { key: "value", label: "Intensidad", accepts: ["numeric"], required: true, hint: "Variable que se interpola sobre el territorio." },
  ],
  paramRoles: [
    { key: "potencia", label: "Potencia IDW", type: "number", min: 1, max: 4, step: 1, default: 2,
      hint: "Mayor potencia = influencia más local de cada muestra." },
  ],
  build(dataset, config) {
    const rows = geoRows(dataset, config.lat, config.lon, config.value);
    const lat = rows.map((r) => r[config.lat]);
    const lon = rows.map((r) => r[config.lon]);
    const vals = rows.map((r) => r[config.value]);
    const bbox = boundingBox(lat, lon, 0.25);
    const grid = gridPoints(bbox, 20, 20);
    const surface = idw(lat, lon, vals, grid, config.potencia ?? 2);
    const vmin = Math.min(...vals);
    const vmax = Math.max(...vals);

    return {
      traces: [
        {
          type: "scattergeo", mode: "markers",
          lat: grid.map((g) => g.lat), lon: grid.map((g) => g.lon),
          marker: {
            symbol: "square", size: 12, opacity: 0.5,
            color: surface, colorscale: WARM, cmin: vmin, cmax: vmax,
            colorbar: { title: { text: label(dataset, config.value) }, thickness: 12, len: 0.7 },
            line: { width: 0 },
          },
          hoverinfo: "skip",
        },
        {
          type: "scattergeo", mode: "markers", lat, lon,
          marker: { size: 6, color: vals, colorscale: WARM, cmin: vmin, cmax: vmax,
            line: { width: 1, color: "rgba(255,255,255,0.7)" } },
          hovertemplate: `${config.value} %{marker.color}<extra></extra>`,
        },
      ],
      layout: { geo: fittedGeo(bbox) },
      reading: {
        lead: `Superficie de “${config.value}” interpolada por distancia inversa (IDW) a partir de ${rows.length} muestras. El valor observado va de ${num(vmin)} a ${num(vmax)}.`,
        stats: [
          { k: "Muestras", v: num(rows.length, 0) },
          { k: "Rango observado", v: `${num(vmin)} – ${num(vmax)}` },
          { k: "Potencia IDW", v: num(config.potencia ?? 2, 0) },
        ],
        notes: [
          "IDW estima cada celda como una media ponderada de las muestras, dando más peso a las cercanas.",
          "La superficie nunca excede el rango observado: IDW no extrapola por encima de los datos.",
        ],
        cautions: ["Es una interpolación, no una medición: en zonas sin muestras cercanas la estimación es poco fiable."],
      },
    };
  },
};

/* ------------------------------ Exportación ---------------------------- */
export const geograficosBuilders = {
  choropleth: choroplethChart,
  "bubble-map": bubbleMapChart,
  "density-map": densityMapChart,
  "heat-map": heatMapChart,
};
