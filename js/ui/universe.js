/**
 * universe.js — Campo de estrellas del tema Universo.
 *
 * Dibuja un cielo estrellado discreto sobre <canvas>. Diseñado con moderación:
 * estrellas pequeñas, parpadeo lentísimo y nada de movimiento brusco. Respeta
 * prefers-reduced-motion (render estático) y la densidad de píxeles del
 * dispositivo. Se activa/desactiva desde el conmutador de tema.
 */

const STAR_DENSITY = 0.00014; // estrellas por píxel de área
const SIZE_TIERS = [
  { r: 0.6, alpha: 0.5, twinkle: 0.15 },
  { r: 0.9, alpha: 0.7, twinkle: 0.25 },
  { r: 1.4, alpha: 0.9, twinkle: 0.35 },
];

let canvas = null;
let ctx = null;
let stars = [];
let rafId = null;
let running = false;
let reduceMotion = false;
let resizeObserver = null;

/** Genera el conjunto de estrellas en función del área del lienzo. */
function seedStars(width, height) {
  const count = Math.round(width * height * STAR_DENSITY);
  stars = Array.from({ length: count }, () => {
    const tier = SIZE_TIERS[Math.floor(Math.random() * SIZE_TIERS.length)];
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: tier.r,
      baseAlpha: tier.alpha,
      twinkle: tier.twinkle,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0006 + Math.random() * 0.0010, // fase muy lenta
    };
  });
}

/** Ajusta el tamaño del lienzo al contenedor y a la densidad de píxeles. */
function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { clientWidth: w, clientHeight: h } = canvas;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedStars(w, h);
  if (!running) drawStatic();
}

/** Pinta un fotograma con el parpadeo correspondiente al instante t. */
function drawFrame(t) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    const a = s.baseAlpha + Math.sin(t * s.speed + s.phase) * s.twinkle;
    ctx.globalAlpha = Math.max(0.05, Math.min(1, a));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = "#dfe7ff";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Render estático (sin parpadeo) para movimiento reducido. */
function drawStatic() {
  if (!canvas) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    ctx.globalAlpha = s.baseAlpha;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = "#dfe7ff";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function loop(t) {
  drawFrame(t);
  rafId = requestAnimationFrame(loop);
}

/**
 * Inicia el campo de estrellas. Idempotente: si ya está activo, no hace nada.
 * @param {HTMLCanvasElement} canvasEl
 */
export function startUniverse(canvasEl) {
  if (running || !canvasEl) return;
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
  if (!ctx) return;

  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  resize();
  running = true;

  if (reduceMotion) {
    drawStatic(); // cielo fijo, sin animación
  } else {
    rafId = requestAnimationFrame(loop);
  }

  // Reaccionar a cambios de tamaño del contenedor.
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }
}

/** Detiene y limpia el campo de estrellas. Libera el bucle de animación. */
export function stopUniverse() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  } else {
    window.removeEventListener("resize", resize);
  }
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }
  stars = [];
}
