/**
 * events.js — Bus de eventos publicación/suscripción.
 *
 * Desacopla los módulos de UI entre sí: en lugar de llamarse directamente,
 * emiten y escuchan eventos con nombre. Sin dependencias.
 *
 * @example
 *   import { bus, EVENTS } from "../core/events.js";
 *   bus.on(EVENTS.CHART_SELECTED, ({ id }) => { ... });
 *   bus.emit(EVENTS.CHART_SELECTED, { id: "histogram" });
 */

/** Catálogo central de nombres de evento (evita literales dispersos). */
export const EVENTS = Object.freeze({
  CHART_SELECTED: "chart:selected",
  CHART_CLEARED: "chart:cleared",
  CHART_RENDERED: "chart:rendered",
  CHART_CONFIG_CHANGED: "chart:config-changed",
  THEME_CHANGED: "theme:changed",
  DATA_LOADED: "data:loaded",
  DATA_CLEARED: "data:cleared",
  SIDEBAR_TOGGLE: "ui:sidebar-toggle",
  INSPECTOR_TOGGLE: "ui:inspector-toggle",
  SEARCH_CHANGED: "catalog:search",
});

class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Suscribe un manejador a un evento.
   * @returns {() => void} función para cancelar la suscripción.
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Cancela una suscripción concreta. */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /** Emite un evento con una carga opcional. */
  emit(event, payload) {
    this._listeners.get(event)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        // Un manejador defectuoso no debe tumbar a los demás.
        console.error(`[bus] error en manejador de "${event}":`, err);
      }
    });
  }
}

/** Instancia única compartida por toda la aplicación. */
export const bus = new EventBus();
