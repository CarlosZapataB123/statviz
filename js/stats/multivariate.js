/**
 * multivariate.js — Motor multivariado (sin librerías).
 *
 * Implementa el álgebra y los algoritmos que sustentan la reducción de
 * dimensionalidad y el agrupamiento:
 *  - Descomposición espectral de matrices simétricas por el método de Jacobi.
 *  - Análisis de componentes principales (PCA) sobre la matriz de correlación.
 *  - k-medias con inicialización k-means++ (semilla fija para reproducibilidad).
 *  - Escalado multidimensional clásico (MDS) por doble centrado.
 *  - Agrupamiento jerárquico aglomerativo (enlace promedio) con su dendrograma.
 *  - t-SNE (afinidades gaussianas con perplejidad objetivo y descenso por
 *    gradiente con momento).
 */

/* ===================== Generador pseudoaleatorio ====================== */
/** RNG reproducible (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ========================= Álgebra de apoyo =========================== */

/** Estandariza por columnas (z-scores). Devuelve {Z, means, sds}. */
export function standardizeColumns(M) {
  const n = M.length;
  const p = M[0].length;
  const means = new Array(p).fill(0);
  const sds = new Array(p).fill(0);
  for (let j = 0; j < p; j += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) s += M[i][j];
    means[j] = s / n;
    let v = 0;
    for (let i = 0; i < n; i += 1) v += (M[i][j] - means[j]) ** 2;
    sds[j] = Math.sqrt(v / (n - 1)) || 1;
  }
  const Z = M.map((row) => row.map((x, j) => (x - means[j]) / sds[j]));
  return { Z, means, sds };
}

/** Matriz de correlación de columnas estandarizadas (= covarianza de Z). */
export function correlationMatrix(Z) {
  const n = Z.length;
  const p = Z[0].length;
  const C = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let a = 0; a < p; a += 1) {
    for (let b = a; b < p; b += 1) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += Z[i][a] * Z[i][b];
      C[a][b] = C[b][a] = s / (n - 1);
    }
  }
  return C;
}

/**
 * Eigendescomposición de una matriz simétrica por rotaciones de Jacobi.
 * @returns {{values:number[], vectors:number[][]}} ordenados de mayor a menor
 *          autovalor; vectors[j] es el autovector j (como columna).
 */
export function jacobiEigen(Asym, maxSweeps = 100) {
  const n = Asym.length;
  const A = Asym.map((row) => row.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < maxSweeps; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += A[p][q] * A[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const values = A.map((row, i) => row[i]);
  const idx = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);
  return {
    values: idx.map((i) => values[i]),
    vectors: idx.map((i) => V.map((row) => row[i])),
  };
}

/* =============================== PCA =================================== */
/**
 * Análisis de componentes principales sobre la correlación.
 * @returns {{ scores:number[][], loadings:number[][], values:number[],
 *             explained:number[], names:string[] }}
 *          scores: n×k (proyecciones); loadings[j]: cargas del componente j.
 */
export function pca(M, k = 2) {
  const { Z } = standardizeColumns(M);
  const C = correlationMatrix(Z);
  const { values, vectors } = jacobiEigen(C);
  const total = values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const explained = values.map((v) => Math.max(0, v) / total);
  const K = Math.min(k, vectors.length);

  // Proyección: scores[i][c] = Z[i] · vector_c
  const scores = Z.map((row) =>
    Array.from({ length: K }, (_, c) => row.reduce((s, z, j) => s + z * vectors[c][j], 0))
  );
  // Cargas para biplot: vector escalado por √autovalor.
  const loadings = vectors[0].map((_, j) =>
    Array.from({ length: K }, (_, c) => vectors[c][j] * Math.sqrt(Math.max(0, values[c])))
  );
  return { scores, loadings, values, explained };
}

/* ============================== k-medias =============================== */
function dist2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += (a[i] - b[i]) ** 2;
  return s;
}

/**
 * k-medias con inicialización k-means++ reproducible.
 * @returns {{ labels:number[], centroids:number[][], inertia:number }}
 */
