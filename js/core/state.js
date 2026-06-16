/**
 * state.js — Estado global de la aplicación.
 *
 * Un store mínimo y predecible: lectura por ruta, escritura con notificación
 * a suscriptores. Es la fuente de verdad del modelo de datos que las fases
 * posteriores irán poblando (variables detectadas, configuración del gráfico,
 * interpretación generada, etc.).
 */

/**
 * Forma del estado (documentada como contrato para todo el equipo).
 * @typedef {Object} AppState
 * @property {string} theme                 "light" | "dark" | "universe"
 * @property {Object} data
 * @property {Array}  data.rows             Filas crudas (objetos columna→valor)
 * @property {Array}  data.variables        [{ name, type, level, values }]
 * @property {string} data.source           "ejemplo" | "csv" | "manual" | null
 * @property {string|null} data.exampleKey  Clave del dataset de ejemplo activo
 * @property {Object} chart
 * @property {string|null} chart.id         Id del gráfico seleccionado
 * @property {"2d"|"3d"} chart.mode         Modo de visualización
 * @property {Object} chart.config          Configuración específica del gráfico
 * @property {Array}  chart.recommendations Ids sugeridos por el motor (Fase 6)
 * @property {Object|null} interpretation   Texto interpretativo (Fase 6)
 * @property {Object} ui
 * @property {boolean} ui.sidebarOpen
 * @property {boolean} ui.inspectorOpen
 * @property {string} ui.search             Filtro del catálogo
 */

/** @type {AppState} */
const initialState = {
  theme: "light",
  data: {
    rows: [],
    variables: [],
    source: null,
    exampleKey: null,
  },
  chart: {
    id: null,
    mode: "2d",
    config: {},
    recommendations: [],
  },
  interpretation: null,
  ui: {
    sidebarOpen: false,
    inspectorOpen: false,
    search: "",
  },
};

class Store {
  constructor(seed) {
    this._state = structuredClone(seed);
    /** @type {Set<(state: AppState) => void>} */
    this._subscribers = new Set();
  }

  /** Devuelve una copia inmutable del estado completo. */
  getState() {
    return structuredClone(this._state);
  }

  /**
   * Lee un valor por ruta con puntos. Devuelve `fallback` si no existe.
   * @example store.get("chart.mode")
   */
  get(path, fallback = undefined) {
    const value = path
      .split(".")
      .reduce((acc, key) => (acc == null ? acc : acc[key]), this._state);
    return value === undefined ? fallback : value;
  }

  /**
   * Escribe un valor por ruta con puntos y notifica a los suscriptores.
   * Crea los nodos intermedios que falten.
   */
  set(path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((acc, key) => {
      if (acc[key] == null || typeof acc[key] !== "object") acc[key] = {};
      return acc[key];
    }, this._state);
    target[last] = value;
    this._notify();
  }

  /** Fusiona un objeto parcial dentro de un nodo del estado. */
  patch(path, partial) {
    const current = this.get(path, {});
    this.set(path, { ...current, ...partial });
  }

  /**
   * Suscribe un observador a cualquier cambio del estado.
   * @returns {() => void} función para cancelar la suscripción.
   */
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  _notify() {
    const snapshot = this.getState();
    this._subscribers.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error("[store] error en suscriptor:", err);
      }
    });
  }
}

/** Instancia única compartida. */
export const store = new Store(initialState);
