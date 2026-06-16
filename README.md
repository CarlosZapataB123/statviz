# StatViz Universe

Plataforma web educativa y profesional para **visualización estadística con rigor**. Reúne un catálogo de más de setenta gráficos en nueve categorías y, para cada uno, responde a cuatro preguntas:

1. **¿Qué gráfico necesito?** — elegir la visualización adecuada para tus variables y tu objetivo.
2. **¿Cómo se construye?** — el método y los parámetros detrás de cada figura.
3. **¿Qué muestra?** — la figura representada con datos reales.
4. **¿Cómo lo interpreto?** — una lectura guiada fundamentada en los valores, no en plantillas.

> **Principio rector:** todo gráfico debe poder mostrarse con datos. Si el usuario no aporta los suyos, cada gráfico trae su **propio conjunto de datos de ejemplo**, de modo que nunca quede vacío.

## Despliegue (sin paso de compilación)

El proyecto es **100 % estático** y usa **ES Modules nativos**. No requiere `npm install` ni build:

- **Local:** servir la carpeta con cualquier servidor estático (necesario para que el navegador cargue los módulos por HTTP), por ejemplo:
  ```bash
  python3 -m http.server 8000
  # abrir http://localhost:8000
  ```
- **GitHub Pages:** publicar la rama directamente; la raíz contiene `index.html`.
- **Plotly local:** Plotly v2.35.2 se incluye en `vendor/plotly.min.js` y se carga desde el propio sitio (mismo origen), por lo que **no depende de ninguna CDN** ni de la conexión; si ese archivo faltara, hay CDNs de respaldo. La vista previa de archivo único lo lleva incrustado y funciona sin red.

> Nota: al abrir `index.html` con doble clic (`file://`) los navegadores bloquean los ES Modules por seguridad. Usa un servidor estático local o GitHub Pages. Para una **vista previa rápida sin servidor** se incluye `statviz-universe-preview.html` (un único archivo autocontenido).

## Arquitectura