export function kmeans(M, k, { iters = 100, seed = 42 } = {}) {
  const rng = mulberry32(seed);
  const n = M.length;
  // k-means++
  const centroids = [M[Math.floor(rng() * n)].slice()];
  while (centroids.length < k) {
    const d = M.map((x) => Math.min(...centroids.map((c) => dist2(x, c))));
    const sum = d.reduce((s, v) => s + v, 0) || 1;
    let r = rng() * sum;
    let idx = 0;
    while (r > 0 && idx < n - 1) {
      r -= d[idx];
      if (r <= 0) break;
      idx += 1;
    }
    centroids.push(M[idx].slice());
  }

  let labels = new Array(n).fill(0);
  for (let it = 0; it < iters; it += 1) {
    let changed = false;
    for (let i = 0; i < n; i += 1) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c += 1) {
        const dd = dist2(M[i], centroids[c]);
        if (dd < bd) { bd = dd; best = c; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    for (let c = 0; c < k; c += 1) {
      const members = M.filter((_, i) => labels[i] === c);
      if (members.length) {
        for (let j = 0; j < M[0].length; j += 1) {
          centroids[c][j] = members.reduce((s, x) => s + x[j], 0) / members.length;
        }
      }
    }
    if (!changed) break;
  }
  const inertia = M.reduce((s, x, i) => s + dist2(x, centroids[labels[i]]), 0);
  return { labels, centroids, inertia };
}

/* ====================== Distancias y MDS clásico ====================== */
export function distanceMatrix(M) {
  const n = M.length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      D[i][j] = D[j][i] = Math.sqrt(dist2(M[i], M[j]));
    }
  }
  return D;
}

/**
 * Escalado multidimensional clásico (Torgerson) a `dims` dimensiones.
 * @returns {{ coords:number[][], explained:number[] }}
 */
export function classicalMDS(D, dims = 2) {
  const n = D.length;
  const J = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) - 1 / n));
  const D2 = D.map((row) => row.map((d) => d * d));
  // B = -1/2 · J · D2 · J
  const JD = mmul(J, D2);
  const B = mmul(JD, J).map((row) => row.map((v) => -0.5 * v));
  const { values, vectors } = jacobiEigen(B);
  const coords = Array.from({ length: n }, (_, i) =>
    Array.from({ length: dims }, (_, d) => vectors[d][i] * Math.sqrt(Math.max(0, values[d])))
  );
  const total = values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  return { coords, explained: values.map((v) => Math.max(0, v) / total) };
}

function mmul(A, B) {
  const r = A.length;
  const m = B.length;
  const c = B[0].length;
  const out = Array.from({ length: r }, () => new Array(c).fill(0));
  for (let i = 0; i < r; i += 1) for (let k = 0; k < m; k += 1) { const a = A[i][k]; for (let j = 0; j < c; j += 1) out[i][j] += a * B[k][j]; }
  return out;
}

/* ==================== Agrupamiento jerárquico ========================= */
/**
 * Agrupamiento aglomerativo con enlace promedio. Devuelve el orden de las
 * hojas, los segmentos del dendrograma listos para dibujar y la altura máxima.
 * @returns {{ leafOrder:number[], segments:Array<{x:number[],y:number[]}>, maxHeight:number }}
 */
export function hclust(D) {
  const n = D.length;
  let nodes = Array.from({ length: n }, (_, i) => ({ members: [i], height: 0, left: null, right: null }));

  const avgDist = (A, B) => {
    let s = 0;
    for (const a of A.members) for (const b of B.members) s += D[a][b];
    return s / (A.members.length * B.members.length);
  };

  while (nodes.length > 1) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const d = avgDist(nodes[i], nodes[j]);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    }
    const left = nodes[bi];
    const right = nodes[bj];
    const merged = { members: [...left.members, ...right.members], height: bd, left, right };
    nodes = nodes.filter((_, k) => k !== bi && k !== bj);
    nodes.push(merged);
  }
  const root = nodes[0];

  // Orden de hojas por recorrido en profundidad.
  const leafOrder = [];
  (function walk(node) {
    if (!node.left) { leafOrder.push(node.members[0]); return; }
    walk(node.left);
    walk(node.right);
  })(root);
  const xpos = {};
  leafOrder.forEach((leaf, i) => { xpos[leaf] = i; });

  const nodeX = (node) => node.members.reduce((s, m) => s + xpos[m], 0) / node.members.length;

  const segments = [];
  (function build(node) {
    if (!node.left) return;
    build(node.left);
    build(node.right);
    const xl = nodeX(node.left);
    const xr = nodeX(node.right);
    const yl = node.left.height;
    const yr = node.right.height;
    segments.push({ x: [xl, xl, xr, xr], y: [yl, node.height, node.height, yr] });
  })(root);

  return { leafOrder, segments, maxHeight: root.height };
}

