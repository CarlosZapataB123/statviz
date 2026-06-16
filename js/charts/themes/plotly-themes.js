/**
 * plotly-themes.js — Tema de Plotly derivado de los tokens CSS.
 *
 * Lee las variables de diseño activas en :root (que cambian con el tema
 * Claro / Oscuro / Universo) y construye el layout y la configuración base que
 * comparten todos los gráficos: tipografía, color de ejes y rejilla, fondos
 * transparentes (para integrarse con el lienzo) y la paleta de datos. Así un
 * mismo gráfico se ve coherente en los tres temas sin lógica duplicada.
 */

/** Lee una variable CSS de :root con un valor de reserva. */
function cssVar(name, fallback = "") {
  // Sin DOM (p. ej. en pruebas con Node) se usa siempre el valor de reserva.
  if (typeof document === "undefined" || !document.documentElement || typeof getComputedStyle === "undefined") {
    return fallback;
  }
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

/** Paleta categórica de datos (ocho colores afinados del sistema). */
export function dataColorway() {
  return [
    cssVar("--data-c1", "#2b44c9"),
    cssVar("--data-c2", "#e0823d"),
    cssVar("--data-c3", "#1f9d8f"),
    cssVar("--data-c4", "#b8466e"),
    cssVar("--data-c5", "#6a51c4"),
    cssVar("--data-c6", "#3f8ad6"),
    cssVar("--data-c7", "#9a8b2f"),
    cssVar("--data-c8", "#5b6b7a"),
  ];
}

/** Escala secuencial (para densidades, mapas de intensidad, etc.). */
export function sequentialScale() {
  return [
    [0, cssVar("--data-seq-0", "#eef1fb")],
    [0.25, cssVar("--data-seq-1", "#c3ccf2")],
    [0.5, cssVar("--data-seq-2", "#8d9ce4")],
    [0.75, cssVar("--data-seq-3", "#5566cf")],
    [1, cssVar("--data-seq-4", "#2b44c9")],
  ];
}

/**
 * Escala divergente centrada en cero, para matrices de correlación.
 * Negativo → crítico; cero → neutro; positivo → acento.
 */
export function divergingScale() {
  const neg = cssVar("--critical", "#c0392b");
  const mid = cssVar("--surface", "#ffffff");
  const pos = cssVar("--accent", "#2b44c9");
  return [
    [0, neg],
    [0.5, mid],
    [1, pos],
  ];
}

/** Construye el layout base del tema activo. */
export function themeLayout() {
  const ink = cssVar("--ink", "#13203a");
  const inkSecondary = cssVar("--ink-secondary", "#4a5878");
  const grid = cssVar("--grid-line", "rgba(20,30,60,0.08)");
  const axis = cssVar("--axis-line", "rgba(20,30,60,0.25)");
  const fontSans = cssVar("--font-sans", "system-ui, sans-serif");

  const axisBase = {
    gridcolor: grid,
    zerolinecolor: axis,
    linecolor: axis,
    tickcolor: axis,
    tickfont: { color: inkSecondary, size: 11 },
    titlefont: { color: inkSecondary, size: 12 },
    automargin: true,
  };

  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: fontSans, color: ink, size: 12 },
    colorway: dataColorway(),
    margin: { l: 56, r: 24, t: 16, b: 48 },
    hovermode: "closest",
    hoverlabel: {
      bgcolor: cssVar("--surface", "#fff"),
      bordercolor: cssVar("--border", "#e2e6ee"),
      font: { family: fontSans, color: ink, size: 12 },
    },
    xaxis: { ...axisBase },
    yaxis: { ...axisBase },
    legend: {
      font: { color: inkSecondary, size: 11 },
      bgcolor: "rgba(0,0,0,0)",
      orientation: "h",
      y: -0.18,
    },
  };
}

/**
 * Escena 3D coherente con el tema, para los gráficos que admiten modo 3D.
 * Ejes con la rejilla y los colores del tema, fondos transparentes y una
 * cámara por defecto en perspectiva.
 */
export function themeScene() {
  const inkSecondary = cssVar("--ink-secondary", "#4a5878");
  const grid = cssVar("--grid-line", "rgba(20,30,60,0.08)");
  const axis = cssVar("--axis-line", "rgba(20,30,60,0.25)");
  const axis3d = {
    gridcolor: grid,
    zerolinecolor: axis,
    linecolor: axis,
    showbackground: false,
    backgroundcolor: "rgba(0,0,0,0)",
    tickfont: { color: inkSecondary, size: 10 },
    titlefont: { color: inkSecondary, size: 11 },
  };
  return {
    xaxis: { ...axis3d },
    yaxis: { ...axis3d },
    zaxis: { ...axis3d },
    bgcolor: "rgba(0,0,0,0)",
    camera: { eye: { x: 1.6, y: 1.6, z: 1.1 } },
    aspectmode: "cube",
  };
}

/** Configuración de interacción/exportación común a todos los gráficos. */
export function themeConfig() {
  return {
    responsive: true,
    displaylogo: false,
    displayModeBar: "hover",
    modeBarButtonsToRemove: [
      "lasso2d",
      "select2d",
      "autoScale2d",
      "toggleSpikelines",
    ],
    toImageButtonOptions: { format: "png", scale: 2 },
  };
}
