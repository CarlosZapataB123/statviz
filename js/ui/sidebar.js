/**
 * sidebar.js — Catálogo navegable de gráficos.
 *
 * Construye la lista de categorías y gráficos a partir del registro, gestiona
 * el colapso por categoría, filtra por texto y emite la selección. No conoce
 * el resto de la UI: solo actualiza el estado y publica eventos.
 */

import { bus, EVENTS } from "../core/events.js";
import { store } from "../core/state.js";
import {
  CATEGORIES,
  getChartsByCategory,
  TOTAL_CHARTS,
} from "../charts/registry.js";

let listEl = null;
let searchEl = null;
let countEl = null;

/** Iconos SVG en línea (sin dependencias de iconos). */
const ICON_CHEVRON =
  '<svg class="cat__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

/** Normaliza texto para búsqueda insensible a acentos y mayúsculas. */
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Construye el nodo de un gráfico. */
function chartItem(chart) {
  const btn = document.createElement("button");
  btn.className = "chart-item";
  btn.type = "button";
  btn.dataset.chartId = chart.id;
  btn.dataset.implemented = String(chart.implemented);
  btn.setAttribute("aria-current", "false");

  const name = document.createElement("span");
  name.className = "chart-item__name";
  name.textContent = chart.name;
  btn.appendChild(name);

  if (chart.supports3D) {
    const tag = document.createElement("span");
    tag.className = "chart-item__tag chart-item__tag--3d";
    tag.textContent = "3D";
    btn.appendChild(tag);
  }
  return btn;
}

/** Construye el bloque de una categoría con sus gráficos. */
function categoryBlock(category) {
  const charts = getChartsByCategory(category.id);

  const wrap = document.createElement("section");
  wrap.className = "cat";
  wrap.dataset.catId = category.id;
  wrap.dataset.open = "true";

  const header = document.createElement("button");
  header.className = "cat__header";
  header.type = "button";
  header.setAttribute("aria-expanded", "true");
  header.innerHTML =
    ICON_CHEVRON +
    `<span class="cat__title">${category.name}</span>` +
    `<span class="cat__count">${charts.length}</span>`;
  wrap.appendChild(header);

  const list = document.createElement("div");
  list.className = "cat__list";
  list.setAttribute("role", "list");
  charts.forEach((c) => list.appendChild(chartItem(c)));
  wrap.appendChild(list);

  return wrap;
}

/** Render inicial del catálogo completo. */
function renderCatalog() {
  listEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  CATEGORIES.forEach((cat) => frag.appendChild(categoryBlock(cat)));
  listEl.appendChild(frag);
  if (countEl) countEl.textContent = `${TOTAL_CHARTS} gráficos`;
}

/** Alterna el colapso de una categoría. */
function toggleCategory(catEl) {
  const open = catEl.dataset.open === "true";
  catEl.dataset.open = String(!open);
  catEl.querySelector(".cat__header")?.setAttribute("aria-expanded", String(!open));
}

/** Marca visualmente el gráfico seleccionado. */
function markSelected(chartId) {
  listEl.querySelectorAll(".chart-item").forEach((el) => {
    el.setAttribute("aria-current", String(el.dataset.chartId === chartId));
  });
}

/** Filtra el catálogo por texto; oculta categorías sin coincidencias. */
function applyFilter(query) {
  const q = normalize(query.trim());
  listEl.querySelectorAll(".cat").forEach((catEl) => {
    let visibleInCat = 0;
    catEl.querySelectorAll(".chart-item").forEach((item) => {
      const name = normalize(item.querySelector(".chart-item__name").textContent);
      const match = q === "" || name.includes(q);
      item.style.display = match ? "" : "none";
      if (match) visibleInCat += 1;
    });
    // Con búsqueda activa, abrir categorías con resultados y ocultar las vacías.
    catEl.style.display = visibleInCat === 0 && q !== "" ? "none" : "";
    if (q !== "") catEl.dataset.open = "true";
  });
}

/**
 * Inicializa la barra lateral.
 * @param {Object} refs
 * @param {HTMLElement} refs.listEl    Contenedor de la lista del catálogo
 * @param {HTMLInputElement} refs.searchEl  Campo de búsqueda
 * @param {HTMLElement} [refs.countEl] Elemento donde mostrar el total
 */
export function initSidebar({ listEl: l, searchEl: s, countEl: c }) {
  listEl = l;
  searchEl = s;
  countEl = c;

  renderCatalog();

  // Delegación: colapso de categoría y selección de gráfico.
  listEl.addEventListener("click", (e) => {
    const header = e.target.closest(".cat__header");
    if (header) {
      toggleCategory(header.closest(".cat"));
      return;
    }
    const item = e.target.closest(".chart-item");
    if (item) {
      const id = item.dataset.chartId;
      store.set("chart.id", id);
      markSelected(id);
      bus.emit(EVENTS.CHART_SELECTED, { id });
    }
  });

  // Búsqueda con anti-rebote ligero.
  let t = null;
  searchEl?.addEventListener("input", () => {
    clearTimeout(t);
    const value = searchEl.value;
    t = setTimeout(() => {
      store.set("ui.search", value);
      applyFilter(value);
      bus.emit(EVENTS.SEARCH_CHANGED, { query: value });
    }, 90);
  });

  // Reflejar selecciones emitidas por otros módulos (p. ej. "Ver un ejemplo").
  bus.on(EVENTS.CHART_SELECTED, ({ id }) => markSelected(id));
  // Si otro módulo limpia la selección, reflejarlo.
  bus.on(EVENTS.CHART_CLEARED, () => markSelected(null));
}
