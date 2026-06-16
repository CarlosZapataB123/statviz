/**
 * geo.js — Utilidades geoespaciales para la categoría Geográficos.
 *
 * Caja envolvente de un conjunto de coordenadas, generación de una rejilla,
 * estimación de densidad por núcleo gaussiano (KDE 2D) e interpolación por
 * distancia inversa ponderada (IDW). Distancias en grados (suficiente a escala
 * ilustrativa); no sustituyen a un SIG con proyección geodésica.
 */

/** Caja envolvente con un margen relativo. */
export function boundingBox(lats, lons, padFrac = 0.12) {
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const padLat = (latMax - latMin || 1) * padFrac;
  const padLon = (lonMax - lonMin || 1) * padFrac;
  return {
    latMin: latMin - padLat, latMax: latMax + padLat,
    lonMin: lonMin - padLon, lonMax: lonMax + padLon,
  };
}

/** Rejilla regular de nx × ny puntos dentro de la caja (orden por filas). */
export function gridPoints(bbox, nx = 16, ny = 16) {
  const pts = [];
  for (let r = 0; r < ny; r += 1) {
    const lat = bbox.latMin + ((bbox.latMax - bbox.latMin) * r) / (ny - 1);
    for (let c = 0; c < nx; c += 1) {
      const lon = bbox.lonMin + ((bbox.lonMax - bbox.lonMin) * c) / (nx - 1);
      pts.push({ lat, lon });
    }
  }
  return pts;
}

/** Diagonal de la caja (escala de referencia para el ancho de banda). */
export function boxDiagonal(bbox) {
  return Math.hypot(bbox.latMax - bbox.latMin, bbox.lonMax - bbox.lonMin);
}

/**
 * Densidad por núcleo gaussiano evaluada en cada punto de la rejilla.
 * @returns {number[]} densidades normalizadas a máximo 1
 */
export function kde2d(lats, lons, grid, bandwidth) {
  const h = bandwidth || 1;
  const inv2h2 = 1 / (2 * h * h);
  const dens = grid.map((g) => {
    let s = 0;
    for (let i = 0; i < lats.length; i += 1) {
      const dLat = g.lat - lats[i];
      const dLon = g.lon - lons[i];
      s += Math.exp(-(dLat * dLat + dLon * dLon) * inv2h2);
    }
    return s;
  });
  const max = Math.max(...dens, 1e-12);
  return dens.map((d) => d / max);
}

/**
 * Interpolación por distancia inversa ponderada de `values` en la rejilla.
 * En el propio punto muestral devuelve su valor exacto.
 * @returns {number[]}
 */
export function idw(lats, lons, values, grid, power = 2) {
  return grid.map((g) => {
    let wsum = 0;
    let vsum = 0;
    for (let i = 0; i < lats.length; i += 1) {
      const dLat = g.lat - lats[i];
      const dLon = g.lon - lons[i];
      const d2 = dLat * dLat + dLon * dLon;
      if (d2 < 1e-12) return values[i]; // coincide con una muestra
      const w = 1 / Math.pow(d2, power / 2);
      wsum += w;
      vsum += w * values[i];
    }
    return wsum > 0 ? vsum / wsum : 0;
  });
}
