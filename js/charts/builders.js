/**
 * builders.js — Registro de constructores de gráficos.
 *
 * Une los constructores por categoría y expone una API única para el
 * renderizador y el panel de configuración: obtener el constructor de un
 * gráfico, sus roles de variable y una configuración inicial sensata derivada
 * del conjunto de datos.
 */

import { descriptiveBuilders } from "./categories/descriptive.js";
import { associationBuilders } from "./categories/association.js";
import { probabilityBuilders } from "./categories/probability.js";
import { inferenceBuilders } from "./categories/inference.js";
import { regressionBuilders } from "./categories/regression.js";
import { seriesBuilders } from "./categories/series.js";
import { multivariateBuilders } from "./categories/multivariate.js";
import { redesBuilders } from "./categories/redes.js";
import { geograficosBuilders } from "./categories/geograficos.js";
import { descriptiveExtraBuilders } from "./categories/descriptive-extra.js";
import { associationExtraBuilders } from "./categories/association-extra.js";
import { umapBuilders } from "./categories/umap.js";

/** Mapa id → constructor. Al añadir categorías (Fase 4) se amplía aquí. */
const BUILDERS = {
  ...descriptiveBuilders,
  ...associationBuilders,
  ...probabilityBuilders,
  ...inferenceBuilders,
  ...regressionBuilders,
  ...seriesBuilders,
  ...multivariateBuilders,
  ...redesBuilders,
  ...geograficosBuilders,
  ...descriptiveExtraBuilders,
  ...associationExtraBuilders,
  ...umapBuilders,
};

/** ¿Existe un constructor (render) para este gráfico? */
export function hasBuilder(id) {
  return Object.prototype.hasOwnProperty.call(BUILDERS, id);
}

/** Devuelve el constructor de un gráfico (o null). */
export function getBuilder(id) {
  return BUILDERS[id] || null;
}

/** Roles de variable que declara un gráfico. */
export function getRoles(id) {
  const b = BUILDERS[id];
  return b && b.roles ? b.roles : [];
}

/** Parámetros numéricos que declara un gráfico (distribuciones, etc.). */
export function getParamRoles(id) {
  const b = BUILDERS[id];
  return b && b.paramRoles ? b.paramRoles : [];
}

/** ¿El gráfico se define por parámetros y no por datos (p. ej. una densidad teórica)? */
export function isDataless(id) {
  return Boolean(BUILDERS[id] && BUILDERS[id].dataless);
}

/** ¿El gráfico usa automáticamente todas las variables numéricas? */
export function usesAllNumeric(id) {
  return Boolean(BUILDERS[id] && BUILDERS[id].usesAllNumeric);
}

/** Variables del conjunto compatibles con un rol (por tipo de almacenamiento). */
export function compatibleVariables(dataset, role) {
  return dataset.variables.filter((v) => role.accepts.includes(v.storageType));
}

/**
 * Construye una configuración inicial: asigna a cada rol de variable la primera
 * compatible no usada (para que ejes distintos tomen variables distintas) y
 * rellena los parámetros con su valor por defecto. Los roles opcionales se
 * completan si hay candidatos disponibles.
 * @returns {{ config: Object, missingRequired: string[] }}
 */
export function defaultConfig(dataset, id) {
  const roles = getRoles(id);
  const used = new Set();
  const config = {};
  const missingRequired = [];

  for (const role of roles) {
    const candidate = compatibleVariables(dataset, role).find(
      (v) => !used.has(v.name)
    );
    if (candidate) {
      config[role.key] = candidate.name;
      used.add(candidate.name);
    } else if (role.required) {
      missingRequired.push(role.label);
    }
  }

  for (const p of getParamRoles(id)) {
    config[p.key] = p.default;
  }

  return { config, missingRequired };
}

/**
 * Comprueba si un conjunto de datos puede satisfacer los roles obligatorios de
 * un gráfico (se usa para decidir entre los datos del usuario y el ejemplo).
 */
export function canRender(dataset, id) {
  if (!hasBuilder(id)) return false;
  if (usesAllNumeric(id)) {
    return dataset.variables.filter((v) => v.storageType === "numeric").length >= 2;
  }
  return defaultConfig(dataset, id).missingRequired.length === 0;
}