```
statviz-universe/
├── index.html              Shell semántico de tres zonas
├── package.json            Metadatos y scripts (test · build:preview · check:bundle)
├── vendor/
│   └── plotly.min.js       Plotly v2.35.2 incluido (sin dependencia de CDN)
├── build_preview.py        Inliner: genera la vista previa de archivo único
├── .github/workflows/ci.yml  Integración continua (pruebas + build + bundle)
├── scripts/
│   └── check-bundle.mjs    Verificador de integridad del bundle
├── css/
│   ├── variables.css       Design tokens (color, tipografía, espaciado, motion)
│   ├── base.css            Reset, accesibilidad, scrollbars, reduced-motion
│   ├── layout.css          Rejilla del shell + responsive
│   ├── components.css      Primitivos de UI (botones, catálogo, pestañas, hero…)
│   ├── animations.css      Keyframes sobrios
│   └── themes/             Claro · Oscuro · Universo (solo overrides de color)
├── js/
│   ├── core/
│   │   ├── app.js          Punto de entrada: orquesta los módulos
│   │   ├── state.js        Store global (get/set/subscribe)
│   │   └── events.js       Bus de eventos pub/sub
│   ├── charts/
│   │   ├── registry.js      Catálogo completo (categorías + gráficos)
│   │   ├── format.js        Formato compartido de los constructores
│   │   ├── builders.js      Registro de constructores + config por defecto
│   │   ├── renderer.js      Motor de render (carga Plotly, valida, tematiza)
│   │   ├── themes/
│   │   │   └── plotly-themes.js  Tema de Plotly desde los tokens CSS
│   │   └── categories/
│   │       ├── descriptive.js    Constructores descriptivos (13)
│   │       ├── association.js    Constructores de asociación (3)
│   │       ├── probability.js    Distribuciones de probabilidad (8)
│   │       ├── inference.js       Inferencia: IC, forest, funnel, volcano, ROC, PR (6)
│   │       ├── regression.js      Regresión y diagnóstico (7)
│   │       ├── series.js          Series temporales (9)
│   │       ├── multivariate.js    Multivariado: PCA, clustering, MDS… (6/7)
│   │       ├── redes.js           Redes y red de correlación (5)
│   │       ├── geograficos.js      Geográficos: choropleth, burbujas, KDE, IDW (4)
│   │       ├── descriptive-extra.js  Variantes descriptivas: ridgeline, beeswarm… (5)
│   │       ├── association-extra.js  Variantes de asociación: hexbin, SPLOM… (4)
│   │       └── umap.js            UMAP (1)
│   ├── stats/
│   │   ├── distributions.js Motor: funciones especiales y distribuciones
│   │   ├── tests.js         Inferencia: IC, varianza inversa, ROC/PR
│   │   ├── regression.js    OLS, álgebra matricial y diagnóstico
│   │   ├── timeseries.js    Orden temporal y autocorrelación (ACF)
│   │   ├── multivariate.js  Eigen (Jacobi), PCA, k-medias, MDS, t-SNE
│   │   ├── networks.js      Disposición de grafos y aristas de correlación
│   │   ├── geo.js           Caja, rejilla, densidad KDE e interpolación IDW
│   │   ├── density.js       Densidad 1D (KDE), Silverman y enjambre
│   │   ├── hexbin.js        Binning hexagonal de nubes de puntos
│   │   └── umap.js          UMAP: conjunto difuso, init espectral, layout
│   ├── recommender.js     Recomendador (perfil de datos × objetivo → gráficos)
│   ├── exporter.js        Exportación (Markdown, HTML autocontenido, utilidades)
│   ├── data/
│   │   ├── parser.js        Lector CSV/TSV (delimitador, decimal, comillas)
│   │   ├── detector.js      Tipo de dato y nivel de medición (con justificación)
│   │   ├── transformer.js   Perdidos, frecuencias, binning, agregación
│   │   ├── dataset.js       Modelo Dataset y constructores
│   │   └── examples.js      Datasets de ejemplo por gráfico
│   └── ui/
│       ├── theme.js        Conmutación y persistencia de tema
│       ├── sidebar.js      Catálogo navegable (colapso + búsqueda)
│       ├── dataIntake.js  ·  recommender.js (asistente de gráfico)   Ingesta de datos (modal: subir/pegar + revisión)
│       ├── workspace.js    Lienzo (tesis / render Plotly / ficha)
│       ├── configPanel.js  Asignación de variables del gráfico
│       ├── interpretationPanel.js  Lectura guiada basada en datos
│       ├── inspector.js    Anfitrión de pestañas (configuración / lectura)
│       ├── statusbar.js    Lectura de datos (n, variables, fuente)
│       └── universe.js     Campo de estrellas (tema Universo)
├── tests/
│   ├── data.test.mjs       Pruebas del motor de datos
│   ├── builders.test.mjs   Pruebas de los constructores de gráficos
│   ├── distributions.test.mjs  Pruebas del motor de distribuciones
│   ├── probability.test.mjs    Pruebas de los gráficos de probabilidad
│   ├── tests.test.mjs          Pruebas de utilidades inferenciales
│   ├── inference.test.mjs      Pruebas de los gráficos de inferencia
│   ├── regression.test.mjs     Pruebas del motor de regresión
│   ├── regression-charts.test.mjs  Pruebas de los gráficos de regresión
│   ├── timeseries.test.mjs     Pruebas de series temporales
│   ├── series-charts.test.mjs  Pruebas de los gráficos de series
│   ├── multivariate.test.mjs   Pruebas del motor multivariado
│   ├── multivariate-charts.test.mjs  Pruebas de los gráficos multivariados
│   ├── networks.test.mjs       Pruebas del motor de redes
│   ├── redes-charts.test.mjs   Pruebas de los gráficos de redes
│   ├── geo.test.mjs            Pruebas del motor geoespacial
│   ├── geograficos-charts.test.mjs  Pruebas de los gráficos geográficos
│   ├── density.test.mjs        Pruebas de densidad y hexbin
│   ├── descriptive-extra.test.mjs  Pruebas de las variantes descriptivas
│   ├── association-extra.test.mjs  Pruebas de las variantes de asociación
│   ├── umap.test.mjs           Pruebas del motor UMAP
│   ├── umap-charts.test.mjs    Prueba del gráfico UMAP
│   ├── mode3d.test.mjs         Pruebas del modo 3D
│   ├── recommender.test.mjs    Recomendador
│   ├── exporter.test.mjs       Exportación (puro)
│   ├── catalog.test.mjs        Integridad del catálogo (71/71)
│   └── run-all.mjs             Ejecutor único de toda la batería
└── data/examples/          Reservado para datasets en archivo (fases futuras)
```

### Decisiones de diseño

- **Tipografía:** superfamilia **IBM Plex** — Sans (interfaz), Mono (datos, lecturas y etiquetas) y Serif (solo el logotipo y la tesis). Elección deliberada frente a fuentes genéricas.
- **Color:** el *chrome* es casi monocromo con un único acento cobalto-índigo; la audacia cromática se reserva para la **paleta de datos** (categórica, afinada y razonablemente segura para daltonismo), que será el sello del producto en los gráficos.
- **Layout:** shell de herramienta de análisis (catálogo · lienzo · inspector + barra de estado), no un *dashboard* de tarjetas.
- **Tema Universo:** elemento distintivo — espacio profundo, nebulosas a la deriva y campo de estrellas en `<canvas>`, con superficies de vidrio esmerilado y respeto a `prefers-reduced-motion`.

