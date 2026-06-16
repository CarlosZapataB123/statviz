/**
 * app.js — Punto de entrada de la aplicación.
 *
 * Recoge las referencias del DOM, inicializa cada módulo de UI y conecta el
 * comportamiento del shell (colapso del inspector, sidebar en pantallas
 * estrechas, velo de overlay). No contiene lógica de dominio: solo orquesta.
 */

import { initTheme } from "../ui/theme.js";
import { initSidebar } from "../ui/sidebar.js";
import { initStatusbar } from "../ui/statusbar.js";
import { initInspector } from "../ui/inspector.js";
import { initWorkspace } from "../ui/workspace.js";
import { initDataIntake } from "../ui/dataIntake.js";
import { initRecommender } from "../ui/recommender.js";
import { initExporter } from "../ui/exporter.js";

const NARROW = "(max-width: 1080px)";
const MOBILE = "(max-width: 760px)";

function boot() {
  const $ = (id) => document.getElementById(id);
  const app = $("app");

  /* --- Inicialización de subsistemas ----------------------------------- */
  initTheme({
    switchEl: $("theme-switch"),
    canvasEl: $("universe-stars"),
  });

  initSidebar({
    listEl: $("catalog-list"),
    searchEl: $("catalog-search"),
    countEl: $("catalog-count"),
  });

  initStatusbar({
    nEl: $("status-n"),
    varsEl: $("status-vars"),
    sourceEl: $("status-source"),
    dotEl: $("status-dot"),
  });

  initInspector({
    tabsEl: $("inspector-tabs"),
    panelEl: $("inspector-panel"),
  });

  initDataIntake({
    openBtn: $("btn-load-data"),
  });

  initRecommender({
    openBtn: $("btn-recommend"),
  });

  initExporter({
    openBtn: $("btn-export"),
  });

  /* --- Gestión de overlays / colapsos ---------------------------------- */
  const scrim = $("scrim");

  const isNarrow = () => window.matchMedia(NARROW).matches;
  const isMobile = () => window.matchMedia(MOBILE).matches;

  function updateScrim() {
    const sidebarOpen = app.dataset.sidebar === "open";
    const inspectorOpen = app.dataset.inspector === "open";
    const show = (isMobile() && sidebarOpen) || (isNarrow() && inspectorOpen);
    scrim.dataset.visible = String(show);
  }

  function closeOverlays() {
    if (app.dataset.sidebar === "open") app.dataset.sidebar = "";
    if (app.dataset.inspector === "open") app.dataset.inspector = "";
    updateScrim();
  }

  function toggleInspector() {
    const cur = app.dataset.inspector || "";
    if (isNarrow()) {
      app.dataset.inspector = cur === "open" ? "" : "open";
    } else {
      app.dataset.inspector = cur === "collapsed" ? "" : "collapsed";
    }
    updateScrim();
  }

  function toggleSidebar() {
    app.dataset.sidebar = app.dataset.sidebar === "open" ? "" : "open";
    updateScrim();
  }

  $("btn-inspector")?.addEventListener("click", toggleInspector);
  $("btn-menu")?.addEventListener("click", toggleSidebar);
  scrim?.addEventListener("click", closeOverlays);

  // Cerrar overlays con Escape.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlays();
  });

  // Al ensanchar la ventana, limpiar estados de overlay para evitar el velo
  // atascado o paneles fuera de sitio.
  window.addEventListener("resize", () => {
    if (!isNarrow()) {
      if (app.dataset.inspector === "open") app.dataset.inspector = "";
    }
    if (!isMobile()) {
      if (app.dataset.sidebar === "open") app.dataset.sidebar = "";
    }
    updateScrim();
  });

  /* --- Workspace (depende de las acciones del shell) ------------------- */
  initWorkspace({
    rootEl: $("workspace-inner"),
    onExplore: () => {
      if (isMobile()) {
        app.dataset.sidebar = "open";
        updateScrim();
      }
      $("catalog-search")?.focus();
    },
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