/* =============================== t-SNE ================================= */
/** Probabilidades condicionales de una fila con beta dado. */
function hbeta(distRow, beta) {
  const P = distRow.map((d) => Math.exp(-d * beta));
  const sum = P.reduce((s, v) => s + v, 0) || 1e-12;
  let H = 0;
  for (let i = 0; i < P.length; i += 1) {
    P[i] /= sum;
    if (P[i] > 1e-12) H -= P[i] * Math.log(P[i]);
  }
  return { H, P };
}

/**
 * t-SNE a `dims` dimensiones (típicamente 2). Estandariza la entrada, calibra
 * las afinidades a la perplejidad objetivo y optimiza por descenso de gradiente
 * con momento. Semilla fija para que el resultado sea reproducible.
 * @returns {number[][]} coordenadas n×dims
 */
export function tsne(M, { perplexity = 5, iters = 300, seed = 42, dims = 2 } = {}) {
  const { Z } = standardizeColumns(M);
  const n = Z.length;
  const rng = mulberry32(seed);

  // Distancias al cuadrado.
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) { const d = dist2(Z[i], Z[j]); D[i][j] = D[j][i] = d; }

  // P_{j|i} con búsqueda binaria de beta para la perplejidad objetivo.
  const targetH = Math.log(Math.min(perplexity, n - 1));
  const P = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    let betaMin = -Infinity;
    let betaMax = Infinity;
    let beta = 1;
    const others = D[i].filter((_, j) => j !== i);
    let res = hbeta(others, beta);
    for (let tries = 0; tries < 50; tries += 1) {
      const diff = res.H - targetH;
      if (Math.abs(diff) < 1e-5) break;
      if (diff > 0) { betaMin = beta; beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2; }
      else { betaMax = beta; beta = betaMin === -Infinity ? beta / 2 : (beta + betaMin) / 2; }
      res = hbeta(others, beta);
    }
    let idx = 0;
    for (let j = 0; j < n; j += 1) { if (j === i) continue; P[i][j] = res.P[idx]; idx += 1; }
  }
  // Simetrizar y normalizar.
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
    const v = (P[i][j] + P[j][i]) / (2 * n);
    P[i][j] = Math.max(v, 1e-12);
  }

  // Inicialización y optimización.
  let Y = Array.from({ length: n }, () => Array.from({ length: dims }, () => (rng() - 0.5) * 1e-4));
  const iY = Array.from({ length: n }, () => new Array(dims).fill(0));
  const lr = 200;
  for (let it = 0; it < iters; it += 1) {
    const exa = it < 100 ? 4 : 1; // exageración temprana
    const momentum = it < 50 ? 0.5 : 0.8;

    // Q con núcleo t de Student.
    const Qnum = Array.from({ length: n }, () => new Array(n).fill(0));
    let qsum = 0;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      let d = 0;
      for (let k = 0; k < dims; k += 1) d += (Y[i][k] - Y[j][k]) ** 2;
      const q = 1 / (1 + d);
      Qnum[i][j] = q;
      qsum += q;
    }
    qsum = qsum || 1e-12;

    for (let i = 0; i < n; i += 1) {
      const grad = new Array(dims).fill(0);
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const q = Qnum[i][j] / qsum;
        const mult = (exa * P[i][j] - q) * Qnum[i][j];
        for (let k = 0; k < dims; k += 1) grad[k] += mult * (Y[i][k] - Y[j][k]);
      }
      for (let k = 0; k < dims; k += 1) {
        iY[i][k] = momentum * iY[i][k] - lr * 4 * grad[k];
        Y[i][k] += iY[i][k];
      }
    }
    // Centrar.
    for (let k = 0; k < dims; k += 1) {
      let m = 0;
      for (let i = 0; i < n; i += 1) m += Y[i][k];
      m /= n;
      for (let i = 0; i < n; i += 1) Y[i][k] -= m;
    }
  }
  return Y;
}