## Stack técnico

| Función              | Tecnología                          | Fase   |
| -------------------- | ----------------------------------- | ------ |
| Render 2D            | Plotly.js                           | 3      |
| Render 3D            | Plotly 3D nativo (scatter3d, surface) | 5      |
| Estadística          | Módulo propio + jStat (respaldo)    | 3–6    |
| Exportación          | jsPDF + html2canvas                 | 7      |

(Las dependencias se incorporan en su fase; la Fase 1 no requiere ninguna.)

## Hoja de ruta

- [x] **Fase 1 — Sistema de diseño y shell.** Design tokens, tres temas, layout de tres zonas, catálogo navegable, inspector y barra de estado, principio de datos de ejemplo.
- [x] **Fase 2 — Motor de datos.** Parser CSV/TSV sin dependencias (detección de delimitador y separador decimal, comillas RFC 4180, BOM, filas irregulares), detector de tipo y **nivel de medición** con justificación, confianza y alternativas, transformador (perdidos, frecuencias, binning, agregación, contingencia), modelo `Dataset` unificado y UI de ingesta con revisión editable. Cubierto por 69 pruebas.
- [x] **Fase 3 — Descriptiva y asociación.** Motor de render sobre Plotly (tema derivado de los tokens CSS), 16 gráficos 2D conectados a datos: histograma, polígono de frecuencias, ojiva, densidad (KDE), caja, violín, strip, barras simples/agrupadas/apiladas, frecuencias, Pareto, dot plot, dispersión con regresión, burbujas y mapa de calor de correlaciones. Configuración de variables e interpretación basada en datos. Cubierto por 90 pruebas adicionales.
- [ ] **Fase 4 — Distribuciones, inferencia, regresión, multivariado, series, redes y geográficos (2D).** *(en curso, por bloques)*
  - [x] Motor estadístico (`js/stats/distributions.js`): funciones especiales (lgamma, erf, gamma/beta incompletas) y Normal, t, χ², F, Exponencial, Weibull, Gamma, Beta, Binomial y Poisson (PDF/PMF, CDF, cuantiles). 31 pruebas contra valores de tabla.
  - [x] Categoría **Probabilidad**: 8 gráficos dirigidos por parámetros (densidad/masa + área acumulada), con controles numéricos en el inspector.
  - [x] Utilidades inferenciales (`js/stats/tests.js`) y categoría **Inferencia**: intervalos de confianza, forest, funnel, volcano, ROC y precisión–recall, calculados sobre los datos. 51 pruebas adicionales.
  - [x] Motor de regresión (`js/stats/regression.js`: OLS multivariado, apalancamiento, residuos estandarizados, distancia de Cook) y categoría **Regresión**: lineal, múltiple, curvas ajustadas, residuos, influencia, leverage y Q–Q. 54 pruebas adicionales.
  - [x] Utilidades de series (`js/stats/timeseries.js`: orden temporal, ACF) y categoría **Series temporales**: línea, líneas múltiples, área, área apilada, streamgraph, horizon, estacional, retardo y autocorrelación. 48 pruebas adicionales.
  - [x] Motor multivariado (`js/stats/multivariate.js`: eigendescomposición de Jacobi, PCA, k-medias, MDS clásico, jerárquico, t-SNE) y categoría **Multivariado**: PCA, biplot, clustering, MDS, dendrograma y t-SNE (UMAP pendiente, por exigir más que un port estático). 53 pruebas adicionales.
  - [x] Motor de redes (`js/stats/networks.js`: disposición circular, *force-directed* de Fruchterman–Reingold, aristas de correlación) y categoría **Redes**: network, force-directed, sankey y chord; además la **red de asociación** (correlación entre variables) de la categoría Asociación. 41 pruebas adicionales.
  - [x] Motor geoespacial (`js/stats/geo.js`: caja envolvente, rejilla, KDE gaussiano, interpolación IDW) y categoría **Geográficos**: choropleth, mapa de burbujas, mapa de densidad y mapa de calor, sobre el subsistema `geo` nativo de Plotly (sin Mapbox ni tokens). 43 pruebas adicionales.
  - [x] Variantes descriptivas (motor `density.js`: KDE 1D, Silverman, enjambre) — bars-diverging, stem-leaf, ridgeline, beeswarm, raincloud.
  - [x] Variantes de asociación (motor `hexbin.js` y `splom` nativo) — hexbin, correlograma, pairplot, scatter-matrix.
  - [x] UMAP (motor `umap.js`: conjunto simplicial difuso, inicialización espectral del Laplaciano, optimización por entropía cruzada con muestreo negativo). **Catálogo completo: 71/71.**
