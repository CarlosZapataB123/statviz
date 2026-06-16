/**
 * series.js — Constructores de la categoría Series temporales.
 *
 * Cubren la representación de una o varias series sobre un eje temporal y su
 * estructura: tendencia, composición (apiladas, streamgraph), magnitud
 * compacta (horizon), estacionalidad (estacional), dependencia (retardo) y
 * autocorrelación (ACF, con bandas de significación). El cálculo de la ACF y
 * el orden temporal provienen de js/stats/timeseries.js.
 */

import { num, label } from "../format.js";
import { orderByTime, acf } from "../../stats/timeseries.js";

/* ----------------------------- Utilidades ------------------------------ */
function cmpIndex(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b), "es");
}

/** Filas ordenadas por el índice temporal (o tal cual si no hay índice). */
function sortedByTime(rows, timeVar) {
  const r = [...rows];
  if (timeVar) r.sort((a, b) => cmpIndex(a[timeVar], b[timeVar]));
  return r;
}

/** Mediana de un vector. */
function medianOf(arr) {
  const xs = [...arr].sort((a, b) => a - b);
  const n = xs.length;
  if (!n) return 0;
  return n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

/** Variables numéricas de la serie (todas salvo la del eje temporal). */
function seriesVars(dataset, timeVar) {
  return dataset.variables.filter((v) => v.storageType === "numeric" && v.name !== timeVar).map((v) => v.name);
}

const TIME_ROLE = { key: "time", label: "Eje temporal", accepts: ["temporal", "numeric"], required: true,
  hint: "Variable que ordena la serie (tiempo o índice)." };
const VALUE_ROLE = { key: "value", label: "Serie (Y)", accepts: ["numeric"], required: true,
  hint: "Variable que evoluciona en el tiempo." };
const TIME_OPT_ROLE = { key: "time", label: "Orden temporal (opcional)", accepts: ["temporal", "numeric"], required: false,
  hint: "Ordena la serie; si se omite, se usa el orden de los datos." };

/** Describe la tendencia comparando el inicio y el final de la serie. */
function trendWord(values) {
  if (values.length < 2) return "sin variación";
  const d = values[values.length - 1] - values[0];
  const rng = Math.max(...values) - Math.min(...values) || 1;
  if (d > rng * 0.1) return "tendencia creciente";
  if (d < -rng * 0.1) return "tendencia decreciente";
  return "sin tendencia clara";
}

/* ================================ Línea ================================ */
const lineChart = {
  roles: [TIME_ROLE, VALUE_ROLE],
  build(dataset, config) {
    const { index, values } = orderByTime(dataset.rows, config.time, config.value);
    return {
      traces: [{ type: "scatter", mode: "lines+markers", x: index, y: values, name: config.value,
        line: { width: 2 }, marker: { size: 5 } }],
      layout: {
        xaxis: { title: { text: config.time } },
        yaxis: { title: { text: label(dataset, config.value) } },
        showlegend: false,
      },
      reading: {
        lead: `Evolución de “${config.value}” a lo largo de “${config.time}”: ${trendWord(values)}. Varía entre ${num(Math.min(...values))} y ${num(Math.max(...values))} en ${values.length} puntos.`,
        stats: [
          { k: "Puntos", v: num(values.length, 0) },
          { k: "Inicio", v: num(values[0]) },
          { k: "Final", v: num(values[values.length - 1]) },
          { k: "Cambio", v: num(values[values.length - 1] - values[0]) },
        ],
        notes: ["Conecta observaciones consecutivas: presupone que el orden temporal es significativo y el muestreo regular.", "Para juzgar si la tendencia es real, examina la autocorrelación (gráfico ACF)."],
        cautions: ["Una escala vertical truncada puede exagerar fluctuaciones menores."],
      },
    };
  },
};

/* ================================ Área ================================= */
const areaChart = {
  roles: [TIME_ROLE, VALUE_ROLE],
  build(dataset, config) {
    const { index, values } = orderByTime(dataset.rows, config.time, config.value);
    return {
      traces: [{ type: "scatter", mode: "lines", x: index, y: values, fill: "tozeroy",
        name: config.value, line: { width: 2 } }],
      layout: {
        xaxis: { title: { text: config.time } },
        yaxis: { title: { text: label(dataset, config.value) }, rangemode: "tozero" },
        showlegend: false,
      },
      reading: {
        lead: `Área bajo la serie “${config.value}”. El relleno enfatiza el volumen acumulado y la magnitud, más que el valor puntual.`,
        stats: [{ k: "Puntos", v: num(values.length, 0) }, { k: "Máximo", v: num(Math.max(...values)) }],
        notes: ["El área es apropiada cuando el cero es significativo; si no, una línea comunica mejor.", trendWord(values) + "."],
        cautions: ["No uses área con un eje truncado: el relleno deja de ser proporcional."],
      },
    };
  },
};

/* ========================== Líneas múltiples =========================== */
const multilineChart = {
  roles: [TIME_ROLE],
  build(dataset, config) {
    const rows = sortedByTime(dataset.rows, config.time);
    const names = seriesVars(dataset, config.time);
    const index = rows.map((r) => r[config.time]);
    const traces = names.map((nm) => ({
      type: "scatter", mode: "lines+markers", name: nm,
      x: index, y: rows.map((r) => r[nm]), line: { width: 2 }, marker: { size: 4 },
    }));
    const finals = names.map((nm) => ({ nm, v: rows[rows.length - 1]?.[nm] }));
    const top = finals.slice().sort((a, b) => b.v - a.v)[0];
    return {
      traces,
      layout: { xaxis: { title: { text: config.time } }, yaxis: { title: { text: "Valor" } }, showlegend: true },
      reading: {
        lead: `Comparación de ${names.length} series sobre “${config.time}”. Al final del periodo, la serie con mayor valor es “${top?.nm}” (${num(top?.v)}).`,
        stats: finals.map((f) => ({ k: f.nm, v: num(f.v) })),
        notes: ["Útil cuando las series comparten unidad y escala.", "Si las escalas difieren mucho, considera estandarizarlas o usar ejes separados."],
        cautions: ["Demasiadas líneas saturan el gráfico; resalta solo las relevantes."],
      },
    };
  },
};

/* =========================== Área apilada ============================== */
const areaStackedChart = {
  roles: [TIME_ROLE],
  build(dataset, config) {
    const rows = sortedByTime(dataset.rows, config.time);
    const names = seriesVars(dataset, config.time);
    const index = rows.map((r) => r[config.time]);
    const traces = names.map((nm) => ({
      type: "scatter", mode: "lines", name: nm, stackgroup: "one",
      x: index, y: rows.map((r) => r[nm]), line: { width: 1 },
    }));
    return {
      traces,
      layout: { xaxis: { title: { text: config.time } }, yaxis: { title: { text: "Valor acumulado" }, rangemode: "tozero" }, showlegend: true },
      reading: {
        lead: `Composición acumulada de ${names.length} series sobre “${config.time}”. La altura total es la suma; cada banda aporta su parte.`,
        stats: [{ k: "Series", v: num(names.length, 0) }, { k: "Puntos", v: num(index.length, 0) }],
        notes: ["Comunica tanto el total como la contribución de cada serie.", "Solo tiene sentido cuando las series son sumables (mismas unidades, parte de un todo)."],
        cautions: ["Es difícil leer la evolución de las bandas superiores, que se apoyan en las de abajo."],
      },
    };
  },
};

/* ============================= Streamgraph ============================= */
const streamgraphChart = {
  roles: [TIME_ROLE],
  build(dataset, config) {
    const rows = sortedByTime(dataset.rows, config.time);
    const names = seriesVars(dataset, config.time);
    const index = rows.map((r) => r[config.time]);
    const totals = index.map((_, i) => names.reduce((s, nm) => s + (rows[i][nm] || 0), 0));
    const baseline = totals.map((t) => -t / 2);

    const traces = [{
      type: "scatter", mode: "lines", x: index, y: baseline,
      line: { width: 0 }, hoverinfo: "skip", showlegend: false,
    }];
    const current = baseline.slice();
    for (const nm of names) {
      const upper = current.map((c, i) => c + (rows[i][nm] || 0));
      traces.push({
        type: "scatter", mode: "lines", name: nm, x: index, y: upper.slice(),
        fill: "tonexty", line: { width: 0.5 },
        hovertemplate: `${nm}<extra></extra>`,
      });
      for (let i = 0; i < current.length; i += 1) current[i] = upper[i];
    }
    return {
      traces,
      layout: {
        xaxis: { title: { text: config.time } },
        yaxis: { title: { text: "" }, showticklabels: false, zeroline: false },
        showlegend: true,
      },
      reading: {
        lead: `Streamgraph de ${names.length} series: bandas apiladas alrededor de una línea central móvil. Enfatiza cómo cambia la composición a lo largo de “${config.time}”, no los valores absolutos.`,
        stats: [{ k: "Series", v: num(names.length, 0) }, { k: "Puntos", v: num(index.length, 0) }],
        notes: ["El grosor de cada banda es su magnitud; la línea base se centra para una lectura orgánica.", "Es estético y bueno para tendencias de composición con muchas series."],
        cautions: ["Sacrifica la lectura de valores exactos: úsalo para la forma general, no para cifras."],
      },
    };
  },
};

/* =============================== Horizon =============================== */
const horizonChart = {
  roles: [TIME_ROLE, VALUE_ROLE],
  build(dataset, config) {
    const { index, values } = orderByTime(dataset.rows, config.time, config.value);
    const mid = medianOf(values);
    const dev = values.map((v) => v - mid);
    const bands = 2;
    const bandSize = (Math.max(...dev.map(Math.abs)) || 1) / bands;
    const POS = ["rgba(43,68,201,0.35)", "rgba(43,68,201,0.75)"];
    const NEG = ["rgba(224,130,61,0.35)", "rgba(224,130,61,0.75)"];
    const traces = [];
    for (let b = 0; b < bands; b += 1) {
      traces.push({
        type: "scatter", mode: "lines", x: index,
        y: dev.map((d) => clamp(d - b * bandSize, 0, bandSize)),
        fill: "tozeroy", fillcolor: POS[b], line: { width: 0 },
        name: b === 0 ? "Sobre la mediana" : "", showlegend: b === 0, hoverinfo: "skip",
      });
      traces.push({
        type: "scatter", mode: "lines", x: index,
        y: dev.map((d) => clamp(-d - b * bandSize, 0, bandSize)),
        fill: "tozeroy", fillcolor: NEG[b], line: { width: 0 },
        name: b === 0 ? "Bajo la mediana" : "", showlegend: b === 0, hoverinfo: "skip",
      });
    }
    return {
      traces,
      layout: {
        xaxis: { title: { text: config.time } },
        yaxis: { title: { text: "Desviación (plegada)" }, showticklabels: false, rangemode: "tozero" },
        showlegend: true,
      },
      reading: {
        lead: `Horizon plot de “${config.value}”: las desviaciones respecto a la mediana (${num(mid)}) se pliegan y se colorean por intensidad. Azul = por encima, naranja = por debajo; más oscuro, mayor magnitud.`,
        stats: [{ k: "Mediana", v: num(mid) }, { k: "Bandas", v: num(bands, 0) }, { k: "Puntos", v: num(values.length, 0) }],
        notes: ["Comprime el rango vertical para comparar muchas series en poco espacio.", "El color sustituye a la altura: cada banda representa un tramo de magnitud."],
        cautions: ["Requiere aprendizaje: a primera vista es menos intuitivo que una línea."],
      },
    };
  },
};

/* ============================== Estacional ============================= */
const seasonalChart = {
  roles: [TIME_ROLE, VALUE_ROLE],
  paramRoles: [
    { key: "period", label: "Periodo (longitud del ciclo)", type: "number", min: 2, max: 48, step: 1, default: 12,
      hint: "Número de observaciones por ciclo (p. ej. 12 meses)." },
  ],
  build(dataset, config) {
    const { values } = orderByTime(dataset.rows, config.time, config.value);
    const period = Math.max(2, Math.round(config.period ?? 12));
    const cycles = Math.ceil(values.length / period);
    const traces = [];
    for (let c = 0; c < cycles; c += 1) {
      const slice = values.slice(c * period, c * period + period);
      traces.push({
        type: "scatter", mode: "lines+markers", name: `Ciclo ${c + 1}`,
        x: slice.map((_, i) => i + 1), y: slice, line: { width: 2 }, marker: { size: 4 },
      });
    }
    return {
      traces,
      layout: {
        xaxis: { title: { text: "Posición en el ciclo" }, dtick: 1 },
        yaxis: { title: { text: label(dataset, config.value) } },
        showlegend: true,
      },
      reading: {
        lead: `Gráfico estacional de “${config.value}” con periodo ${period}: cada ciclo se superpone. Si las curvas se solapan, el patrón estacional es estable.`,
        stats: [{ k: "Periodo", v: num(period, 0) }, { k: "Ciclos", v: num(cycles, 0) }],
        notes: ["Revela en qué posición del ciclo se repiten máximos y mínimos.", "Curvas paralelas desplazadas indican estacionalidad estable más una tendencia."],
        cautions: ["Elige bien el periodo: uno incorrecto oculta la estacionalidad real."],
      },
    };
  },
};

/* ================================ Lag ================================== */
const lagChart = {
  roles: [VALUE_ROLE, TIME_OPT_ROLE],
  paramRoles: [
    { key: "k", label: "Retardo (k)", type: "number", min: 1, max: 24, step: 1, default: 1,
      hint: "Compara cada valor con el de k pasos antes." },
  ],
  build(dataset, config) {
    const { values } = orderByTime(dataset.rows, config.time, config.value);
    const k = Math.max(1, Math.round(config.k ?? 1));
    const x = [];
    const y = [];
    for (let t = k; t < values.length; t += 1) {
      x.push(values[t - k]);
      y.push(values[t]);
    }
    // Correlación entre y_t e y_{t-k}.
    const mx = x.reduce((s, v) => s + v, 0) / (x.length || 1);
    const my = y.reduce((s, v) => s + v, 0) / (y.length || 1);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i += 1) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
    return {
      traces: [{ type: "scatter", mode: "markers", x, y, marker: { size: 8, opacity: 0.75 },
        hovertemplate: `y(t−${k})=%{x}<br>y(t)=%{y}<extra></extra>` }],
      layout: {
        xaxis: { title: { text: `${config.value} (t − ${k})` } },
        yaxis: { title: { text: `${config.value} (t)` } },
        showlegend: false,
      },
      reading: {
        lead: `Gráfico de retardo k = ${k}: enfrenta cada valor con el de ${k} paso(s) antes. La correlación es ${num(r)}; una nube alineada indica autocorrelación.`,
        stats: [{ k: `Correlación (retardo ${k})`, v: num(r) }, { k: "Pares", v: num(x.length, 0) }],
        notes: ["Una diagonal ascendente revela dependencia temporal positiva; una nube sin forma, independencia.", "Patrones curvos o agrupados pueden delatar estacionalidad o ciclos."],
        cautions: ["No sustituye a la ACF: explora un único retardo a la vez."],
      },
    };
  },
};

