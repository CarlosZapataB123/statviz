/**
 * networks.js — Motor de grafos para la categoría Redes.
 *
 * Disposiciones de nodos (circular y por fuerzas de Fruchterman–Reingold,
 * reproducible mediante semilla) y extracción de aristas de correlación para
 * la red de asociación entre variables. La construcción de grafos a partir de
 * tablas de contingencia se hace en los constructores.
 */

import { mulberry32 } from "./multivariate.js";

/** Coloca n nodos equiespaciados sobre una circunferencia de radio dado. */
export function circleLayout(n, radius = 1) {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

/**
 * Disposición por fuerzas (Fruchterman–Reingold). La posición depende solo de
 * la topología (las aristas atraen, todos los nodos se repelen); el peso de la
 * arista se reserva para el grosor del trazo, no para la geometría.
 * @returns {{x:number,y:number}[]} posiciones normalizadas a [-1, 1]
 */
export function forceLayout(n, edges, { seed = 42, iters = 300, width = 2, height = 2 } = {}) {
  const rng = mulberry32(seed);
  const area = width * height;
  const k = Math.sqrt(area / Math.max(1, n));
  const pos = Array.from({ length: n }, () => ({ x: (rng() - 0.5) * width, y: (rng() - 0.5) * height }));
  let temp = width / 10;

  for (let it = 0; it < iters; it += 1) {
    const disp = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    // Repulsión entre todos los pares.
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d = Math.hypot(dx, dy) || 1e-3;
        const f = (k * k) / d;
        disp[i].x += (dx / d) * f;
        disp[i].y += (dy / d) * f;
      }
    }
    // Atracción a lo largo de las aristas.
    for (const e of edges) {
      const dx = pos[e.source].x - pos[e.target].x;
      const dy = pos[e.source].y - pos[e.target].y;
      const d = Math.hypot(dx, dy) || 1e-3;
      const f = (d * d) / k;
      disp[e.source].x -= (dx / d) * f;
      disp[e.source].y -= (dy / d) * f;
      disp[e.target].x += (dx / d) * f;
      disp[e.target].y += (dy / d) * f;
    }
    // Desplazamiento limitado por la temperatura, que decae.
    for (let i = 0; i < n; i += 1) {
      const dl = Math.hypot(disp[i].x, disp[i].y) || 1e-3;
      pos[i].x += (disp[i].x / dl) * Math.min(dl, temp);
      pos[i].y += (disp[i].y / dl) * Math.min(dl, temp);
    }
    temp *= 0.95;
  }

  // Centrar y escalar a [-1, 1].
  const cx = pos.reduce((s, p) => s + p.x, 0) / n;
  const cy = pos.reduce((s, p) => s + p.y, 0) / n;
  let maxR = 0;
  for (const p of pos) { p.x -= cx; p.y -= cy; maxR = Math.max(maxR, Math.hypot(p.x, p.y)); }
  maxR = maxR || 1;
  return pos.map((p) => ({ x: p.x / maxR, y: p.y / maxR }));
}

/**
 * Variante 3D de la disposición por fuerzas (mismas reglas en tres ejes).
 * @returns {{x:number,y:number,z:number}[]} posiciones normalizadas a [-1, 1]
 */
export function forceLayout3d(n, edges, { seed = 42, iters = 300, size = 2 } = {}) {
  const rng = mulberry32(seed);
  const k = Math.cbrt((size * size * size) / Math.max(1, n));
  const pos = Array.from({ length: n }, () => ({ x: (rng() - 0.5) * size, y: (rng() - 0.5) * size, z: (rng() - 0.5) * size }));
  let temp = size / 10;

  for (let it = 0; it < iters; it += 1) {
    const disp = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const dz = pos[i].z - pos[j].z;
        const d = Math.hypot(dx, dy, dz) || 1e-3;
        const f = (k * k) / d;
        disp[i].x += (dx / d) * f; disp[i].y += (dy / d) * f; disp[i].z += (dz / d) * f;
      }
    }
    for (const e of edges) {
      const dx = pos[e.source].x - pos[e.target].x;
      const dy = pos[e.source].y - pos[e.target].y;
      const dz = pos[e.source].z - pos[e.target].z;
      const d = Math.hypot(dx, dy, dz) || 1e-3;
      const f = (d * d) / k;
      disp[e.source].x -= (dx / d) * f; disp[e.source].y -= (dy / d) * f; disp[e.source].z -= (dz / d) * f;
      disp[e.target].x += (dx / d) * f; disp[e.target].y += (dy / d) * f; disp[e.target].z += (dz / d) * f;
    }
    for (let i = 0; i < n; i += 1) {
      const dl = Math.hypot(disp[i].x, disp[i].y, disp[i].z) || 1e-3;
      const lim = Math.min(dl, temp);
      pos[i].x += (disp[i].x / dl) * lim; pos[i].y += (disp[i].y / dl) * lim; pos[i].z += (disp[i].z / dl) * lim;
    }
    temp *= 0.95;
  }

  const c = pos.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }), { x: 0, y: 0, z: 0 });
  c.x /= n; c.y /= n; c.z /= n;
  let maxR = 0;
  for (const p of pos) { p.x -= c.x; p.y -= c.y; p.z -= c.z; maxR = Math.max(maxR, Math.hypot(p.x, p.y, p.z)); }
  maxR = maxR || 1;
  return pos.map((p) => ({ x: p.x / maxR, y: p.y / maxR, z: p.z / maxR }));
}

/**
 * Aristas de una red de correlación: pares de variables cuyo |r| alcanza el
 * umbral. Conserva el signo para colorear la relación.
 * @returns {Array<{source:number, target:number, weight:number, r:number}>}
 */
export function correlationEdges(corr, threshold) {
  const edges = [];
  const p = corr.length;
  for (let i = 0; i < p; i += 1) {
    for (let j = i + 1; j < p; j += 1) {
      const r = corr[i][j];
      if (Math.abs(r) >= threshold) edges.push({ source: i, target: j, weight: Math.abs(r), r });
    }
  }
  return edges;
}