- [x] **Fase 5 — Motor 3D** y alternancia 2D/3D: conmutador en el lienzo y `build3d` para los 10 gráficos que lo admiten (scatter, bubble, multiple-reg con plano de regresión, PCA, clustering, MDS, t-SNE, UMAP en 3D, y redes con esfera de Fibonacci y fuerzas 3D). Escena tematizada y 44 pruebas adicionales.
- [x] **Fase 6 — Recomendador** (asistente “¿Qué gráfico necesito?”: perfil de variables × objetivo analítico → gráficos sugeridos con justificación, base de reglas curada de 60+ entradas) e **interpretación automática** real (ya presente: cada gráfico devuelve una lectura calculada con los datos, no plantillas). 15 pruebas adicionales.
- [x] **Fase 7 — Exportación**: PNG, SVG, PDF (impresión), HTML interactivo autocontenido y Markdown con interpretación, todos **sin dependencias**; PPTX y DOCX mediante librería de código abierto cargada **bajo demanda** con degradación elegante. La figura se toma viva del lienzo. 20 pruebas adicionales.
- [x] **Fase 8 — Datasets de ejemplo completos, accesibilidad, pulido y CI**: auditoría que confirma que los 71 gráficos se dibujan con datos reales, enlace de salto al contenido y región de gráfico con `role="img"`, `package.json` con scripts, ejecutor único de pruebas y **GitHub Actions** (pruebas + construcción + integridad del bundle en cada cambio).

## Pruebas

Batería de pruebas sin dependencias, ejecutable con Node. La forma rápida corre **todas** las suites y resume el total:

```bash
npm test                 # o: node tests/run-all.mjs  → 25 suites, 1078 pruebas
```

También pueden ejecutarse de forma individual:

```bash
node tests/catalog.test.mjs     # integridad del catálogo: 71/71 (361)
node tests/data.test.mjs        # motor de datos (69)
node tests/builders.test.mjs    # constructores de gráficos (90)
node tests/distributions.test.mjs  # motor de distribuciones (31)
node tests/probability.test.mjs    # gráficos de probabilidad (84)
node tests/tests.test.mjs          # utilidades inferenciales (13)
node tests/inference.test.mjs      # gráficos de inferencia (38)
node tests/regression.test.mjs     # motor de regresión (18)
node tests/regression-charts.test.mjs  # gráficos de regresión (36)
node tests/timeseries.test.mjs     # series temporales (6)
node tests/series-charts.test.mjs  # gráficos de series (42)
node tests/multivariate.test.mjs   # motor multivariado (15)
node tests/multivariate-charts.test.mjs  # gráficos multivariados (38)
node tests/networks.test.mjs       # motor de redes (11)
node tests/redes-charts.test.mjs   # gráficos de redes (30)
node tests/geo.test.mjs            # motor geoespacial (8)
node tests/geograficos-charts.test.mjs  # gráficos geográficos (35)
node tests/density.test.mjs        # densidad y hexbin (8)
node tests/descriptive-extra.test.mjs  # variantes descriptivas (26)
node tests/association-extra.test.mjs  # variantes de asociación (25)
node tests/umap.test.mjs           # motor UMAP (8)
node tests/umap-charts.test.mjs    # gráfico UMAP (7)
node tests/mode3d.test.mjs         # modo 3D (44)
node tests/recommender.test.mjs    # recomendador (15)
node tests/exporter.test.mjs       # exportación (20)
```

La integración continua, además, construye la vista previa de archivo único y verifica su integridad (`node scripts/check-bundle.mjs`: sin imports/exports residuales, sin nombres duplicados ni `</script>` literal, sintaxis válida).

Validan el parser (delimitadores, comillas, decimales, BOM, filas irregulares), el detector (tipos y niveles de medición), el transformador y los constructores de gráficos (trazas y lectura). Plotly se carga desde CDN en el navegador; las pruebas no lo requieren.

## Accesibilidad y calidad

Enlace de salto al contenido, landmarks (`main`, `aside`) y `aria-*` en navegación, inspector y controles (conmutador 2D/3D, recomendador, exportación), región de gráfico con `role="img"` y alternativa textual en la pestaña de interpretación, foco de teclado visible, cierre de modales con Escape, contraste cuidado en los tres temas, diseño responsive hasta móvil y respeto a la preferencia de movimiento reducido (fondo estelar estático).

---

**Proyecto completo: fases 1–8.** Catálogo de **71 gráficos** (10 con vista 3D), interpretación automática real, **recomendador** y **exportación** a siete formatos, accesibilidad e integración continua. **1078 pruebas en verde** (25 suites) e integridad del bundle verificada en cada cambio.
