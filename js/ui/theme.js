/**
 * theme.js — Gestión del tema visual (Claro / Oscuro / Universo).
 *
 * Aplica el tema al elemento raíz (data-theme), lo persiste en localStorage
 * (con degradación elegante si está bloqueado), respeta la preferencia del
 * sistema como valor por defecto y enciende/apaga el campo de estrellas del
 * tema Universo. Mantiene sincronizado el conmutador segmentado.
 */

import { bus, EVENTS } from "../core/events.js";
import { store } from "../core/state.js";
import { startUniverse, stopUniverse } from "./universe.js";

const STORAGE_KEY = "statviz:theme";
const VALID = ["light", "dark", "universe"];

let switchEl = null;
let canvasEl = null;

/** Lee el tema persistido, o deduce uno del sistema. */
function resolveInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID.includes(saved)) return saved;
  } catch {
    /* localStorage no disponible: se ignora y se usa la preferencia del sistema */
  }
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

/** Persiste el tema (silencioso si localStorage está bloqueado). */
function persist(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* sin persistencia: la sesión sigue funcionando con normalidad */
  }
}

/** Refleja el tema activo en los botones del conmutador. */
function syncSwitch(theme) {
  if (!switchEl) return;
  switchEl.querySelectorAll("[data-theme-value]").forEach((btn) => {
    const isActive = btn.dataset.themeValue === theme;
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

/**
 * Aplica un tema: actualiza el DOM, el estado, la persistencia, el canvas y
 * el conmutador, y anuncia el cambio por el bus.
 */
export function applyTheme(theme) {
  if (!VALID.includes(theme)) theme = "light";
  document.documentElement.setAttribute("data-theme", theme);
  store.set("theme", theme);
  persist(theme);
  syncSwitch(theme);

  // El campo de estrellas solo vive en el tema Universo.
  if (theme === "universe") {
    startUniverse(canvasEl);
  } else {
    stopUniverse();
  }

  bus.emit(EVENTS.THEME_CHANGED, { theme });
}

/**
 * Inicializa el subsistema de tema.
 * @param {Object} refs
 * @param {HTMLElement} refs.switchEl  Contenedor del conmutador segmentado
 * @param {HTMLCanvasElement} refs.canvasEl  Canvas del campo de estrellas
 */
export function initTheme({ switchEl: sw, canvasEl: cv }) {
  switchEl = sw;
  canvasEl = cv;

  // Delegación de clics en el conmutador.
  switchEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-value]");
    if (!btn) return;
    applyTheme(btn.dataset.themeValue);
  });

  applyTheme(resolveInitialTheme());
}
