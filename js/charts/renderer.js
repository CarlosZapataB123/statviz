/**
 * renderer.js — Motor de renderizado de gráficos (Plotly).
 *
 * Carga Plotly bajo demanda, valida que el gráfico tenga las variables que
 * necesita, construye las trazas con el constructor correspondiente, fusiona
 * el tema activo (derivado de los tokens CSS) y dibuja. Devuelve la "lectura"
 * estructurada para el panel de interpretación. Aísla por completo a Plotly
 * del resto de la aplicación.
 */

import {
  getBuilder,
  getRoles,
  usesAllNumeric,
  defaultConfig,
} from "./builders.js";
import { themeLayout, themeScene, themeConfig } from "./themes/plotly-themes.js";

// Se intenta primero la copia local incluida en el repositorio (mismo origen
// que la página: nunca la bloquea una red ni una extensión, y funciona sin
// conexión). Solo si faltara se recurre a las CDNs externas como respaldo.
const PLOTLY_URLS = [
  "vendor/plotly.min.js",
  "https://cdn.plot.ly/plotly-2.35.2.min.js",
  "https://cdn.jsdelivr.net/npm/plotly.js@2.35.2/dist/plotly.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.35.2/plotly.min.js",
];

let plotlyPromise = null;

/** Carga un script y resuelve cuando Plotly queda disponible. */
function loadPlotlyFrom(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () =>
      window.Plotly ? resolve(window.Plotly) : reject(new Error("script cargado sin Plotly"));
    script.onerror = () => reject(new Error("no se pudo descargar"));
    document.head.appendChild(script);
  });
}

/** Carga Plotly una sola vez, probando varias CDNs de respaldo. */
export function ensurePlotly() {
  if (window.Plotly) return Promise.resolve(window.Plotly);
  if (plotlyPromise) return plotlyPromise;
  plotlyPromise = (async () => {
    let lastError = null;
    for (const url of PLOTLY_URLS) {
      try {
        return await loadPlotlyFrom(url);
      } catch (err) {
        lastError = err;
      }
    }
    plotlyPromise = null; // permite reintentar más tarde
    throw new Error(
      "No se pudo cargar Plotly (ni la copia local ni las CDNs de respaldo). Revisa que exista vendor/plotly.min.js o tu conexión."
    );
  })();
  return plotlyPromise;
}

/** Fusión profunda sencilla (objetos planos); los arrays se reemplazan. */
function deepMerge(base, extra) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const key of Object.keys(extra || {})) {
    const a = out[key];
    const b = extra[key];
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(b)) {
      out[key] = deepMerge(a, b);
    } else {
      out[key] = b;
    }
  }
  return out;
}

/** Determina los roles obligatorios sin asignar en la configuración dada. */
function missingRoles(id, config) {
  if (usesAllNumeric(id)) return [];
  return getRoles(id)
    .filter((r) => r.required && !config[r.key])
    .map((r) => r.label);
}

/**
 * Renderiza un gráfico en un contenedor.
 * @param {HTMLElement} container
 * @param {Object} args
 * @param {Object} args.chart    Definición del gráfico (registry)
 * @param {Object} args.dataset  Conjunto de datos activo
 * @param {Object} args.config   Asignación rol → variable
 * @returns {Promise<{ok:boolean, reading?:Object, warnings?:string[], message?:string}>}
 */
export async function renderChart(container, { chart, dataset, config, mode }) {
  const builder = getBuilder(chart.id);
  if (!builder) {
    return { ok: false, message: "Este gráfico aún no tiene render disponible." };
  }

  const use3d = mode === "3d" && chart.supports3D && typeof builder.build3d === "function";

  const missing = missingRoles(chart.id, config || {});
  if (missing.length) {
    return {
      ok: false,
      message: `Faltan variables para dibujar: ${missing.join(", ")}.`,
    };
  }

  let built;
  try {
    built = use3d ? builder.build3d(dataset, config || {}) : builder.build(dataset, config || {});
  } catch (err) {
    return { ok: false, message: `No se pudo construir el gráfico: ${err.message}` };
  }

  if (!built.traces || built.traces.length === 0) {
    return { ok: false, message: "No hay datos suficientes para este gráfico." };
  }

  let Plotly;
  try {
    Plotly = await ensurePlotly();
  } catch (err) {
    return { ok: false, message: `${err.message}. Comprueba tu conexión.` };
  }

  const base = themeLayout();
  if (use3d) {
    base.scene = themeScene();
    base.margin = { l: 0, r: 0, t: 0, b: 0 };
  }
  const layout = deepMerge(base, built.layout || {});
  await Plotly.react(container, built.traces, layout, themeConfig());

  return { ok: true, reading: built.reading, warnings: built.warnings || [] };
}

/** Reajusta el tamaño del gráfico al de su contenedor. */
export function resizeChart(container) {
  if (window.Plotly && container) window.Plotly.Plots.resize(container);
}

/** Libera los recursos del gráfico. */
export function purgeChart(container) {
  if (window.Plotly && container) window.Plotly.purge(container);
}

export { defaultConfig };