/* ========================= Autocorrelación (ACF) ======================= */
const acfChart = {
  roles: [VALUE_ROLE, TIME_OPT_ROLE],
  paramRoles: [
    { key: "maxLag", label: "Retardo máximo", type: "number", min: 1, max: 40, step: 1, default: 16,
      hint: "Número de retardos a calcular." },
  ],
  build(dataset, config) {
    const { values } = orderByTime(dataset.rows, config.time, config.value);
    const n = values.length;
    const maxLag = Math.max(1, Math.min(Math.round(config.maxLag ?? 16), n - 1));
    const a = acf(values, maxLag).filter((d) => d.lag >= 1);
    const bound = 1.96 / Math.sqrt(n);
    const significant = a.filter((d) => Math.abs(d.r) > bound).map((d) => d.lag);
    return {
      traces: [{ type: "bar", x: a.map((d) => d.lag), y: a.map((d) => d.r),
        hovertemplate: "retardo %{x}<br>r = %{y:.3f}<extra></extra>" }],
      layout: {
        xaxis: { title: { text: "Retardo" }, dtick: a.length > 20 ? 5 : 1 },
        yaxis: { title: { text: "Autocorrelación" }, range: [-1, 1] },
        shapes: [
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: bound, y1: bound, line: { color: "rgba(110,120,140,0.7)", width: 1, dash: "dot" } },
          { type: "line", xref: "paper", x0: 0, x1: 1, y0: -bound, y1: -bound, line: { color: "rgba(110,120,140,0.7)", width: 1, dash: "dot" } },
        ],
        showlegend: false,
      },
      reading: {
        lead: `Función de autocorrelación hasta el retardo ${maxLag}. Las barras que superan las bandas (±${num(bound, 3)}) son significativas: ${significant.length ? "retardos " + significant.slice(0, 8).join(", ") : "ninguno"}.`,
        stats: [
          { k: "n", v: num(n, 0) },
          { k: "Banda 95 %", v: `±${num(bound, 3)}` },
          { k: "Significativos", v: num(significant.length, 0) },
        ],
        notes: [
          "Una caída lenta sugiere tendencia; un pico repetido cada s retardos, estacionalidad de periodo s.",
          "Las bandas marcan el rango esperable si la serie fuera ruido sin estructura.",
        ],
        cautions: ["La ACF supone estacionariedad; con tendencia marcada conviene diferenciar la serie antes."],
      },
    };
  },
};

/* ------------------------------ Exportación ---------------------------- */
export const seriesBuilders = {
  line: lineChart,
  multiline: multilineChart,
  area: areaChart,
  "area-stacked": areaStackedChart,
  streamgraph: streamgraphChart,
  horizon: horizonChart,
  seasonal: seasonalChart,
  lag: lagChart,
  acf: acfChart,
};
